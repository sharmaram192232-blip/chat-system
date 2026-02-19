// Admin Panel JavaScript
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let typingTimeout = null;

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
const onlineCount = document.getElementById('onlineCount');

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.querySelector('.login-box button');
    
    // Show loading state
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
            
            // Hide login, show admin panel
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'flex';
            logoutBtn.style.display = 'block';
            agentInfo.textContent = `Logged in as: ${data.agent.name}`;
            
            // Connect to socket
            socket.emit('admin-connect', { token });
            
            // Load users
            loadUsers();
            
            // Show welcome notification
            showNotification(`Welcome ${data.agent.name}!`, 'success');
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

// Logout with confirmation
logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        token = null;
        currentAgent = null;
        currentUser = null;
        loginContainer.style.display = 'flex';
        adminPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
        
        // Clear user list
        userList.innerHTML = '';
        messagesContainer.innerHTML = '';
        chatHeader.innerHTML = '<h3>Select a user to start chatting</h3>';
        chatInputArea.style.display = 'none';
    }
});

// Load Users
async function loadUsers() {
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            displayUsers(data.users);
            updateOnlineCount(data.users);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Update online count
function updateOnlineCount(users) {
    if (!onlineCount) return;
    
    const online = users.filter(user => {
        const lastActive = new Date(user.last_active);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastActive > fiveMinutesAgo;
    }).length;
    
    onlineCount.textContent = `${online} online`;
}

// Display Users in Sidebar
function displayUsers(users) {
    userList.innerHTML = '';
    
    // Sort users by last active (most recent first)
    const sortedUsers = users.sort((a, b) => {
        return new Date(b.last_active) - new Date(a.last_active);
    });
    
    sortedUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = `user-item ${currentUser && currentUser.user_id === user.user_id ? 'active' : ''}`;
        userDiv.setAttribute('data-user-id', user.user_id);
        
        const lastActive = new Date(user.last_active);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));
        
        let timeAgo = '';
        if (diffMinutes < 1) timeAgo = 'just now';
        else if (diffMinutes < 60) timeAgo = `${diffMinutes}m ago`;
        else timeAgo = `${Math.floor(diffMinutes / 60)}h ago`;
        
        const isOnline = diffMinutes < 5;
        
        // Check if user has unread messages (sent after last viewed by agent)
        const hasUnread = user.unread_count > 0;
        
        userDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                <span class="status-indicator" style="
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: ${isOnline ? '#4caf50' : '#9e9e9e'};
                    display: inline-block;
                    box-shadow: ${isOnline ? '0 0 0 2px rgba(76, 175, 80, 0.2)' : 'none'};
                "></span>
                <span class="user-name" style="font-weight: 600;">${user.name || 'Visitor'}</span>
                ${hasUnread ? '<span style="background: #f44336; color: white; border-radius: 12px; padding: 2px 8px; font-size: 11px; margin-left: auto;">New</span>' : ''}
                <span style="font-size: 10px; color: #999; margin-left: auto;">${timeAgo}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: ${isOnline ? '#4caf50' : '#999'};">
                    ${isOnline ? '● Online' : '○ Offline'}
                </span>
                <span style="font-size: 11px; background: ${user.ai_active ? '#4caf50' : '#ff9800'}; color: white; padding: 2px 8px; border-radius: 12px;">
                    ${user.ai_active ? 'AI' : 'Agent'}
                </span>
            </div>
        `;
        
        userDiv.addEventListener('click', () => selectUser(user));
        userList.appendChild(userDiv);
    });
}

// Select User to Chat
async function selectUser(user) {
    currentUser = user;
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    chatHeader.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Chat with ${user.name || 'Visitor'}</h3>
            <span style="background: ${user.ai_active ? '#4caf50' : '#ff9800'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                ${user.ai_active ? 'AI Mode' : 'Agent Mode'}
            </span>
        </div>
    `;
    chatInputArea.style.display = 'flex';
    messageInput.focus();
    
    // Load Messages
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

// Typing indicator
messageInput.addEventListener('input', () => {
    if (currentUser && currentAgent) {
        socket.emit('typing', {
            userId: currentUser.user_id,
            isTyping: messageInput.value.length > 0,
            senderType: 'agent'
        });
        
        // Clear previous timeout
        if (typingTimeout) clearTimeout(typingTimeout);
        
        // Set timeout to stop typing after 2 seconds of no input
        typingTimeout = setTimeout(() => {
            socket.emit('typing', {
                userId: currentUser.user_id,
                isTyping: false,
                senderType: 'agent'
            });
        }, 2000);
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentUser || !currentAgent) return;
    
    messageInput.value = '';
    
    // Stop typing indicator
    socket.emit('typing', {
        userId: currentUser.user_id,
        isTyping: false,
        senderType: 'agent'
    });
    
    // Send to server
    socket.emit('agent-message', {
        userId: currentUser.user_id,
        message,
        agentName: currentAgent.name,
        agentId: currentAgent.id
    });
    
    // Display in admin panel
    displayMessage({
        message,
        senderType: 'agent',
        agentName: currentAgent.name,
        timestamp: new Date()
    });
    
    // Play send sound (optional)
    // playSound('send');
}

// Display Message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.senderType}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let senderInfo = '';
    if (data.senderType === 'agent' && data.agentName) {
        senderInfo = `<strong>${data.agentName}</strong><br>`;
    } else if (data.senderType === 'user') {
        senderInfo = `<strong>User</strong><br>`;
    } else if (data.senderType === 'ai') {
        senderInfo = `<strong>AI Assistant</strong><br>`;
    }
    
    messageDiv.innerHTML = `
        ${senderInfo}
        <div style="margin: 4px 0;">${escapeHtml(data.message)}</div>
        <div style="font-size: 10px; opacity: 0.7; text-align: right;">${time}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Play notification sound for new messages
    if (data.senderType === 'user' && document.hidden) {
        playNotificationSound();
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification sound
function playNotificationSound() {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio playback failed:', e));
}

// Show browser notification
function showNotification(message, type = 'info') {
    if (Notification.permission === 'granted') {
        new Notification('Chat System', { body: message });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    // Update page title for unread messages
    if (type === 'message') {
        document.title = '🔔 New Message - Admin Panel';
        setTimeout(() => {
            document.title = 'Admin Panel - Chat System';
        }, 5000);
    }
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    if (token) {
        socket.emit('admin-connect', { token });
    }
});

socket.on('new-message', (data) => {
    // Play notification
    if (data.senderType === 'user') {
        playNotificationSound();
        showNotification(`New message from ${data.userName || 'a user'}`, 'message');
    }
    
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers(); // Refresh user list
});

socket.on('user-typing', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        // Show typing indicator in header or chat area
        const typingDiv = document.getElementById('typingIndicator');
        if (typingDiv) {
            typingDiv.style.display = data.isTyping ? 'block' : 'none';
            if (data.isTyping) {
                typingDiv.innerHTML = '<em>User is typing...</em>';
            }
        }
    }
});

socket.on('user-online', (data) => {
    loadUsers();
    // Update user list to show online status
    const userElement = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (userElement) {
        const statusDot = userElement.querySelector('.status-indicator');
        if (statusDot) {
            statusDot.style.background = '#4caf50';
        }
    }
});

socket.on('user-offline', (data) => {
    loadUsers();
    const userElement = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (userElement) {
        const statusDot = userElement.querySelector('.status-indicator');
        if (statusDot) {
            statusDot.style.background = '#9e9e9e';
        }
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showNotification('Disconnected from server', 'error');
});

// Load users every 15 seconds
setInterval(loadUsers, 15000);

// Request notification permission on load
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

// Add typing indicator to HTML (if not present)
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('typingIndicator')) {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.style.display = 'none';
        typingDiv.style.padding = '5px 20px';
        typingDiv.style.fontStyle = 'italic';
        typingDiv.style.color = '#666';
        messagesContainer.parentNode.insertBefore(typingDiv, messagesContainer.nextSibling);
    }
    
    // Add online count display to header if not present
    const header = document.querySelector('.sidebar-header');
    if (header && !document.getElementById('onlineCount')) {
        const countDiv = document.createElement('div');
        countDiv.id = 'onlineCount';
        countDiv.style.fontSize = '12px';
        countDiv.style.color = '#4caf50';
        countDiv.style.marginTop = '5px';
        header.appendChild(countDiv);
    }
});
