class ChatApp {
    constructor() {
        this.socket = io('https://chat-system-mryx.onrender.com');
        this.userId = null;
        this.aiActive = true;
        this.messageCount = 0;
        this.agentTyping = false;
        
        this.initElements();
        this.bindEvents();
        this.setupSocketListeners();
        this.initializeUser();
    }

    initElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.aiBadge = document.getElementById('aiBadge');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.nameModal = document.getElementById('nameModal');
        this.userNameInput = document.getElementById('userNameInput');
        this.saveNameBtn = document.getElementById('saveNameBtn');
        this.skipNameBtn = document.getElementById('skipNameBtn');
    }

    bindEvents() {
        this.sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            if (this.userId) {
                this.socket.emit('typing', {
                    userId: this.userId,
                    isTyping: this.messageInput.value.length > 0,
                    senderType: 'user'
                });
            }
        });

        if (this.saveNameBtn) {
            this.saveNameBtn.addEventListener('click', () => this.saveUserName());
        }
        if (this.skipNameBtn) {
            this.skipNameBtn.addEventListener('click', () => this.hideNameModal());
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.userId) {
                this.socket.emit('user-connect', { userId: this.userId });
            }
            this.updateStatus('online');
        });

        this.socket.on('new-message', (data) => {
            this.displayMessage(data);
            if (data.senderType === 'agent' || data.senderType === 'ai') {
                this.agentTyping = false;
                this.typingIndicator.style.display = 'none';
            }
        });

        this.socket.on('ai-mode-changed', (data) => {
            this.aiActive = data.aiActive;
            if (this.aiBadge) {
                this.aiBadge.textContent = this.aiActive ? 'AI Assistant' : 'Agent';
                this.aiBadge.style.background = this.aiActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)';
            }
        });

        this.socket.on('agent-typing', (data) => {
            this.agentTyping = data.isTyping;
            this.typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('offline');
        });
    }

    updateStatus(status) {
        if (this.statusText) {
            this.statusText.textContent = status === 'online' ? 'Online' : 'Offline';
        }
        if (this.statusDot) {
            this.statusDot.style.background = status === 'online' ? '#4caf50' : '#f44336';
        }
    }

    async initializeUser() {
        try {
            const response = await fetch('https://chat-system-mryx.onrender.com/api/user/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_url: window.location.href })
            });

            const data = await response.json();
            
            if (data.success) {
                this.userId = data.userId;
                this.aiActive = data.aiActive;
                
                this.socket.emit('user-connect', { userId: this.userId });
                this.loadMessageHistory();
                
                this.displayMessage({
                    message: "👋 Hello! Thanks for reaching out. How can I help you today?",
                    senderType: 'ai',
                    timestamp: new Date()
                });
                
                this.messageInput.disabled = false;
                this.sendButton.disabled = false;
                this.updateStatus('online');
            }
        } catch (error) {
            console.error('Error:', error);
            this.displayMessage({
                message: "👋 Welcome! How can we help you today?",
                senderType: 'ai',
                timestamp: new Date()
            });
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
        }
    }

    async loadMessageHistory() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`https://chat-system-mryx.onrender.com/api/user/${this.userId}/messages`);
            const data = await response.json();
            
            if (data.success && data.messages.length > 0) {
                this.messagesContainer.innerHTML = '';
                data.messages.forEach(msg => this.displayMessage(msg));
                this.messageCount = data.messages.filter(m => m.sender_type === 'user').length;
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.userId) return;

        this.messageInput.value = '';
        this.adjustTextareaHeight();

        this.displayMessage({
            message,
            senderType: 'user',
            timestamp: new Date()
        });

        this.socket.emit('user-message', {
            userId: this.userId,
            message
        });

        this.messageCount++;

        if (this.messageCount === 3 && !localStorage.getItem('nameModalShown')) {
            setTimeout(() => this.showNameModal(), 1000);
        }

        this.socket.emit('typing', {
            userId: this.userId,
            isTyping: false,
            senderType: 'user'
        });
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.senderType}`;
        
        let agentNameHtml = '';
        if (data.senderType === 'agent' && data.agentName) {
            agentNameHtml = `<div class="agent-name">${data.agentName}</div>`;
        }
        
        const timeString = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            ${agentNameHtml}
            <div class="message-content">${this.escapeHtml(data.message)}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 100) + 'px';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showNameModal() {
        this.nameModal.style.display = 'flex';
        localStorage.setItem('nameModalShown', 'true');
    }

    hideNameModal() {
        this.nameModal.style.display = 'none';
    }

    async saveUserName() {
        const name = this.userNameInput.value.trim();
        if (name && this.userId) {
            try {
                await fetch(`https://chat-system-mryx.onrender.com/api/user/${this.userId}/update-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                
                this.displayMessage({
                    message: `Thanks ${name}! An agent will help you shortly.`,
                    senderType: 'ai',
                    timestamp: new Date()
                });
            } catch (error) {
                console.error('Error saving name:', error);
            }
        }
        this.hideNameModal();
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
