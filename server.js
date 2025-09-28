const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { createServer } = require ('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
const httpServer = createServer(app);

// WebSocket server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'db.bijhyuswpprmdocdutfm.supabase.co',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false // Look into this later
  }
});

// WebSocket: handle connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// DB LISTEN setup
async function listenToDB() {
  const client = await pool.connect();
  await client.query('LISTEN challenge_updates');
  await client.query('LISTEN team_updates');

  client.on('notification', (msg) => {
    const payload = JSON.parse(msg.payload);
    const operation = payload.operation;
    const data = payload.data;

    if (msg.channel === 'challenge_updates') {
      console.log(`Received DB ${operation}:`, data);
      io.emit('challenge-update', {
        type: operation,
        challenge: data
      });
    } else if (msg.channel === 'team_updates') {
      console.log(`Team ${operation}:`, data);
      io.emit('team-update', {
        type: operation,
        team: data.map((team) => {
          team['points'] = 0;
          return team;
        })
      });
    }
  });
}

listenToDB().catch(console.error);

// Server start
httpServer.listen(process.env.PORT, () => {
  console.log(`Server listening on http://localhost:${process.env.PORT}`);
})

// Initial challenges route
app.get('/challenges', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM challenges ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching challenges:', err);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// Initial teams route
app.get('/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});