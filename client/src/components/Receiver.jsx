import React, { useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useWebRTC } from "../context/WebRTCProvider";
import { ReceiverManager } from "../receiver/ReceiverManager";

export default function Receiver() {
  const socket = useSocket();
  const { peer, channels } = useWebRTC();
  const [meta, setMeta] = useState(null);

  async function join(roomId) {
    window.roomId = roomId;
    socket.emit("join-room", { roomId });

    socket.on("offer", async ({ offer, meta }) => {
      setMeta(meta);

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });

      socket.on("candidate", ({ candidate }) => {
        peer.addIceCandidate(candidate);
      });

      const dirHandle = await window.showDirectoryPicker();

      const receiver = new ReceiverManager(peer, meta.fileId, dirHandle);
      await receiver.prepare();
      await receiver.start();

      socket.on("merge", async () => {
        const finalHandle = await window.showSaveFilePicker({
          suggestedName: meta.fileName
        });

        await receiver.merge(finalHandle);
        alert("File merged!");
      });
    });
  }

  return (
    <div>
      <h2>Receiver</h2>

      <button onClick={() => join(prompt("Room ID?"))}>
        Join Room
      </button>
    </div>
  );
}
