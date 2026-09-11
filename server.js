const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MAX_USERS = 5;
const MESSAGE_TTL = 24 * 60 * 60 * 1000; // 1 day

// In-memory rooms. Messages stay available for at least the running server's
// 24-hour retention window. For hosting/restarts, use a database such as SQLite.
const rooms = new Map();

function cleanOldMessages(room) {
  const cutoff = Date.now() - MESSAGE_TTL;
  room.messages = room.messages.filter(m => m.time >= cutoff);
}

function getRoom(roomName) {
  if (!rooms.has(roomName)) rooms.set(roomName, { users: new Map(), messages: [] });
  const room = rooms.get(roomName);
  cleanOldMessages(room);
  return room;
}

io.on("connection", socket => {
  socket.on("joinRoom", ({ roomName, userName }) => {
    roomName = String(roomName || "").trim().slice(0, 30);
    userName = String(userName || "").trim().slice(0, 30);

    if (!roomName || !userName) return socket.emit("joinError", "Enter both a room name and your name.");
    const room = getRoom(roomName);

    if (room.users.size >= MAX_USERS) {
      return socket.emit("joinError", "This room already has 5 members.");
    }

    const duplicateName = [...room.users.values()].some(
      u => u.name.toLowerCase() === userName.toLowerCase()
    );
    if (duplicateName) {
      return socket.emit("joinError", "That name is already being used in this room.");
    }

    socket.join(roomName);
    room.users.set(socket.id, { name: userName, id: socket.id, joined: Date.now() });
    socket.data.roomName = roomName;

    socket.emit("joined", {
      roomName,
      userName,
      messages: room.messages,
      users: [...room.users.values()].map(u => u.name)
    });
    io.to(roomName).emit("members", [...room.users.values()].map(u => u.name));
  });

  socket.on("sendMessage", text => {
    const roomName = socket.data.roomName;
    if (!roomName) return;
    const room = getRoom(roomName);
    const user = room.users.get(socket.id);
    if (!user) return;

    text = String(text || "").trim().slice(0, 1000);
    if (!text) return;

    const message = { id: Date.now() + Math.random(), name: user.name, text, time: Date.now() };
    room.messages.push(message);
    io.to(roomName).emit("message", message);
  });

  socket.on("disconnect", () => {
    const roomName = socket.data.roomName;
    if (!roomName || !rooms.has(roomName)) return;
    const room = rooms.get(roomName);
    room.users.delete(socket.id);
    io.to(roomName).emit("members", [...room.users.values()].map(u => u.name));
    if (room.users.size === 0) {
      // Keep the room's messages for the 24-hour retention period.
      cleanOldMessages(room);
      setTimeout(() => {
        if (rooms.has(roomName) && rooms.get(roomName).users.size === 0) {
          const r = rooms.get(roomName);
          cleanOldMessages(r);
          if (r.messages.length === 0) rooms.delete(roomName);
        }
      }, MESSAGE_TTL);
    }
  });
});

setInterval(() => {
  for (const [name, room] of rooms) {
    cleanOldMessages(room);
    if (room.users.size === 0 && room.messages.length === 0) rooms.delete(name);
  }
}, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`No-login chat running at http://localhost:${PORT}`);
});