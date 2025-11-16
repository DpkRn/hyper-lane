export async function sendOffer(socket, roomId, offer) {
  socket.emit("offer", { roomId, offer });
}

export async function sendAnswer(socket, roomId, answer) {
  socket.emit("answer", { roomId, answer });
}

export function sendCandidate(socket, roomId, candidate) {
  socket.emit("candidate", { roomId, candidate });
}
