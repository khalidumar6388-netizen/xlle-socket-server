// server.js
// Requires: node >= 16
// Run: npm init -y
// npm i express socket.io cors body-parser

const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

// allow websocket connections from your domain(s)
const io = require('socket.io')(server, {
  cors: {
    origin: ["*"], // replace "*" with your site origins for improved security, e.g. "https://agentxbuddy.kesug.com"
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || 'replace_with_long_random_secret';

// ephemeral mapping from userId -> socket id(s)
const userSockets = {}; // { userId: Set(socketId) }

io.on('connection', socket => {
  // client should call socket.emit('join', { userId })
  socket.on('join', (payload) => {
    try {
      const userId = String(payload.userId);
      if (!userId) return;
      socket.userId = userId;
      if (!userSockets[userId]) userSockets[userId] = new Set();
      userSockets[userId].add(socket.id);
      console.log(`socket ${socket.id} joined as user ${userId}`);
    } catch(e) { console.error(e); }
  });

  socket.on('disconnect', () => {
    const uid = socket.userId;
    if (uid && userSockets[uid]) {
      userSockets[uid].delete(socket.id);
      if (userSockets[uid].size === 0) delete userSockets[uid];
    }
    console.log('socket disconnected', socket.id);
  });
});

// REST endpoint: /broadcast
// Accepts POSTs from your WP site: { secret, to_user_id, payload }
// then emits an event 'xlle_message' to the recipient's sockets
app.use(cors());
app.use(bodyParser.json({limit: '25mb'}));
app.post('/broadcast', (req, res) => {
  const { secret, to_user_id, data } = req.body || {};
  if (!secret || secret !== BROADCAST_SECRET) {
    return res.status(403).json({ ok:false, error: 'invalid secret' });
  }
  if (!to_user_id || !data) return res.status(400).json({ ok:false, error:'missing to_user_id or data' });

  const uid = String(to_user_id);
  // emit to recipient (if connected)
  if (userSockets[uid]) {
    for (const sid of userSockets[uid]) {
      io.to(sid).emit('xlle_message', data);
    }
  }
  // Also emit to sender rooms (useful to update sender UI instantly if needed)
  if (data.sender_id) {
    const sUid = String(data.sender_id);
    if (userSockets[sUid]) {
      for (const sid of userSockets[sUid]) io.to(sid).emit('xlle_message', data);
    }
  }

  return res.json({ ok:true });
});

server.listen(PORT, () => console.log(`Socket server listening on ${PORT}`));
