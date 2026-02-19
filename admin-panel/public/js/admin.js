const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/agent/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            token = data.token;
            currentAgent = data.agent;
            
            // Hide login, show admin panel
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'flex';
            document.getElementById('agentName').textContent = `Logged in as: ${data.agent.name}`;
            
            // Connect to socket
            socket.emit('admin-connect', { token });
            
            // Load users
            loadUsers();
        } else {
            alert('Login failed');
        }
    } catch (error) {
        alert('Login error');
    }
});

// Load users
async function loadUsers() {
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Display users in sidebar
function displayUsers(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <strong>${user.name || 'Visitor'}</strong><br>
            <small>${user.status} | ${user.ai_active ? 'AI' : 'Agent'}</small>
        `;
        userDiv.onclick = () => selectUser(user);
        userList.appendChild(userDiv);
    });
}

// Select user to chat
async function selectUser(user) {
    currentUser = user;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    event.target.closest('.user-item').classList.add('active');
    
    document.getElementById('chatHeader').innerHTML = `<h3>Chat with ${user.name || 'Visitor'}</h3>`;
    document.getElementById('chatInput').style.display = 'flex';
    
    // Load messages
    const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${user.user_id}`);
    const data = await response.json();
    
    if (data.success) {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';
        data.messages.forEach(msg => {
            displayMessage(msg);
        });
    }
}

// Send message
document.getElementById('sendButton').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !currentUser || !currentAgent) return;
    
    input.value = '';
    
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
    
    displayMessage({
        message,
        senderType: 'agent',
        agentName: currentAgent.name,
        timestamp: new Date()
    });
}

// Display message
function displayMessage(data) {
    const messagesDiv = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '10px';
    msgDiv.style.maxWidth = '70%';
    
    if (data.senderType === 'user') {
        msgDiv.style.marginLeft = 'auto';
        msgDiv.style.background = '#667eea';
        msgDiv.style.color = 'white';
        msgDiv.style.padding = '10px 15px';
        msgDiv.style.borderRadius = '15px';
    } else {
        msgDiv.style.background = data.senderType === 'agent' ? '#e8f5e8' : '#e3f2fd';
        msgDiv.style.color = '#333';
        msgDiv.style.padding = '10px 15px';
        msgDiv.style.borderRadius = '15px';
    }
    
    let sender = '';
    if (data.senderType === 'agent' && data.agentName) {
        sender = `<strong>${data.agentName}:</strong> `;
    }
    
    msgDiv.innerHTML = sender + data.message;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Socket events
socket.on('new-message', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers(); // Refresh user list
});

socket.on('user-online', () => {
    loadUsers();
});

// Load users every 30 seconds
setInterval(loadUsers, 30000);
