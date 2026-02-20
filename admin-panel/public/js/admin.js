// Admin Panel JavaScript - FINAL FIXED VERSION
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
    
    // Only emit to socket - let server handle distribution
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message: message,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
}

// Display Message - FIXED VERSION
function displayMessage(data) {
    // Create container for this message
    const messageWrapper = document.createElement('div');
    messageWrapper.style.marginBottom = '15px';
    messageWrapper.style.clear = 'both';
    messageWrapper.style.width = '100%';
    
    // Create bubble container
    const bubbleDiv = document.createElement('div');
    bubbleDiv.style.maxWidth = '70%';
    bubbleDiv.style.padding = '10px 14px';
    bubbleDiv.style.borderRadius = '18px';
    bubbleDiv.style.wordWrap = 'break-word';
    bubbleDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
    
    // Set alignment and color based on sender type
    if (data.senderType === 'agent') {
        // Agent messages on RIGHT with green bubble
        messageWrapper.style.display = 'flex';
        messageWrapper.style.justifyContent = 'flex-end';
        bubbleDiv.style.backgroundColor = '#dcf8c6';
        bubbleDiv.style.borderBottomRightRadius = '4px';
    } else if (data.senderType === 'user') {
        // User messages on LEFT with white bubble
        messageWrapper.style.display = 'flex';
        messageWrapper.style.justifyContent = 'flex-start';
        bubbleDiv.style.backgroundColor = '#ffffff';
        bubbleDiv.style.border = '1px solid #e0e0e0';
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    } else if (data.senderType === 'ai') {
        // AI messages on LEFT with blue bubble
        messageWrapper.style.display = 'flex';
        messageWrapper.style.justifyContent = 'flex-start';
        bubbleDiv.style.backgroundColor = '#e3f2fd';
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    } else {
        // Unknown messages on LEFT with grey bubble
        messageWrapper.style.display = 'flex';
        messageWrapper.style.justifyContent = 'flex-start';
        bubbleDiv.style.backgroundColor = '#f0f0f0';
        bubbleDiv.style.borderBottomLeftRadius = '4px';
    }
    
    // Format timestamp
    let timeString = '';
    if (data.timestamp) {
        try {
            const date = new Date(data.timestamp);
            timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            timeString = '--:--';
        }
    } else {
        timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Determine sender name
    let senderName = '';
    if (data.senderType === 'agent' && data.agentName) {
        senderName = data.agentName;
    } else if (data.senderType === 'user') {
        senderName = 'User';
    } else if (data.senderType === 'ai') {
        senderName = 'AI Assistant';
    } else {
        senderName = 'Unknown';
    }
    
    // Set color for sender name
    let nameColor = '#075e54'; // Default green
    if (data.senderType === 'user') nameColor = '#128c7e';
    if (data.senderType === 'ai') nameColor = '#1565c0';
    
    // Create message content with proper escaping
    const messageText = data.message || '';
    const escapedMessage = messageText.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
    
    // Build bubble HTML
    bubbleDiv.innerHTML = `
        <div style="font-weight: 600; font-size: 12px; color: ${nameColor}; margin-bottom: 4px;">
            ${senderName}
        </div>
        <div style="font-size: 14px; line-height: 1.4;">
            ${escapedMessage}
        </div>
        <div style="font-size: 10px; color: #999; text-align: right; margin-top: 4px;">
            ${timeString}
        </div>
    `;
    
    messageWrapper.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageWrapper);
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
    console.log('New message received:', data);
    
    // Only display if it's for the currently selected user
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    
    // Refresh user list to update any changes
    loadUsers();
});

socket.on('user-online', () => {
    loadUsers();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Load users every 15 seconds
setInterval(loadUsers, 15000);
