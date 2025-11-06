import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 10000;
const SECRET = process.env.SECRET || "replace_with_long_random_secretxlle_Secr3t_92hdfjsk2398sdflKJ";

app.use(cors());
app.use(bodyParser.json());

// Map of connected users
const connectedUsers = new Map();

// Handle socket connections
io.on("connection", (socket) => {
  console.log("⚡ User connected", socket.id);

  socket.on("join", ({ userId }) => {
    if (userId) {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log("✅ Joined:", userId);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) connectedUsers.delete(socket.userId);
    console.log("❌ Disconnected", socket.userId);
  });

  socket.on("mark_seen", ({ sender_id, receiver_id }) => {
    const receiverSocketId = connectedUsers.get(sender_id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("seen_update", { from: receiver_id });
    }
  });
});

// Endpoint for WordPress to emit messages
app.post("/emit", (req, res) => {
  const { secret, sender_id, receiver_id, message, file_url } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: "Invalid secret" });

  const receiverSocketId = connectedUsers.get(receiver_id);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("xlle_message", { sender_id, receiver_id, message, file_url });
  }

  res.json({ success: true });
});

app.get("/", (req, res) => res.send("✅ XLLE Socket Server is running"));
server.listen(PORT, () => console.log(`🚀 Socket server running on ${PORT}`));
