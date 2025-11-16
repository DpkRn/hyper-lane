import React, { useState } from "react";
import { useWebRTC } from "../context/WebRTCProvider";
import { useSocket } from "../context/SocketProvider";
import { openWritableFile } from "../utils/fileUtils";
import { loadSession, saveLaneState } from "../utils/db";
import { getMissingChunks } from "../utils/resume";

export default function Receiver() {
  const socket = useSocket();
  const { pc, handleOffer } = useWebRTC();

  const [progress, setProgress] = useState(0);
  let lanesRef = { current: [] };
  let fileWriter;
  let totalReceived = 0;
  let fileInfo;

  async function startReceiver() {
    socket.emit("join-room", { roomId: "room" });

    socket.on("receive-offer", async ({ offer, fileInfo: info }) => {
      fileInfo = info;

      const answer = await handleOffer(
        offer,
        info.laneCount,
        lanesRef
      );

      socket.emit("answer", { roomId: "room", answer });

      await setupWriters(info);
    });

    socket.on("ice-candidate", (c) => pc.current.addIceCandidate(c));
  }

  async function setupWriters(info) {
    const out = await openWritableFile("REC_" + info.name);
    fileWriter = out.writable;

    const session = await loadSession(info.sessionId);
    if (session) {
      resumeOldSession(session);
    } else {
      startFresh(info);
    }
  }

  // FRESH DOWNLOAD
  function startFresh(info) {
    lanesRef.current.forEach((lane) => {
      let slice = info.slices[lane.index];
      let offsetBase = slice.start;

      lane.channel.onmessage = async (e) => {
        if (typeof e.data === "string") {
          const msg = JSON.parse(e.data);
          if (msg.type === "chunk") {
            lane.currentChunkId = msg.id;
          }
          return;
        }

        const chunkId = lane.currentChunkId;
        const offset = offsetBase + chunkId * info.chunkSize;

        await fileWriter.seek(offset);
        await fileWriter.write(e.data);

        totalReceived += e.data.byteLength;

        setProgress((totalReceived / info.size) * 100);

        await saveLaneState(info.sessionId, lane.index, {
          ...info.lanes?.[lane.index],
          receivedChunks: { ...(info.lanes?.[lane.index]?.receivedChunks || {}), [chunkId]: true }
        });
      };
    });
  }

  // RESUME OLD DOWNLOAD
  function resumeOldSession(session) {
    const laneStates = session.lanes;

    lanesRef.current.forEach((lane) => {
      const laneState = laneStates[lane.index];
      const slice = session.fileInfo.slices[lane.index];

      const missing = getMissingChunks(laneState);
      lane.channel.send(
        JSON.stringify({
          type: "resume-request",
          missingChunks: missing,
        })
      );

      lane.channel.onmessage = async (e) => {
        if (typeof e.data === "string") {
          const msg = JSON.parse(e.data);
          if (msg.type === "chunk") {
            lane.currentChunkId = msg.id;
          }
          return;
        }

        const offset =
          slice.start + lane.currentChunkId * session.fileInfo.chunkSize;

        await fileWriter.seek(offset);
        await fileWriter.write(e.data);

        totalReceived += e.data.byteLength;
        setProgress((totalReceived / session.fileInfo.size) * 100);

        laneState.receivedChunks.add(lane.currentChunkId);
        await saveLaneState(session.sessionId, lane.index, laneState);
      };
    });
  }

  return (
    <div>
      <h3>Receiver</h3>
      <button onClick={startReceiver}>START RECEIVER</button>
      <div>Progress: {progress.toFixed(2)}%</div>
    </div>
  );
}
