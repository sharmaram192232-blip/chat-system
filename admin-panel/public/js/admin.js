// Admin Panel JavaScript - STABLE WORKING VERSION
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;

// DOM Elements
const loginContainer = document.getElementById('loginContainer');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const userList = document.getElementById('userList');
const messagesContainer = document.getElementById('messagesContainer');
const chatHeader = document.getElementById('chatHeader');
const chatInputArea = document.getElementById('chatInputArea');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const agentInfo = document.getElementById('agentInfo');
const logoutBtn = document.getElementById('logoutBtn');

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
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
            
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'flex';
            logoutBtn.style.display = 'block';
            agentInfo.textContent = `Logged in as: ${data.agent.name}`;
            
            socket.emit('admin-connect', { token });
            loadUsers();
        } else {
            alert('Login failed: ' + data.error);
        }
    } catch (error) {
        alert('Login error. Please try again.');
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    token = null;
    currentAgent = null;
    currentUser = null;
    loginContainer.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
});

// Load Users
async function loadUsers() {
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.users);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Display Users in Sidebar
function displayUsers(users) {
    userList.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.setAttribute('data-user-id', user.user_id);
        
        // Format the user ID to show last 6 characters
        const shortId = user.user_id ? user.user_id.slice(-6) : '------';
        
        userDiv.innerHTML = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${user.name || 'Visitor'}</strong>
                    <span style="
                        font-size: 10px; 
                        color: #666; 
                        background: #f0f0f0; 
                        padding: 2px 6px; 
                        border-radius: 10px;
                        font-family: monospace;
                    ">${shortId}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 12px; color: #666;">
                        ${user.status || 'New'} | ${user.ai_active ? 'AI' : 'Agent'}
                    </span>
                    <span style="font-size: 10px; color: #999;">
                        ${user.last_active ? new Date(user.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            </div>
        `;
        
        userDiv.addEventListener('click', () => selectUser(user));
        userList.appendChild(userDiv);
    });
}

// Select User to Chat
async function selectUser(user) {
    currentUser = user;
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    chatHeader.innerHTML = `<h3>Chat with ${user.name || 'Visitor'}</h3>`;
    chatInputArea.style.display = 'flex';
    
    const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${user.user_id}`);
    const data = await response.json();
    
    if (data.success) {
        messagesContainer.innerHTML = '';
        data.messages.forEach(msg => displayMessage(msg));
    }
}

// Send Message
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentUser || !currentAgent) return;
    
    messageInput.value = '';
    
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

// Display Message with proper bubbles
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    
    // Different alignment for different senders
    if (data.senderType === 'agent') {
        messageDiv.style.display = 'flex';
        messageDiv.style.justifyContent = 'flex-end'; // Agent on RIGHT side
        messageDiv.style.marginBottom = '12px';
    } else {
        messageDiv.style.display = 'flex';
        messageDiv.style.justifyContent = 'flex-start'; // Others on LEFT
        messageDiv.style.marginBottom = '12px';
    }
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.style.maxWidth = '70%';
    bubbleDiv.style.padding = '10px 14px';
    bubbleDiv.style.borderRadius = '18px';
    bubbleDiv.style.wordWrap = 'break-word';
    bubbleDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    
    // Different colors for different sender types
    if (data.senderType === 'agent') {
        bubbleDiv.style.backgroundColor = '#dcf8c6'; // Light green like WhatsApp
        bubbleDiv.style.borderBottomRightRadius = '4px';
    } else if (data.senderType === 'user') {
        bubbleDiv.style.backgroundColor = '#ffffff'; // White for user
        bubbleDiv.style.borderBottomLeftRadius = '4px';
        bubbleDiv.style.border = '1px solid #e0e0e0';
    } else if (data.senderType === 'ai') {
        bubbleDiv.style.backgroundColor = '#e3f2fd'; // Light blue for AI
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    }
    
    // Sender name and time
    const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    }) : new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let senderName = '';
    if (data.senderType === 'agent' && data.agentName) {
        senderName = `<div style="font-weight: 600; font-size: 12px; color: #075e54; margin-bottom: 4px;">${data.agentName}</div>`;
    } else if (data.senderType === 'user') {
        senderName = `<div style="font-weight: 600; font-size: 12px; color: #128c7e; margin-bottom: 4px;">User</div>`;
    } else if (data.senderType === 'ai') {
        senderName = `<div style="font-weight: 600; font-size: 12px; color: #1565c0; margin-bottom: 4px;">AI Assistant</div>`;
    }
    
    bubbleDiv.innerHTML = `
        ${senderName}
        <div style="font-size: 14px; line-height: 1.4;">${escapeHtml(data.message)}</div>
        <div style="font-size: 10px; color: #999; text-align: right; margin-top: 4px;">${time}</div>
    `;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    if (token) {
        socket.emit('admin-connect', { token });
    }
});

socket.on('new-message', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers();
});

socket.on('user-online', () => {
    loadUsers();
});

// Load users every 15 seconds
setInterval(loadUsers, 15000);


