// Mahadev Sports Admin Panel - COMPLETE FIXED VERSION
const socket = io('https://chat-system-mryx.onrender.com');
let currentAgent = null;
let currentUser = null;
let token = null;
let allUsers = [];
let filteredUsers = [];
let userCounter = 1; // For generating User001, User002, etc.

// DOM Elements
const loginPage = document.getElementById('login-page');
const dashboardPage = document.getElementById('dashboard-page');
const loginForm = document.getElementById('login-form');
const agentSelect = document.getElementById('agent-select');
const password = document.getElementById('password');
const userList = document.getElementById('user-list');
const messagesContainer = document.getElementById('messages-container');
const emptyState = document.getElementById('empty-state');
const chatHeader = document.getElementById('chat-header');
const selectedUserName = document.getElementById('selected-user-name');
const selectedUserStatus = document.getElementById('selected-user-status');
const chatInputArea = document.getElementById('chat-input-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const agentInfo = document.getElementById('agent-info');
const logoutBtn = document.getElementById('logout-btn');
const totalUsersEl = document.getElementById('total-users');
const onlineUsersEl = document.getElementById('online-users');
const unreadTotalEl = document.getElementById('unread-total');
const userSearch = document.getElementById('user-search');
const filterTabs = document.querySelectorAll('.filter-tab');
const refreshBtn = document.getElementById('refresh-btn');
const notesBtn = document.getElementById('notes-btn');
const notesModal = document.getElementById('notes-modal');
const closeNotes = document.getElementById('close-notes');
const userNotes = document.getElementById('user-notes');
const saveNotesBtn = document.getElementById('save-notes-btn');
const notesHistory = document.getElementById('notes-history');
const quickReplies = document.querySelectorAll('.quick-reply');
const typingIndicator = document.getElementById('typing-indicator');

// Sound notification
const notificationSound = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
notificationSound.volume = 0.3;

// Request notification permission
if (Notification.permission === 'default') {
    Notification.requestPermission();
}

// ============= LOGIN =============
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = agentSelect.value;
    const passwordVal = password.value;
    const loginBtn = document.getElementById('login-btn');
    
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    loginBtn.disabled = true;
    
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/agent/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: passwordVal })
        });
        
        const data = await response.json();
        
        if (data.success) {
            token = data.token;
            currentAgent = data.agent;
            
            loginPage.style.display = 'none';
            dashboardPage.style.display = 'block';
            agentInfo.innerHTML = `<i class="fas fa-user-circle"></i> ${data.agent.name}`;
            
            socket.emit('admin-connect', { token });
            loadUsers();
            startRealTimeUpdates();
        } else {
            alert('Login failed: ' + data.error);
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
            loginBtn.disabled = false;
        }
    } catch (error) {
        alert('Login error. Please try again.');
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
        loginBtn.disabled = false;
    }
});

// ============= LOGOUT =============
logoutBtn.addEventListener('click', () => {
    token = null;
    currentAgent = null;
    currentUser = null;
    loginPage.style.display = 'flex';
    dashboardPage.style.display = 'none';
});

// ============= LOAD USERS =============
async function loadUsers() {
    try {
        const response = await fetch('https://chat-system-mryx.onrender.com/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            // Assign user numbers based on creation date
            const sortedUsers = data.users.sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );
            
            sortedUsers.forEach((user, index) => {
                user.displayName = `User${String(index + 1).padStart(3, '0')}`;
            });
            
            allUsers = sortedUsers;
            applyFilters();
            updateStats();
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// ============= APPLY FILTERS =============
function applyFilters() {
    const searchTerm = userSearch.value.toLowerCase();
    const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
    
    filteredUsers = allUsers.filter(user => {
        // Search filter
        const matchesSearch = (user.displayName || '').toLowerCase().includes(searchTerm) ||
                             user.user_id?.toLowerCase().includes(searchTerm) ||
                             (user.name || '').toLowerCase().includes(searchTerm);
        
        if (!matchesSearch) return false;
        
        // Tab filter
        if (activeFilter === 'online') {
            const lastActive = new Date(user.last_active);
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
            return lastActive > fiveMinAgo;
        }
        if (activeFilter === 'unread') {
            return user.unread_count > 0;
        }
        if (activeFilter === 'new') {
            return user.status === 'New';
        }
        return true;
    });
    
    displayUsers(filteredUsers);
}

// ============= DISPLAY USERS =============
function displayUsers(users) {
    userList.innerHTML = '';
    
    users.forEach(user => {
        const lastActive = new Date(user.last_active);
        const now = new Date();
        const diffMin = Math.floor((now - lastActive) / (1000 * 60));
        const isOnline = diffMin < 5;
        const initials = (user.displayName || 'U').charAt(0).toUpperCase();
        
        // Format time ago properly
        let timeAgo = '';
        if (diffMin < 1) timeAgo = 'just now';
        else if (diffMin < 60) timeAgo = `${diffMin}m ago`;
        else if (diffMin < 1440) timeAgo = `${Math.floor(diffMin / 60)}h ago`;
        else timeAgo = `${Math.floor(diffMin / 1440)}d ago`;
        
        const userDiv = document.createElement('div');
        userDiv.className = `user-item ${currentUser?.user_id === user.user_id ? 'active' : ''}`;
        userDiv.dataset.userId = user.user_id;
        
        userDiv.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <h4>${user.displayName || 'User'}</h4>
                <p>
                    <i class="fas fa-circle" style="color: ${isOnline ? '#4caf50' : '#999'}; font-size: 8px;"></i>
                    ${user.status || 'New'} · ${user.ai_active ? '🤖 AI' : '👤 Agent'}
                </p>
            </div>
            <div class="user-meta">
                <span class="time">${timeAgo}</span>
                ${user.unread_count > 0 ? `<span class="unread-badge">${user.unread_count}</span>` : ''}
            </div>
        `;
        
        userDiv.addEventListener('click', () => selectUser(user));
        userList.appendChild(userDiv);
    });
}

// ============= SELECT USER =============
async function selectUser(user) {
    currentUser = user;
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-user-id="${user.user_id}"]`).classList.add('active');
    
    selectedUserName.textContent = `Chat with ${user.displayName || 'User'}`;
    
    const lastActive = new Date(user.last_active);
    const diffMin = Math.floor((Date.now() - lastActive) / (1000 * 60));
    const isOnline = diffMin < 5;
    
    selectedUserStatus.innerHTML = `
        <i class="fas fa-circle" style="color: ${isOnline ? '#4caf50' : '#999'}; font-size: 10px;"></i>
        ${isOnline ? 'Online' : 'Offline'} · ID: ${user.user_id.slice(-6)}
    `;
    
    chatInputArea.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    // Load messages
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

// ============= DISPLAY MESSAGE =============
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.senderType === 'agent' ? 'sent' : 'received'}`;
    
    // Format time properly
    let timeString = '';
    if (data.timestamp) {
        const date = new Date(data.timestamp);
        const now = new Date();
        const diffMin = Math.floor((now - date) / (1000 * 60));
        
        if (diffMin < 1) timeString = 'just now';
        else if (diffMin < 60) timeString = `${diffMin}m ago`;
        else timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Set sender name and icon based on type
    let senderName = '';
    let senderIcon = '';
    
    if (data.senderType === 'agent' && data.agentName) {
        senderName = data.agentName;
        senderIcon = '👤';
    } else if (data.senderType === 'user') {
        senderName = currentUser?.displayName || 'User';
        senderIcon = '👤';
    } else if (data.senderType === 'ai') {
        senderName = 'AI Assistant';
        senderIcon = '🤖';
    }
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="sender-name">${senderIcon} ${senderName}</div>
            <div>${escapeHtml(data.message)}</div>
            <div class="message-info">${timeString}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============= SEND MESSAGE =============
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

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

// ============= SOCKET EVENTS =============
socket.on('connect', () => {
    console.log('Connected to server');
    if (token) socket.emit('admin-connect', { token });
});

socket.on('new-message', (data) => {
    console.log('New message received:', data);
    
    // Play sound and show notification for user messages
    if (data.senderType === 'user') {
        notificationSound.play().catch(e => console.log('Audio error:', e));
        
        if (Notification.permission === 'granted' && document.hidden) {
            new Notification('New Message', {
                body: `${data.userName || 'User'}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`,
                icon: 'https://mahadevsupport.online/favicon.ico'
            });
        }
        
        // Update page title
        document.title = '🔔 New Message - Admin Panel';
        setTimeout(() => {
            document.title = 'Mahadev Sports - Admin Panel';
        }, 5000);
    }
    
    if (currentUser && data.userId === currentUser.user_id) {
        displayMessage(data);
    }
    loadUsers();
});

socket.on('user-typing', (data) => {
    if (currentUser && data.userId === currentUser.user_id) {
        typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
        if (data.isTyping) {
            typingIndicator.innerHTML = '<span></span><span></span><span></span> User is typing...';
        }
    }
});

// ============= REAL-TIME UPDATES =============
function startRealTimeUpdates() {
    setInterval(loadUsers, 10000);
}

// ============= SEARCH =============
userSearch.addEventListener('input', applyFilters);

// ============= FILTER TABS =============
filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        applyFilters();
    });
});

// ============= REFRESH =============
refreshBtn.addEventListener('click', loadUsers);

// ============= QUICK REPLIES =============
quickReplies.forEach(reply => {
    reply.addEventListener('click', () => {
        messageInput.value = reply.dataset.text;
        messageInput.focus();
    });
});

// ============= NOTES =============
notesBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert('Please select a user first');
        return;
    }
    loadNotes();
    notesModal.style.display = 'flex';
});

closeNotes.addEventListener('click', () => {
    notesModal.style.display = 'none';
});

async function loadNotes() {
    try {
        const response = await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${currentUser.user_id}/notes`);
        const data = await response.json();
        
        if (data.success) {
            userNotes.value = data.note || '';
            
            notesHistory.innerHTML = '';
            if (data.history?.length) {
                data.history.forEach(note => {
                    const noteDiv = document.createElement('div');
                    noteDiv.className = 'note-item';
                    noteDiv.innerHTML = `
                        <div>${note.note}</div>
                        <small>${note.created_by} · ${new Date(note.created_at).toLocaleString()}</small>
                    `;
                    notesHistory.appendChild(noteDiv);
                });
            }
        }
    } catch (error) {
        console.error('Failed to load notes:', error);
    }
}

saveNotesBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    try {
        await fetch(`https://chat-system-mryx.onrender.com/api/admin/user/${currentUser.user_id}/note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: userNotes.value, created_by: currentAgent.name })
        });
        
        notesModal.style.display = 'none';
        alert('Note saved successfully');
    } catch (error) {
        alert('Failed to save note');
    }
});

// ============= UPDATE STATS =============
function updateStats() {
    totalUsersEl.textContent = allUsers.length;
    
    const online = allUsers.filter(u => {
        const last = new Date(u.last_active);
        return (Date.now() - last) < 5 * 60 * 1000;
    }).length;
    onlineUsersEl.textContent = online;
    
    const unread = allUsers.reduce((sum, u) => sum + (u.unread_count || 0), 0);
    unreadTotalEl.textContent = unread;
}

// ============= HELPER =============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============= ADD NOTES API ENDPOINT TO BACKEND =============
// Note: You'll need to add this to your server.js later
