// Admin Panel JavaScript - COMPLETELY FIXED VERSION
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let messageIds = new Set(); // Track message IDs to prevent duplicates

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
    messageIds.clear(); // Clear message cache on logout
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
    messageInput.focus();
    
    // Clear message cache when switching users
    messageIds.clear();
    
    const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${user.user_id}`);
    const data = await response.json();
    
    if (data.success) {
        messagesContainer.innerHTML = '';
        data.messages.forEach(msg => {
            // Generate unique ID for message if not present
            const msgId = msg.id || `${msg.timestamp}-${msg.message.substring(0,10)}`;
            messageIds.add(msgId);
            displayMessage(msg);
        });
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
    
    // Create temporary ID for this message to prevent duplicate display
    const tempId = `temp-${Date.now()}`;
    messageIds.add(tempId);
    
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
    
    // Display locally with temp ID
    displayMessage({
        id: tempId,
        message,
        senderType: 'agent',
        agentName: currentAgent.name,
        timestamp: new Date()
    });
}

// ===== COMPLETELY REWRITTEN DISPLAY FUNCTION =====
function displayMessage(data) {
    console.log('Display message called with:', data);
    
    // Prevent duplicates using message ID
    const msgId = data.id || data._id || `${data.timestamp}-${data.message}`;
    if (messageIds.has(msgId)) {
        console.log('Duplicate message prevented:', msgId);
        return;
    }
    messageIds.add(msgId);
    
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '15px';
    messageDiv.style.clear = 'both';
    messageDiv.style.display = 'flex';
    messageDiv.style.width = '100%';
    
    // Determine sender type
    let senderType = data.senderType || data.sender_type || 'unknown';
    let senderName = '';
    let bubbleColor = '';
    let textColor = '#333';
    let alignment = 'flex-start';
    
    // Configure based on sender type
    if (senderType === 'agent') {
        senderName = data.agentName || 'Agent';
        bubbleColor = '#dcf8c6'; // Light green
        alignment = 'flex-end';
    } else if (senderType === 'user') {
        senderName = 'User';
        bubbleColor = '#ffffff'; // White
        textColor = '#000000';
        alignment = 'flex-start';
    } else if (senderType === 'ai') {
        senderName = 'AI Assistant';
        bubbleColor = '#e3f2fd'; // Light blue
        textColor = '#1565c0';
        alignment = 'flex-start';
    } else {
        // Fallback for unknown
        senderName = senderType.charAt(0).toUpperCase() + senderType.slice(1);
        bubbleColor = '#f0f0f0';
        alignment = 'flex-start';
    }
    
    messageDiv.style.justifyContent = alignment;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.style.maxWidth = '70%';
    bubbleDiv.style.padding = '10px 14px';
    bubbleDiv.style.borderRadius = '18px';
    bubbleDiv.style.wordWrap = 'break-word';
    bubbleDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    bubbleDiv.style.backgroundColor = bubbleColor;
    
    // Add border for user messages
    if (senderType === 'user') {
        bubbleDiv.style.border = '1px solid #e0e0e0';
    }
    
    // Adjust border radius based on alignment
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
    
    // Escape message content
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Build bubble content
    bubbleDiv.innerHTML = `
        <div style="font-weight: 600; font-size: 12px; color: #075e54; margin-bottom: 4px;">
            ${escapeHtml(senderName)}
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
    console.log('New message from socket:', data);
    
    // Only display if it's for current user
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers();
});

socket.on('user-online', () => {
    loadUsers();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Load users every 10 seconds
setInterval(loadUsers, 10000);

// Clear message cache periodically (every 5 minutes)
setInterval(() => {
    if (messagesContainer.children.length > 0) {
        // Keep only last 100 message IDs in cache
        const ids = Array.from(messageIds);
        if (ids.length > 100) {
            messageIds = new Set(ids.slice(-100));
        }
    }
}, 300000);
