class ChatApp {
    constructor() {
        console.log('ChatApp initializing...');
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
        console.log('Initializing elements...');
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

        console.log('Message input found:', !!this.messageInput);
        console.log('Send button found:', !!this.sendButton);
    }

    bindEvents() {
        console.log('Binding events...');
        
        // Send button click
        this.sendButton.addEventListener('click', (e) => {
            console.log('Send button clicked');
            e.preventDefault();
            this.sendMessage();
        });

        // Enter key press
        this.messageInput.addEventListener('keypress', (e) => {
            console.log('Key pressed:', e.key);
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Input event for typing indicator
        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            if (this.userId && this.messageInput.value.length > 0) {
                this.socket.emit('typing', {
                    userId: this.userId,
                    isTyping: true,
                    senderType: 'user'
                });
            } else if (this.userId) {
                this.socket.emit('typing', {
                    userId: this.userId,
                    isTyping: false,
                    senderType: 'user'
                });
            }
        });

        // Name modal events
        if (this.saveNameBtn) {
            this.saveNameBtn.addEventListener('click', () => this.saveUserName());
        }
        if (this.skipNameBtn) {
            this.skipNameBtn.addEventListener('click', () => this.hideNameModal());
        }
    }

    setupSocketListeners() {
        console.log('Setting up socket listeners...');
        
        this.socket.on('connect', () => {
            console.log('Socket connected!');
            if (this.userId) {
                this.socket.emit('user-connect', { userId: this.userId });
            }
            this.updateStatus('online');
        });

        this.socket.on('new-message', (data) => {
            console.log('New message received:', data);
            this.displayMessage(data);
            if (data.senderType === 'agent' || data.senderType === 'ai') {
                this.agentTyping = false;
                if (this.typingIndicator) {
                    this.typingIndicator.style.display = 'none';
                }
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
            if (this.typingIndicator) {
                this.typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.updateStatus('offline');
        });

        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.displayMessage({
                message: 'Connection error. Please refresh the page.',
                senderType: 'ai',
                timestamp: new Date()
            });
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
        console.log('Initializing user...');
        try {
            const response = await fetch('/api/user/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    page_url: window.location.href 
                })
            });

            const data = await response.json();
            console.log('User init response:', data);
            
            if (data.success) {
                this.userId = data.userId;
                this.aiActive = data.aiActive;
                
                this.socket.emit('user-connect', { userId: this.userId });
                this.loadMessageHistory();
                
                // Display welcome message (without mentioning AI)
                this.displayMessage({
                    message: "👋 Hello! Thanks for reaching out. How can I help you today?",
                    senderType: 'ai',
                    timestamp: new Date()
                });
                
                // Enable input
                if (this.messageInput) {
                    this.messageInput.disabled = false;
                    this.messageInput.focus();
                }
                if (this.sendButton) {
                    this.sendButton.disabled = false;
                }
                
                this.updateStatus('online');
            }
        } catch (error) {
            console.error('Initialization error:', error);
            this.displayMessage({
                message: "👋 Welcome! How can we help you today?",
                senderType: 'ai',
                timestamp: new Date()
            });
            
            if (this.messageInput) {
                this.messageInput.disabled = false;
            }
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
        }
    }

    async loadMessageHistory() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`/api/user/${this.userId}/messages`);
            const data = await response.json();
            
            if (data.success && data.messages.length > 0) {
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
        console.log('sendMessage called');
        
        const message = this.messageInput.value.trim();
        if (!message || !this.userId) {
            console.log('Cannot send: empty message or no userId');
            return;
        }

        console.log('Sending message:', message);

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

    displayMessage(data) {
        console.log('Displaying message:', data);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.senderType}`;
        
        let agentNameHtml = '';
        if (data.senderType === 'agent' && data.agentName) {
            agentNameHtml = `<div class="agent-name">${data.agentName}</div>`;
        }
        
        const timeString = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : new Date().toLocaleTimeString([], { 
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
        if (!this.messageInput) return;
        
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 100) + 'px';
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    showNameModal() {
        if (this.nameModal) {
            this.nameModal.style.display = 'flex';
            localStorage.setItem('nameModalShown', 'true');
        }
    }

    hideNameModal() {
        if (this.nameModal) {
            this.nameModal.style.display = 'none';
        }
    }

    async saveUserName() {
        const name = this.userNameInput.value.trim();
        if (name && this.userId) {
            try {
                await fetch(`/api/user/${this.userId}/update-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                
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

// Initialize app when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loading complete, starting ChatApp...');
        new ChatApp();
    });
} else {
    console.log('DOM already loaded, starting ChatApp immediately...');
    new ChatApp();
}
