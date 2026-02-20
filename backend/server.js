const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
require('dotenv').config();

const initializeDatabase = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

initializeDatabase().then(database => {
  db = database;
  console.log('✅ Database initialized');
});

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save chat to text file
async function saveChatToFile(userId, messages) {
  try {
    const chatContent = messages.map(m => 
      `[${m.timestamp}] ${m.sender_type.toUpperCase()}: ${m.message}`
    ).join('\n');
    
    const filePath = path.join(__dirname, 'chats', `${userId}.txt`);
    await fs.writeFile(filePath, chatContent);
    console.log(`✅ Chat saved to file: ${userId}.txt`);
  } catch (error) {
    console.error('Error saving chat file:', error);
  }
}

// OpenRouter AI integration
async function getAIResponse(message) {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are Mahadev Sports Support Assistant, a sales and onboarding assistant for new users coming from ads. You represent a reputed online sports bookmaker. Your primary goal is to convert inquiries into active customers by giving crisp, confident, up-to-date answers and guiding users toward ID creation and deposit.

===== BRAND POSITIONING =====
- Present Mahadev Sports as a well-established, widely used bookmaker with a large active user base (100,000+ active users)
- Emphasize service strengths:
  * 24×7 customer support
  * 24×7 assistance for deposits and withdrawals
  * Flexible deposits and high withdrawal limits
- Be confident and reassuring, but never make profit guarantees or “risk-free” claims

===== KEYWORD RECOGNITION =====
When customer mentions ANY of these words, they are interested in buying/creating ID:
- id, IDs, online id, betting id, cricket id, game id, user id, new id, create id
- account, wallet, deposit, play, bet, login details, register, sign up

===== MANDATORY OPENING & LEAD CAPTURE FLOW =====
1. Greet and ask intent:
   "Hi 👋 Welcome to Mahadev Sports Support. How can I help you today?"

2. After user's first message, request lead details:
   "Sure, I can help with that. May I have your name and mobile number so our team can assist you better?"
   
3. Store/acknowledge name and mobile when received:
   "Thanks [name]! I'll make sure our team has your details. How can I assist you further?"

===== CONVERSION FLOW =====
If user asks for ID:
"Great 👍 I can help you get started. May I have your name and mobile number so our team can assist you with ID creation?"

If user asks how it works:
"It's simple: Register → Deposit → Play → Withdraw. We handle your ID creation, and you get 24×7 support for deposits and withdrawals."

If user asks about deposit/withdrawal:
"Yes 👍 Our team provides 24×7 support for deposits and withdrawals. Once your ID is created, they'll guide you step-by-step."

If user asks about limits:
"We support flexible deposits and high withdrawal limits. Exact limits depend on your panel and account. I can connect you with our team for details."

If user questions authenticity:
"Yes, of course. Mahadev Sports is a well-established and widely used bookmaker with a large active user base. We provide 24×7 customer support and assistance for deposits and withdrawals. If you'd like, I can connect you with our team to get your ID created."

===== WHATSAPP HANDOFF =====
Share WhatsApp link when:
- User shows distrust or frustration
- User asks for direct contact
- User repeats same questions
- User seems urgent
- User has multiple doubts

Response:
"For quicker help, you can also reach our support team on WhatsApp: https://wa.me/919711680259"

===== HUMAN HANDOVER TRIGGERS =====
Hand over to human agent when user:
- Asks for ID (after collecting name/number)
- Asks for deposit/payment details
- Is ready to start playing
- Has deposit/withdrawal issues
- Faces technical issues
- Requests a real person

Handover phrase:
"I'll connect you with our support team to get you started."

===== HARD RESTRICTIONS (MUST FOLLOW) =====
You must NOT:
- Provide betting tips, predictions, or winning strategies
- Promise profits, guaranteed winnings, or refunds
- Claim betting is risk-free
- Discuss legality, bans, or government/law topics
- Handle or request payment details (UPI, bank, OTP, PIN, card)
- Ask for passwords or sensitive data
- Pretend to be human

Forbidden phrases:
"guaranteed win", "sure profit", "fixed match", "risk-free", "money back", "illegal", "ban", "law", "police"

Use only light responsibility language when required:
"Please play responsibly."

===== TONE & STYLE =====
- Friendly, confident, professional sales/marketing tone
- Short, crisp, direct replies
- Simple English; light Hinglish if user uses Hinglish
- Calm and respectful with angry or confused users
- No fluff, no long lectures

Current date: ${new Date().toLocaleDateString()}`
          },
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://your-chat-system.com',
          'X-Title': 'Chat Support'
        },
        timeout: 10000
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('AI Error:', error.message);
    return "I'm here to help! An agent will be with you shortly if needed.";
  }
}

// ============= USER API (NO REGISTRATION REQUIRED) =============

// Create or get user
app.post('/api/user/init', async (req, res) => {
  try {
    const { page_url } = req.body;
    const userId = generateUserId();
    const pageUrl = page_url || req.headers.referer || 'Direct Visit';

    await db.run(
      'INSERT INTO users (user_id, page_url, last_active) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [userId, pageUrl]
    );

    // Send welcome message from AI
    const welcomeMessage = "👋 Hi there! Welcome to our support. How can I help you today?";
    await db.run(
      'INSERT INTO messages (user_id, sender_type, message) VALUES (?, ?, ?)',
      [userId, 'ai', welcomeMessage]
    );

    res.json({ 
      success: true, 
      userId, 
      welcomeMessage,
      aiActive: true
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize chat' });
  }
});

// Get user messages
app.get('/api/user/:userId/messages', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await db.all(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC',
      [userId]
    );
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// Update user name if they provide it
app.post('/api/user/:userId/update-name', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name } = req.body;
    
    await db.run(
      'UPDATE users SET name = ? WHERE user_id = ?',
      [name, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update name' });
  }
});

// ============= ADMIN API =============

// Agent login
app.post('/api/agent/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const agent = await db.get(
      'SELECT * FROM agents WHERE username = ? AND password = ?',
      [username, password]
    );
    
    if (agent) {
      const token = jwt.sign({ id: agent.id, username: agent.username, name: agent.name }, 
                             process.env.JWT_SECRET || 'secret', 
                             { expiresIn: '24h' });
      
      await db.run(
        'INSERT INTO agent_sessions (agent_id, token, last_active) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [agent.id, token]
      );
      
      await db.run(
        'UPDATE agents SET is_active = 1, last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [agent.id]
      );
      
      res.json({ 
        success: true, 
        token, 
        agent: {
          id: agent.id,
          username: agent.username,
          name: agent.name
        }
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Get all users for admin
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM messages WHERE user_id = u.user_id AND sender_type = 'user' 
         AND timestamp > datetime('now', '-1 hour')) as unread_count
      FROM users u
      ORDER BY last_active DESC
    `);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Get specific user with messages
app.get('/api/admin/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    const messages = await db.all(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC',
      [userId]
    );
    
    res.json({ success: true, user, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user details' });
  }
});

// Toggle AI mode
app.post('/api/admin/user/:userId/toggle-ai', async (req, res) => {
  try {
    const { userId } = req.params;
    const { ai_active } = req.body;
    
    await db.run(
      'UPDATE users SET ai_active = ? WHERE user_id = ?',
      [ai_active ? 1 : 0, userId]
    );
    
    io.to(`user-${userId}`).emit('ai-mode-changed', { aiActive: ai_active });
    io.to('admin-room').emit('user-updated', { userId, aiActive: ai_active });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update AI mode' });
  }
});

// Get all active agents
app.get('/api/admin/agents', async (req, res) => {
  try {
    const agents = await db.all(
      'SELECT id, username, name, is_active, last_login FROM agents ORDER BY name'
    );
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// ============= SOCKET.IO =============

io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  // User connects
  socket.on('user-connect', async ({ userId }) => {
    socket.join(`user-${userId}`);
    await db.run('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
    io.to('admin-room').emit('user-online', { userId });
    console.log(`👤 User connected: ${userId}`);
  });

  // Admin connects
  socket.on('admin-connect', async ({ token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      socket.join('admin-room');
      socket.data.agent = decoded;
      
      await db.run(
        'UPDATE agents SET is_active = 1 WHERE id = ?',
        [decoded.id]
      );
      
      console.log(`👨‍💼 Agent connected: ${decoded.name}`);
      
      // Notify all admins of agent status
      io.to('admin-room').emit('agent-status-change', {
        agentId: decoded.id,
        name: decoded.name,
        isActive: true
      });
    } catch (error) {
      socket.emit('error', { message: 'Invalid token' });
    }
  });

  // User sends message
  socket.on('user-message', async ({ userId, message }) => {
    // Save message
    await db.run(
      'INSERT INTO messages (user_id, sender_type, message) VALUES (?, ?, ?)',
      [userId, 'user', message]
    );

    // Get user info
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    
    // Forward to all admins
    io.to('admin-room').emit('new-message', {
      userId,
      message,
      senderType: 'user',
      timestamp: new Date(),
      userName: user.name || 'Visitor'
    });

    // If AI is active, respond
    if (user.ai_active) {
      const aiResponse = await getAIResponse(message);
      
      await db.run(
        'INSERT INTO messages (user_id, sender_type, message) VALUES (?, ?, ?)',
        [userId, 'ai', aiResponse]
      );

      io.to(`user-${userId}`).emit('new-message', {
        message: aiResponse,
        senderType: 'ai',
        timestamp: new Date()
      });

      io.to('admin-room').emit('new-message', {
        userId,
        message: aiResponse,
        senderType: 'ai',
        timestamp: new Date()
      });
    }
  });

  // Agent sends message
  socket.on('agent-message', async ({ userId, message, agentName, agentId }) => {
    // Turn off AI mode when agent responds
    await db.run('UPDATE users SET ai_active = 0 WHERE user_id = ?', [userId]);

    // Save message
    await db.run(
      'INSERT INTO messages (user_id, sender_type, message) VALUES (?, ?, ?)',
      [userId, 'agent', message]
    );

    // Send to user
    io.to(`user-${userId}`).emit('new-message', {
      message,
      senderType: 'agent',
      agentName,
      timestamp: new Date()
    });

    // Broadcast to admin room
    io.to('admin-room').emit('new-message', {
      userId,
      message,
      senderType: 'agent',
      agentName,
      timestamp: new Date()
    });

    // Update user status to Warm
    await db.run(
      'UPDATE users SET status = ? WHERE user_id = ? AND status = "New"',
      ['Warm', userId]
    );

    // Get all messages for this user and save to file
    const messages = await db.all(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp ASC',
      [userId]
    );
    await saveChatToFile(userId, messages);
  });

  // Typing indicators
  socket.on('typing', ({ userId, isTyping, senderType }) => {
    if (senderType === 'user') {
      io.to('admin-room').emit('user-typing', { userId, isTyping });
    } else {
      io.to(`user-${userId}`).emit('agent-typing', { isTyping });
    }
  });

  // Agent disconnects
  socket.on('disconnect', async () => {
    if (socket.data.agent) {
      await db.run(
        'UPDATE agents SET is_active = 0 WHERE id = ?',
        [socket.data.agent.id]
      );
      
      io.to('admin-room').emit('agent-status-change', {
        agentId: socket.data.agent.id,
        name: socket.data.agent.name,
        isActive: false
      });
      
      console.log(`👨‍💼 Agent disconnected: ${socket.data.agent.name}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);

});

