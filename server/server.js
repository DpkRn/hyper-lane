const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("peer-joined");
  });

  socket.on("offer", ({ roomId, offer, fileInfo }) => {
    socket.to(roomId).emit("receive-offer", { offer, fileInfo });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("receive-answer", { answer });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });
});

server.listen(8000, () => console.log("Signaling server on 8000"));
