const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function initializeDatabase() {
  const db = await open({
    filename: path.join(__dirname, 'chat_system.db'),
    driver: sqlite3.Database
  });

  // Create chats directory for text file backups
  const chatsDir = path.join(__dirname, 'chats');
  if (!fs.existsSync(chatsDir)) {
    fs.mkdirSync(chatsDir);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'Visitor',
      phone TEXT,
      status TEXT DEFAULT 'New',
      page_url TEXT,
      ai_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 0,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER,
      token TEXT UNIQUE,
      last_active DATETIME,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  // Insert default agents if not exists
  const agentCount = await db.get('SELECT COUNT(*) as count FROM agents');
  if (agentCount.count === 0) {
    await db.run(
      'INSERT INTO agents (username, password, name) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      ['agent1', 'agent123', 'Sarah (Support)', 
       'agent2', 'agent123', 'Mike (Sales)',
       'agent3', 'agent123', 'John (Technical)']
    );
  }

  return db;
}

module.exports = initializeDatabase;