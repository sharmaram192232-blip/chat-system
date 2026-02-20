// Admin Panel JavaScript - BUG FIXED VERSION
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let pendingMessages = new Set(); // Track pending message IDs

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
    pendingMessages.clear();
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
    messageInput.focus();
    
    pendingMessages.clear(); // Clear pending messages when switching users
    
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
    
    // Create a temporary ID for this message
    const tempId = Date.now().toString();
    pendingMessages.add(tempId);
    
    // Create message object
    const messageObj = {
        id: tempId,
        message: message,
        senderType: 'agent',
        agentName: currentAgent.name,
        timestamp: new Date().toISOString()
    };
    
    // Display locally first
    displayMessage(messageObj);
    
    // Send to server
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message: message,
        agentName: currentAgent.name,
        agentId: currentAgent.id,
        tempId: tempId // Send temp ID to prevent duplicate
    });
}

// Display Message - FIXED VERSION
function displayMessage(data) {
    console.log('Displaying message:', data);
    
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '15px';
    messageDiv.style.clear = 'both';
    messageDiv.style.display = 'flex';
    messageDiv.style.width = '100%';
    
    // Determine alignment based on sender type
    let alignment = 'flex-start';
    let bubbleColor = '';
    let senderLabel = '';
    let textColor = '#333';
    
    if (data.senderType === 'agent') {
        alignment = 'flex-end'; // Agent on RIGHT
        bubbleColor = '#dcf8c6'; // Light green
        senderLabel = data.agentName || 'Agent';
        textColor = '#000';
    } else if (data.senderType === 'user') {
        alignment = 'flex-start'; // User on LEFT
        bubbleColor = '#ffffff'; // White
        senderLabel = 'User';
        bubbleColor = '#ffffff';
    } else if (data.senderType === 'ai') {
        alignment = 'flex-start'; // AI on LEFT
        bubbleColor = '#e3f2fd'; // Light blue
        senderLabel = 'AI Assistant';
        textColor = '#1565c0';
    }
    
    messageDiv.style.justifyContent = alignment;
    
    // Create bubble
    const bubbleDiv = document.createElement('div');
    bubbleDiv.style.maxWidth = '70%';
    bubbleDiv.style.padding = '10px 14px';
    bubbleDiv.style.borderRadius = '18px';
    bubbleDiv.style.wordWrap = 'break-word';
    bubbleDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    bubbleDiv.style.backgroundColor = bubbleColor;
    
    // Add border for user messages
    if (data.senderType === 'user') {
        bubbleDiv.style.border = '1px solid #e0e0e0';
    }
    
    // Adjust border radius
    if (alignment === 'flex-end') {
        bubbleDiv.style.borderBottomRightRadius = '4px';
    } else {
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    }
    
    // Format time
    let timeStr = '';
    try {
        timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (e) {
        timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Escape HTML
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Build bubble content
    bubbleDiv.innerHTML = `
        <div style="font-weight: 600; font-size: 12px; color: #075e54; margin-bottom: 4px;">
            ${escapeHtml(senderLabel)}
        </div>
        <div style="font-size: 14px; line-height: 1.4; color: ${textColor};">
            ${escapeHtml(data.message)}
        </div>
        <div style="font-size: 10px; color: #999; text-align: right; margin-top: 4px;">
            ${escapeHtml(timeStr)}
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
    console.log('New message from server:', data);
    
    // Check if this is a message we already displayed locally
    if (data.tempId && pendingMessages.has(data.tempId)) {
        console.log('Ignoring duplicate message with tempId:', data.tempId);
        pendingMessages.delete(data.tempId);
        return;
    }
    
    // Only display if it's for current user
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
