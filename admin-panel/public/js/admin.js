// Admin Panel JavaScript - FIXED VERSION
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let users = []; // Store users globally

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

// Check for saved session
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('adminToken');
    const savedAgent = localStorage.getItem('adminAgent');
    
    if (savedToken && savedAgent) {
        token = savedToken;
        currentAgent = JSON.parse(savedAgent);
        
        loginContainer.style.display = 'none';
        adminPanel.style.display = 'flex';
        logoutBtn.style.display = 'block';
        agentInfo.textContent = `Logged in as: ${currentAgent.name}`;
        
        socket.emit('admin-connect', { token });
        loadUsers();
    }
});

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.querySelector('.login-box button');
    
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;
    
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
            
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminAgent', JSON.stringify(currentAgent));
            
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'flex';
            logoutBtn.style.display = 'block';
            agentInfo.textContent = `Logged in as: ${data.agent.name}`;
            
            socket.emit('admin-connect', { token });
            loadUsers();
        } else {
            alert('Login failed: ' + data.error);
            loginButton.textContent = 'Login to Dashboard';
            loginButton.disabled = false;
        }
    } catch (error) {
        alert('Login error. Please try again.');
        loginButton.textContent = 'Login to Dashboard';
        loginButton.disabled = false;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminAgent');
    
    token = null;
    currentAgent = null;
    currentUser = null;
    users = [];
    loginContainer.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
    
    userList.innerHTML = '';
    messagesContainer.innerHTML = '';
    chatHeader.innerHTML = '<h3>Select a user to start chatting</h3>';
    chatInputArea.style.display = 'none';
});

// Load Users
async function loadUsers() {
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success && data.users) {
            users = data.users; // Store globally
            displayUsers(users);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Display Users in Sidebar
function displayUsers(usersToShow) {
    if (!usersToShow || usersToShow.length === 0) {
        userList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No active users</div>';
        return;
    }
    
    let html = '';
    usersToShow.forEach(user => {
        const lastActive = new Date(user.last_active);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));
        const isOnline = diffMinutes < 5;
        const isActive = currentUser && currentUser.user_id === user.user_id;
        
        html += `
            <div class="user-item ${isActive ? 'active' : ''}" data-user-id="${user.user_id}" onclick="selectUserFromList('${user.user_id}')">
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px;">
                    <span style="
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        background: ${isOnline ? '#4caf50' : '#9e9e9e'};
                        display: inline-block;
                    "></span>
                    <span style="font-weight: 600;">${user.name || 'Visitor'}</span>
                    <span style="font-size: 11px; background: ${user.ai_active ? '#4caf50' : '#ff9800'}; color: white; padding: 2px 8px; border-radius: 12px; margin-left: auto;">
                        ${user.ai_active ? 'AI' : 'Agent'}
                    </span>
                </div>
            </div>
        `;
    });
    
    userList.innerHTML = html;
}

// Global function to select user (needed for onclick)
window.selectUserFromList = async function(userId) {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    
    currentUser = user;
    
    // Update active state
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-user-id="${userId}"]`).classList.add('active');
    
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
};

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

// Display Message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.senderType}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let senderInfo = '';
    if (data.senderType === 'agent' && data.agentName) {
        senderInfo = `<strong>${data.agentName}:</strong> `;
    }
    
    messageDiv.innerHTML = senderInfo + data.message + `<div style="font-size: 10px; color: #999; text-align: right; margin-top: 4px;">${time}</div>`;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    if (token) {
        socket.emit('admin-connect', { token });
        loadUsers();
    }
});

socket.on('new-message', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers(); // Refresh user list but preserve selection
});

socket.on('user-online', () => {
    loadUsers();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Load users every 10 seconds
setInterval(loadUsers, 10000);
