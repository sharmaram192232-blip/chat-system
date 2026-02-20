// Admin Panel JavaScript - STABLE WORKING VERSION WITH ALL FEATURES
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

// Display Users in Sidebar with IDs and timestamps
function displayUsers(users) {
    userList.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.setAttribute('data-user-id', user.user_id);
        
        // Format user ID to show last 6 characters
        const shortId = user.user_id ? user.user_id.slice(-6) : '------';
        
        // Format last active time
        let lastActiveTime = '';
        if (user.last_active) {
            const date = new Date(user.last_active);
            lastActiveTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
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
                        ${lastActiveTime}
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
    messageInput.focus();
    
    try {
        const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${user.user_id}`);
        const data = await response.json();
        
        if (data.success) {
            messagesContainer.innerHTML = '';
            data.messages.forEach(msg => displayMessage(msg));
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
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
    
    // Send to server
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
}

// Display Message with proper formatting
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '12px';
    messageDiv.style.clear = 'both';
    
    // Set alignment based on sender
    if (data.senderType === 'agent') {
        messageDiv.style.textAlign = 'right';
    } else {
        messageDiv.style.textAlign = 'left';
    }
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.style.display = 'inline-block';
    bubbleDiv.style.maxWidth = '70%';
    bubbleDiv.style.padding = '8px 12px';
    bubbleDiv.style.borderRadius = '15px';
    bubbleDiv.style.wordWrap = 'break-word';
    
    // Set colors based on sender
    if (data.senderType === 'agent') {
        bubbleDiv.style.backgroundColor = '#dcf8c6'; // Light green for agent
        bubbleDiv.style.borderBottomRightRadius = '4px';
    } else if (data.senderType === 'user') {
        bubbleDiv.style.backgroundColor = '#ffffff'; // White for user
        bubbleDiv.style.border = '1px solid #e0e0e0';
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    } else if (data.senderType === 'ai') {
        bubbleDiv.style.backgroundColor = '#e3f2fd'; // Light blue for AI
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    }
    
    // Format timestamp
    let timeString = '';
    if (data.timestamp) {
        const date = new Date(data.timestamp);
        timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Set sender name
    let senderDisplay = '';
    if (data.senderType === 'agent' && data.agentName) {
        senderDisplay = data.agentName;
    } else if (data.senderType === 'user') {
        senderDisplay = 'User';
    } else if (data.senderType === 'ai') {
        senderDisplay = 'AI Assistant';
    }
    
    // Build bubble content
    bubbleDiv.innerHTML = `
        <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #075e54;">
            ${senderDisplay}
        </div>
        <div style="font-size: 14px;">${data.message}</div>
        <div style="font-size: 10px; color: #999; text-align: right; margin-top: 4px;">
            ${timeString}
        </div>
    `;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

// Load users every 10 seconds
setInterval(loadUsers, 10000);
