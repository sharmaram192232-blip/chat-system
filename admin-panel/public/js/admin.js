// Admin Panel JavaScript
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let typingTimeout = null;
let reconnectAttempts = 0;

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

// Check for saved session on load
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('adminToken');
    const savedAgent = localStorage.getItem('adminAgent');
    
    if (savedToken && savedAgent) {
        token = savedToken;
        currentAgent = JSON.parse(savedAgent);
        
        // Show admin panel
        loginContainer.style.display = 'none';
        adminPanel.style.display = 'flex';
        logoutBtn.style.display = 'block';
        agentInfo.textContent = `Logged in as: ${currentAgent.name}`;
        
        // Connect to socket
        socket.emit('admin-connect', { token });
        
        // Load users immediately
        loadUsers();
        
        // Load last selected user if any
        const lastUserId = localStorage.getItem('lastSelectedUser');
        if (lastUserId) {
            // Find and select that user after users load
            setTimeout(() => {
                const userElement = document.querySelector(`[data-user-id="${lastUserId}"]`);
                if (userElement) userElement.click();
            }, 1000);
        }
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
            
            // Save to localStorage
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminAgent', JSON.stringify(currentAgent));
            
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'flex';
            logoutBtn.style.display = 'block';
            agentInfo.textContent = `Logged in as: ${data.agent.name}`;
            
            socket.emit('admin-connect', { token });
            loadUsers();
            showNotification(`Welcome back ${data.agent.name}!`, 'success');
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
    if (confirm('Are you sure you want to logout?')) {
        // Clear localStorage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminAgent');
        localStorage.removeItem('lastSelectedUser');
        localStorage.removeItem('cachedUsers');
        
        token = null;
        currentAgent = null;
        currentUser = null;
        loginContainer.style.display = 'flex';
        adminPanel.style.display = 'none';
        logoutBtn.style.display = 'none';
        
        userList.innerHTML = '';
        messagesContainer.innerHTML = '';
        chatHeader.innerHTML = '<h3>Select a user to start chatting</h3>';
        chatInputArea.style.display = 'none';
    }
});

// Load Users with persistence
async function loadUsers(showCache = true) {
    // Try to show cached users first for instant display
    if (showCache) {
        const cachedUsers = localStorage.getItem('cachedUsers');
        if (cachedUsers) {
            try {
                const users = JSON.parse(cachedUsers);
                displayUsers(users);
                console.log('Showing cached users');
            } catch (e) {
                console.log('Cache error:', e);
            }
        }
    }
    
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            // Save to cache
            localStorage.setItem('cachedUsers', JSON.stringify(data.users));
            localStorage.setItem('lastUserLoad', Date.now().toString());
            
            displayUsers(data.users);
            updateOnlineCount(data.users);
            
            // Reset reconnect attempts on successful load
            reconnectAttempts = 0;
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        reconnectAttempts++;
        
        // Show retry message if failed multiple times
        if (reconnectAttempts > 3) {
            const retryDiv = document.createElement('div');
            retryDiv.className = 'retry-message';
            retryDiv.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #f44336;">
                    ⚠️ Connection lost. 
                    <button onclick="location.reload()" style="padding: 8px 16px; margin-left: 10px; background: #0084ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Reconnect
                    </button>
                </div>
            `;
            userList.innerHTML = '';
            userList.appendChild(retryDiv);
        }
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
    
    onlineCount.textContent = `${online} online | ${users.length} total`;
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
    
    // If no users, show empty state
    if (users.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.padding = '40px 20px';
        emptyDiv.style.color = '#999';
        emptyDiv.innerHTML = '👥 No users yet<br><small>Waiting for someone to start a chat...</small>';
        userList.appendChild(emptyDiv);
    }
}

// Select User to Chat
async function selectUser(user) {
    currentUser = user;
    
    // Save last selected user
    localStorage.setItem('lastSelectedUser', user.user_id);
    
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
    
    // Try to load from cache first for instant display
    const cachedMessages = localStorage.getItem(`messages_${user.user_id}`);
    if (cachedMessages) {
        try {
            messagesContainer.innerHTML = '';
            const msgs = JSON.parse(cachedMessages);
            msgs.forEach(msg => displayMessage(msg, false));
        } catch (e) {}
    }
    
    // Load fresh messages from server
    try {
        const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${user.user_id}`);
        const data = await response.json();
        
        if (data.success) {
            messagesContainer.innerHTML = '';
            data.messages.forEach(msg => displayMessage(msg, true));
            
            // Cache messages
            localStorage.setItem(`messages_${user.user_id}`, JSON.stringify(data.messages));
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
        
        if (typingTimeout) clearTimeout(typingTimeout);
        
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
    
    socket.emit('typing', {
        userId: currentUser.user_id,
        isTyping: false,
        senderType: 'agent'
    });
    
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
    }, true);
}

// Display Message
function displayMessage(data, saveToCache = true) {
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
    
    // Play sound for new user messages
    if (data.senderType === 'user' && document.hidden) {
        playNotificationSound();
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification sound
function playNotificationSound() {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio error:', e));
}

// Show notification
function showNotification(message, type = 'info') {
    if (Notification.permission === 'granted') {
        new Notification('Chat System', { body: message });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    reconnectAttempts = 0;
    if (token) {
        socket.emit('admin-connect', { token });
        loadUsers(); // Force load on reconnect
    }
});

socket.on('new-message', (data) => {
    if (data.senderType === 'user') {
        playNotificationSound();
        showNotification(`New message from ${data.userName || 'a user'}`, 'message');
    }
    
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data, true);
        
        // Update cache
        const cached = localStorage.getItem(`messages_${currentUser.user_id}`);
        if (cached) {
            try {
                const msgs = JSON.parse(cached);
                msgs.push(data);
                localStorage.setItem(`messages_${currentUser.user_id}`, JSON.stringify(msgs));
            } catch (e) {}
        }
    }
    loadUsers(false); // Refresh user list without showing cache first
});

socket.on('user-typing', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        let typingDiv = document.getElementById('userTypingIndicator');
        if (!typingDiv) {
            typingDiv = document.createElement('div');
            typingDiv.id = 'userTypingIndicator';
            typingDiv.style.padding = '5px 20px';
            typingDiv.style.fontStyle = 'italic';
            typingDiv.style.color = '#666';
            messagesContainer.parentNode.insertBefore(typingDiv, messagesContainer.nextSibling);
        }
        typingDiv.style.display = data.isTyping ? 'block' : 'none';
        if (data.isTyping) {
            typingDiv.innerHTML = '👤 User is typing...';
        }
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showNotification('Disconnected from server. Trying to reconnect...', 'error');
    
    // Try to reconnect every 5 seconds
    setTimeout(() => {
        if (!socket.connected) {
            location.reload();
        }
    }, 30000);
});

// Load users every 10 seconds (more frequent)
setInterval(() => loadUsers(false), 10000);

// Request notification permission
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

// Add reconnect button on page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, refresh data
        loadUsers(false);
        if (currentUser) {
            selectUser(currentUser);
        }
    }
});
