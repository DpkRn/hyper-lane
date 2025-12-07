import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("join-room", ({ sessionId }) => {
    socket.join(sessionId);
    socket.to(sessionId).emit("peer-joined", { socketId: socket.id });
  });

  socket.on("offer", ({ sessionId, offer }) => {
    socket.to(sessionId).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ sessionId, answer }) => {
    socket.to(sessionId).emit("answer", { answer, from: socket.id });
  });

  // Forward file metadata from sender to receiver
  socket.on("file-info", (data) => {
    const { sessionId } = data;
    if (!sessionId) return;
    socket.to(sessionId).emit("file-info", data);
  });

  socket.on("ice-candidate", ({ sessionId, candidate }) => {
    socket.to(sessionId).emit("ice-candidate", { candidate, from: socket.id });
  });

  // Resume messages
  socket.on("resume-request", ({ sessionId }) => {
    socket.to(sessionId).emit("resume-request");
  });

  socket.on("resume-response", ({ sessionId, lanes }) => {
    socket.to(sessionId).emit("resume-response", { lanes });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => {
  console.log("🚀 Signaling server running on port 5000");
});
