class ChatApp {
    constructor() {
        this.socket = io();
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
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
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

        this.saveNameBtn.addEventListener('click', () => this.saveUserName());
        this.skipNameBtn.addEventListener('click', () => this.hideNameModal());
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.userId) {
                this.socket.emit('user-connect', { userId: this.userId });
            }
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
            this.aiBadge.textContent = this.aiActive ? 'AI Assistant' : 'Agent';
            this.aiBadge.style.background = this.aiActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)';
        });

        this.socket.on('agent-typing', (data) => {
            this.agentTyping = data.isTyping;
            if (data.isTyping) {
                this.typingIndicator.style.display = 'flex';
            } else {
                this.typingIndicator.style.display = 'none';
            }
        });
    }

    async initializeUser() {
        try {
            const response = await fetch('/api/user/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    page_url: window.location.href 
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.userId = data.userId;
                this.aiActive = data.aiActive;
                
                this.socket.emit('user-connect', { userId: this.userId });
                this.loadMessageHistory();
                
                // Display welcome message
                this.displayMessage({
                    message: data.welcomeMessage,
                    senderType: 'ai',
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.displayMessage({
                message: "Welcome! How can we help you today?",
                senderType: 'ai',
                timestamp: new Date()
            });
        }
    }

    async loadMessageHistory() {
        try {
            const response = await fetch(`/api/user/${this.userId}/messages`);
            const data = await response.json();
            
            if (data.success) {
                this.messagesContainer.innerHTML = '';
                data.messages.forEach(msg => this.displayMessage(msg, false));
                this.scrollToBottom();
                
                this.messageCount = data.messages.filter(m => m.sender_type === 'user').length;
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.userId) return;

        // Clear input
        this.messageInput.value = '';
        this.adjustTextareaHeight();

        // Display user message immediately
        this.displayMessage({
            message,
            senderType: 'user',
            timestamp: new Date()
        });

        // Send to server
        this.socket.emit('user-message', {
            userId: this.userId,
            message
        });

        // Increment message count
        this.messageCount++;
        
        // Show name modal after 3 messages if not already shown
        if (this.messageCount === 3 && !localStorage.getItem('nameModalShown')) {
            setTimeout(() => this.showNameModal(), 1000);
        }

        // Stop typing indicator
        this.socket.emit('typing', {
            userId: this.userId,
            isTyping: false,
            senderType: 'user'
        });
    }

    displayMessage(data, add = true) {
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

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        if (name) {
            try {
                await fetch(`/api/user/${this.userId}/update-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                
                // Show system message
                this.displayMessage({
                    message: `Thanks ${name}! An agent will be with you shortly if needed.`,
                    senderType: 'ai',
                    timestamp: new Date()
                });
            } catch (error) {
                console.error('Failed to save name:', error);
            }
        }
        this.hideNameModal();
    }
}

// Initialize app immediately when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});