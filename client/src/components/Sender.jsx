import React, { useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useWebRTC } from "../context/WebRTCProvider";
import { SenderManager } from "../sender/SenderManager";
import { splitIntoLanes } from "../utils/laneUtils";

export default function Sender() {
  const socket = useSocket();
  const { peer } = useWebRTC();
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);

  const pickFile = (e) => setFile(e.target.files[0]);

  async function startSend() {
    const roomId = crypto.randomUUID();
    window.roomId = roomId;

    socket.emit("join-room", { roomId });

    const manager = new SenderManager(peer, file, 4);
    const m = await manager.prepare();
    setMeta(m);

    

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("offer", {
      roomId,
      offer,
      meta: m
    });

    socket.on("answer", async ({ answer }) => {
      await peer.setRemoteDescription(answer);
      manager.start();
    });

    socket.on("candidate", async ({ candidate }) => {
      peer.addIceCandidate(candidate);
    });
  }

  return (
    <div>
      <h2>Sender</h2>

      <input type="file" onChange={pickFile} />

      {file && <button onClick={startSend}>Send File</button>}
    </div>
  );
}
