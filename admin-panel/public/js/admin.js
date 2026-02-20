// Admin Panel - SIMPLE WORKING VERSION
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

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
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
        alert('Login failed');
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
    const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
    const data = await response.json();
    if (data.success) displayUsers(data.users);
}

// Display Users
function displayUsers(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => selectUser(user);
        div.innerHTML = `<strong>${user.name || 'Visitor'}</strong><br><small>${user.status} | ${user.ai_active ? 'AI' : 'Agent'}</small>`;
        userList.appendChild(div);
    });
}

// Select User
async function selectUser(user) {
    currentUser = user;
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
sendButton.onclick = sendMessage;
messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg || !currentUser || !currentAgent) return;
    messageInput.value = '';
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message: msg,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
}

// Display Message
function displayMessage(data) {
    const wrapper = document.createElement('div');
    wrapper.style.margin = '10px 0';
    wrapper.style.textAlign = data.senderType === 'agent' ? 'right' : 'left';
    
    const bubble = document.createElement('div');
    bubble.style.display = 'inline-block';
    bubble.style.maxWidth = '70%';
    bubble.style.padding = '8px 12px';
    bubble.style.borderRadius = '15px';
    bubble.style.backgroundColor = 
        data.senderType === 'agent' ? '#dcf8c6' :
        data.senderType === 'user' ? 'white' : '#e3f2fd';
    if (data.senderType === 'user') bubble.style.border = '1px solid #ddd';
    
    const name = document.createElement('div');
    name.style.fontWeight = 'bold';
    name.style.fontSize = '12px';
    name.style.marginBottom = '4px';
    name.style.color = 
        data.senderType === 'agent' ? '#075e54' :
        data.senderType === 'user' ? '#128c7e' : '#1565c0';
    name.textContent = 
        data.senderType === 'agent' ? (data.agentName || 'Agent') :
        data.senderType === 'user' ? 'User' : 'AI Assistant';
    
    const text = document.createElement('div');
    text.style.fontSize = '14px';
    text.textContent = data.message;
    
    const time = document.createElement('div');
    time.style.fontSize = '10px';
    time.style.color = '#999';
    time.style.textAlign = 'right';
    time.style.marginTop = '4px';
    time.textContent = data.timestamp ? 
        new Date(data.timestamp).toLocaleTimeString().slice(0,5) : 
        new Date().toLocaleTimeString().slice(0,5);
    
    bubble.appendChild(name);
    bubble.appendChild(text);
    bubble.appendChild(time);
    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Socket events
socket.on('new-message', (data) => {
    if (currentUser && data.userId === currentUser.user_id) displayMessage(data);
    loadUsers();
});

socket.on('user-online', () => loadUsers());

setInterval(loadUsers, 10000);
