// Simple working chat
const socket = io('https://chat-system-mryx.onrender.com');
let userId = null;

// Get DOM elements
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDiv = document.getElementById('status');

// Initialize user when page loads
fetch('https://chat-system-mryx.onrender.com/api/user/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_url: window.location.href })
})
.then(response => response.json())
.then(data => {
    console.log('User initialized:', data);
    if (data.success) {
        userId = data.userId;
        socket.emit('user-connect', { userId });
        
        // Enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        statusDiv.textContent = 'Online';
        statusDiv.style.color = '#4caf50';
        
        // Show welcome message
        addMessage('👋 Hello! How can I help you today?', 'ai');
    }
})
.catch(error => {
    console.error('Error:', error);
    addMessage('👋 Welcome! How can we help you?', 'ai');
    messageInput.disabled = false;
    sendButton.disabled = false;
    statusDiv.textContent = 'Online';
    statusDiv.style.color = '#4caf50';
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !userId) return;
    
    // Show user message
    addMessage(message, 'user');
    
    // Send to server
    socket.emit('user-message', { userId, message });
    
    // Clear input
    messageInput.value = '';
}

// Add message to chat
function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Socket events
socket.on('new-message', (data) => {
    console.log('New message:', data);
    addMessage(data.message, data.senderType);
});

socket.on('connect', () => {
    console.log('Socket connected');
    statusDiv.textContent = 'Online';
    statusDiv.style.color = '#4caf50';
    if (userId) {
        socket.emit('user-connect', { userId });
    }
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
    statusDiv.textContent = 'Offline';
    statusDiv.style.color = '#f44336';
});

socket.on('ai-mode-changed', (data) => {
    console.log('AI mode changed:', data);
});

// Load message history if userId exists
socket.on('connect', function() {
    if (userId) {
        fetch(`https://chat-system-mryx.onrender.com/api/user/${userId}/messages`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.messages.length > 0) {
                messagesContainer.innerHTML = '';
                data.messages.forEach(msg => {
                    addMessage(msg.message, msg.sender_type);
                });
            }
        })
        .catch(err => console.log('Error loading history:', err));
    }
});
