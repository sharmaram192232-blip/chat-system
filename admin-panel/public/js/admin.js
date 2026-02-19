class AdminPanel {
    constructor() {
        this.socket = io();
        this.token = null;
        this.currentAgent = null;
        this.currentUser = null;
        this.users = [];
        this.agents = [];
        
        this.initElements();
        this.bindEvents();
        this.setupSocketListeners();
        this.checkSavedSession();
    }

    initElements() {
        this.loginContainer = document.getElementById('loginContainer');
        this.adminPanel = document.getElementById('adminPanel');
        this.loginForm = document.getElementById('loginForm');
        this.userList = document.getElementById('userList');
        this.agentsList = document.getElementById('agentsList');
        this.agentInfo = document.getElementById('agentInfo');
        this.onlineCount = document.getElementById('onlineCount');
        this.adminMessages = document.getElementById('adminMessages');
        this.chatHeader = document.getElementById('chatHeader');
        this.chatControls = document.getElementById('chatControls');
        this.chatInputArea = document.getElementById('chatInputArea');
        this.adminMessageInput = document.getElementById('adminMessageInput');
        this.adminSendButton = document.getElementById('adminSendButton');
        this.aiToggle = document.getElementById('aiToggle');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.adminTypingIndicator = document.getElementById('adminTypingIndicator');
    }

    bindEvents() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.adminSendButton.addEventListener('click', () => this.sendMessage());
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.aiToggle.addEventListener('change', () => this.toggleAI());
        
        this.adminMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.adminMessageInput.addEventListener('input', () => {
            if (this.currentUser) {
                this.socket.emit('typing', {
                    userId: this.currentUser.user_id,
                    isTyping: this.adminMessageInput.value.length > 0,
                    senderType: 'agent'
                });
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.token) {
                this.socket.emit('admin-connect', { token: this.token });
            }
        });

        this.socket.on('new-message', (data) => {
            this.playNotification();
            
            if (this.currentUser && data.userId === this.currentUser.user_id) {
                this.displayMessage(data);
            }
            this.loadUsers();
            
            // Update unread count in user list
            this.updateUserUnread(data.userId);
        });

        this.socket.on('user-online', () => {
            this.loadUsers();
        });

        this.socket.on('user-typing', (data) => {
            if (this.currentUser && data.userId === this.currentUser.user_id) {
                this.adminTypingIndicator.style.display = data.isTyping ? 'flex' : 'none';
            }
        });

        this.socket.on('agent-status-change', (data) => {
            this.updateAgentsList();
        });

        this.socket.on('user-updated', (data) => {
            if (this.currentUser && data.userId === this.currentUser.user_id) {
                this.aiToggle.checked = data.aiActive;
            }
            this.loadUsers();
        });
    }

    checkSavedSession() {
        const savedToken = localStorage.getItem('adminToken');
        const savedAgent = localStorage.getItem('adminAgent');
        if (savedToken && savedAgent) {
            this.token = savedToken;
            this.currentAgent = JSON.parse(savedAgent);
            this.loginContainer.style.display = 'none';
            this.adminPanel.style.display = 'flex';
            this.agentInfo.textContent = `Logged in as: ${this.currentAgent.name}`;
            this.socket.emit('admin-connect', { token: this.token });
            this.loadUsers();
            this.updateAgentsList();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/agent/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.currentAgent = data.agent;
                
                // Save session
                localStorage.setItem('adminToken', this.token);
                localStorage.setItem('adminAgent', JSON.stringify(this.currentAgent));
                
                this.loginContainer.style.display = 'none';
                this.adminPanel.style.display = 'flex';
                this.agentInfo.textContent = `Logged in as: ${this.currentAgent.name}`;
                
                this.socket.emit('admin-connect', { token: this.token });
                this.loadUsers();
                this.updateAgentsList();
            } else {
                alert('Login failed: ' + data.error);
            }
        } catch (error) {
            alert('Login error. Please try again.');
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();
            if (data.success) {
                this.users = data.users;
                this.renderUserList();
                this.updateOnlineCount();
            }
        } catch (error) {
            console.error('Failed to load users');
        }
    }

    async updateAgentsList() {
        try {
            const response = await fetch('/api/admin/agents');
            const data = await response.json();
            if (data.success) {
                this.agents = data.agents;
                this.renderAgentsList();
            }
        } catch (error) {
            console.error('Failed to load agents');
        }
    }

    renderAgentsList() {
        if (!this.agentsList) return;
        
        this.agentsList.innerHTML = '';
        this.agents.forEach(agent => {
            const agentDiv = document.createElement('div');
            agentDiv.className = 'agent-status-item';
            agentDiv.innerHTML = `
                <span class="agent-status-dot ${agent.is_active ? 'online' : 'offline'}"></span>
                <span class="agent-status-name">${agent.name}</span>
            `;
            this.agentsList.appendChild(agentDiv);
        });
    }

    renderUserList() {
        this.userList.innerHTML = '';
        
        const sortedUsers = this.users.sort((a, b) => {
            return new Date(b.last_active) - new Date(a.last_active);
        });

        sortedUsers.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = `user-item ${this.currentUser && this.currentUser.user_id === user.user_id ? 'active' : ''}`;
            
            const lastActive = new Date(user.last_active).toLocaleTimeString();
            const unreadCount = user.unread_count || 0;
            
            userDiv.innerHTML = `
                <div class="user-header">
                    <span class="user-name">${user.name || 'Visitor'}</span>
                    <span class="user-time">${lastActive}</span>
                </div>
                <div class="user-status">
                    <span class="status-badge ${user.status.toLowerCase()}">${user.status}</span>
                    <span class="ai-indicator ${user.ai_active ? 'active' : ''}">
                        ${user.ai_active ? 'AI' : 'Agent'}
                    </span>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
            `;
            
            userDiv.addEventListener('click', () => this.selectUser(user));
            this.userList.appendChild(userDiv);
        });
    }

    updateOnlineCount() {
        const onlineUsers = this.users.filter(u => {
            const lastActive = new Date(u.last_active);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            return lastActive > fiveMinutesAgo;
        }).length;
        
        this.onlineCount.textContent = onlineUsers;
    }

    updateUserUnread(userId) {
        const userItem = this.userList.querySelector(`[data-user-id="${userId}"]`);
        if (userItem) {
            // Update unread count logic
        }
    }

    async selectUser(user) {
        this.currentUser = user;
        
        // Update UI
        document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        this.chatHeader.innerHTML = `
            <div>
                <h3>Chat with ${user.name || 'Visitor'}</h3>
                <small>${user.page_url || 'Direct Visit'}</small>
            </div>
        `;
        
        this.chatControls.style.display = 'block';
        this.chatInputArea.style.display = 'flex';
        this.aiToggle.checked = user.ai_active;
        
        // Load messages
        await this.loadUserMessages(user.user_id);
    }

    async loadUserMessages(userId) {
        try {
            const response = await fetch(`/api/admin/user/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.adminMessages.innerHTML = '';
                data.messages.forEach(msg => this.displayMessage(msg));
                
                // Update user info
                if (data.user) {
                    this.currentUser = data.user;
                }
            }
        } catch (error) {
            console.error('Failed to load messages');
        }
    }

    sendMessage() {
        const message = this.adminMessageInput.value.trim();
        if (!message || !this.currentUser || !this.currentAgent) return;

        this.adminMessageInput.value = '';
        
        this.socket.emit('agent-message', {
            userId: this.currentUser.user_id,
            message,
            agentName: this.currentAgent.name,
            agentId: this.currentAgent.id
        });
        
        this.displayMessage({
            message,
            senderType: 'agent',
            agentName: this.currentAgent.name,
            timestamp: new Date()
        });

        // Stop typing indicator
        this.socket.emit('typing', {
            userId: this.currentUser.user_id,
            isTyping: false,
            senderType: 'agent'
        });
    }

    async toggleAI() {
        if (!this.currentUser) return;
        
        const aiActive = this.aiToggle.checked;
        
        try {
            await fetch(`/api/admin/user/${this.currentUser.user_id}/toggle-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ai_active: aiActive })
            });
        } catch (error) {
            console.error('Failed to toggle AI');
        }
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.senderType}`;
        
        let agentNameHtml = '';
        if (data.senderType === 'agent' && data.agentName) {
            agentNameHtml = `<div class="agent-name">${data.agentName}</div>`;
        }
        
        messageDiv.innerHTML = `
            ${agentNameHtml}
            <div class="message-content">${this.escapeHtml(data.message)}</div>
            <div class="message-time">${this.formatTime(new Date(data.timestamp))}</div>
        `;
        
        this.adminMessages.appendChild(messageDiv);
        this.adminMessages.scrollTop = this.adminMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    playNotification() {
        // Play a subtle sound or show notification
        if (document.hidden) {
            document.title = '🔔 New Message';
        }
    }

    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminAgent');
        this.token = null;
        this.currentAgent = null;
        this.currentUser = null;
        this.adminPanel.style.display = 'none';
        this.loginContainer.style.display = 'flex';
        document.getElementById('username').value = 'agent1';
        document.getElementById('password').value = 'agent123';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});