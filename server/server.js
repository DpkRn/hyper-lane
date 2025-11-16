import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/greet",async(req,res)=>{
    res.send({response:"welcome"})
    return ;
})

io.on("connection", socket => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("peer-joined");
  });

  socket.on("offer", ({ roomId, offer, meta }) => {
    socket.to(roomId).emit("offer", { offer, meta });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("candidate", { candidate });
  });
});

server.listen(7000, () => console.log("Signaling server on :7000"));
