import React, { useState } from "react";
import { useWebRTC } from "../context/WebRTCProvider";
import { useSocket } from "../context/SocketProvider";
import { divideIntoSlices } from "../utils/fileUtils";
import { createSession, saveLaneState, loadSession } from "../utils/db";
import { CHUNK_SIZE, LANES } from "../utils/constants";

export default function Sender() {
  const socket = useSocket();
  const { pc, createOffer } = useWebRTC();
  const [file, setFile] = useState();

  let lanesRef = { current: [] };
  let sessionId = "";

  function selectFile(e) {
    setFile(e.target.files[0]);
  }

  async function startSend() {
    const slices = await divideIntoSlices(file, LANES);

    sessionId = crypto.randomUUID();

    const offer = await createOffer(LANES, lanesRef);

    await createSession(sessionId, {
      name: file.name,
      size: file.size,
      slices,
      laneCount: LANES,
    });

    socket.emit("offer", {
      roomId: "room",
      offer,
      fileInfo: {
        name: file.name,
        size: file.size,
        slices,
        laneCount: LANES,
        sessionId,
      },
    });

    startLanes(slices);
  }

  async function startLanes(slices) {
    lanesRef.current.forEach((lane) => {
      const slice = slices[lane.index];

      const reader = file
        .slice(slice.start, slice.end)
        .stream()
        .getReader();

      let chunkId = 0;

      async function pump() {
        const { value, done } = await reader.read();
        if (done) {
          lane.channel.send(JSON.stringify({ done: true }));
          return;
        }

        if (lane.channel.bufferedAmount > 8 * 1024 * 1024) {
          await new Promise((res) => {
            lane.channel.onbufferedamountlow = () => res();
          });
        }

        lane.channel.send(
          JSON.stringify({
            type: "chunk",
            id: chunkId,
          })
        );
        lane.channel.send(value);

        await saveLaneState(sessionId, lane.index, {
          chunkId,
        });

        chunkId++;
        pump();
      }

      pump();

      lane.channel.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "resume-request") {
          sendMissingChunks(lane, slice, msg.missingChunks);
        }
      };
    });
  }

  // SENDER RESUMES MISSING CHUNKS
  async function sendMissingChunks(lane, slice, missingList) {
    for (const id of missingList) {
      const start = slice.start + id * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, slice.end);

      const chunk = await file.slice(start, end).arrayBuffer();
      lane.channel.send(JSON.stringify({ type: "chunk", id }));
      lane.channel.send(new Uint8Array(chunk));
    }
  }

  return (
    <div>
      <h3>Sender</h3>
      <input type="file" onChange={selectFile} />
      <button onClick={startSend}>START</button>
    </div>
  );
}
