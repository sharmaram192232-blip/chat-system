// Simple Chat App - No complexity
const socket = io('https://chat-system-mryx.onrender.com');
let userId = null;
const messagesDiv = document.getElementById('messages');
const inputField = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const statusDiv = document.getElementById('status');

// Initialize user when page loads
fetch('https://chat-system-mryx.onrender.com/api/user/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_url: window.location.href })
})
.then(res => res.json())
.then(data => {
    if (data.success) {
        userId = data.userId;
        socket.emit('user-connect', { userId });
        
        // Enable input
        inputField.disabled = false;
        sendButton.disabled = false;
        statusDiv.textContent = 'Online';
        
        // Show welcome message
        addMessage('👋 Hello! How can I help you today?', 'ai');
    }
})
.catch(err => {
    console.log('Error:', err);
    addMessage('👋 Welcome! How can we help you?', 'ai');
    inputField.disabled = false;
    sendButton.disabled = false;
});

// Send message function
function sendMessage() {
    const message = inputField.value.trim();
    if (!message || !userId) return;
    
    // Show user message
    addMessage(message, 'user');
    
    // Send to server
    socket.emit('user-message', { userId, message });
    
    // Clear input
    inputField.value = '';
}

// Add message to chat
function addMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Socket events
socket.on('new-message', (data) => {
    addMessage(data.message, data.senderType);
});

socket.on('connect', () => {
    statusDiv.textContent = 'Online';
    if (userId) socket.emit('user-connect', { userId });
});

socket.on('disconnect', () => {
    statusDiv.textContent = 'Offline';
});
