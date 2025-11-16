import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // in prod: restrict to frontend domain
    methods: ["GET", "POST"]
  }
});

// ─────────────────────────────────────────────
// Store which clients are in which rooms
// ─────────────────────────────────────────────

const rooms = new Map();

// ─────────────────────────────────────────────
// Socket.io Connection
// ─────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);

    console.log(`📍 ${socket.id} joined room ${roomId}`);

    // Notify other peer someone joined
    socket.to(roomId).emit("peer-joined", { socketId: socket.id });
  });

  // ─────────────────────────────────────────────
  // WebRTC Signaling Events
  // ─────────────────────────────────────────────

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", { candidate, from: socket.id });
  });

  // ─────────────────────────────────────────────
  // Resume Signaling (Custom for your project)
  // ─────────────────────────────────────────────

  socket.on("resume-request", ({ roomId, sessionId }) => {
    socket.to(roomId).emit("resume-request", { sessionId, from: socket.id });
  });

  socket.on("resume-response", ({ roomId, sessionId, lanes }) => {
    socket.to(roomId).emit("resume-response", { sessionId, lanes });
  });

  // ─────────────────────────────────────────────
  // Clean Disconnect Handling
  // ─────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    rooms.forEach((clients, roomId) => {
      if (clients.has(socket.id)) {
        clients.delete(socket.id);
        socket.to(roomId).emit("peer-disconnected", { id: socket.id });

        if (clients.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Signaling server running on port ${PORT}`));
