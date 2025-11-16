Every lane has its own metadata:
    sessionId
    fileId
    laneIndex
    start
    end
    chunkSize
    totalChunks
    receivedChunks = Set()
    missingChunks = Set()

frontend/
  src/
    utils/
       db.js
       lanes.js
       fileUtils.js
       resume.js
       constants.js

    context/
       WebRTCProvider.jsx
       SocketProvider.jsx

    components/
       Sender.jsx
       Receiver.jsx
       ProgressBar.jsx
       ResumePrompt.jsx

    App.jsx
    index.jsx
-------------------------------------------------

🟦 utils/constants.js

export const CHUNK_SIZE = 64 * 1024;        // 64 KB
export const LANES = 4;                     // parallel channels

-----------------------------------------------------

🟦 utils/db.js — Resume DB

import { openDB } from "idb";

export const getDB = () => {
  return openDB("webrtc-multi-lane", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "sessionId" });
        s.createIndex("fileId", "fileId");
      }
    },
  });
};

export async function createSession(sessionId, fileInfo) {
  const db = await getDB();
  await db.put("sessions", {
    sessionId,
    fileId: fileInfo.name,
    fileInfo,
    lanes: {},
  });
}

export async function saveLaneState(sessionId, laneIndex, laneState) {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);
  session.lanes[laneIndex] = laneState;
  await db.put("sessions", session);
}

export async function updateChunkReceived(sessionId, laneIndex, chunkId) {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);

  session.lanes[laneIndex].receivedChunks.add(chunkId);
  await db.put("sessions", session);
}

export async function loadSession(sessionId) {
  const db = await getDB();
  return db.get("sessions", sessionId);
}

export async function deleteSession(sessionId) {
  const db = await getDB();
  await db.delete("sessions", sessionId);
}

---------------------------------------------------

🟦 utils/resume.js — Core Resume Logic

export function getMissingChunks(laneState) {
  const missing = [];
  for (let i = 0; i < laneState.totalChunks; i++) {
    if (!laneState.receivedChunks.has(i)) missing.push(i);
  }
  return missing;
}

--------------------------------------------------------------.

🟦 utils/lanes.js
export function createLaneStates(fileSize, slices, chunkSize) {
  return slices.map((slice, i) => {
    const totalChunks = Math.ceil((slice.end - slice.start) / chunkSize);
    return {
      laneIndex: i,
      start: slice.start,
      end: slice.end,
      chunkSize,
      totalChunks,
      receivedChunks: new Set(),
      completed: false,
    };
  });
}

export function createDataChannel(pc, laneIndex, lanes) {
  const ch = pc.createDataChannel("lane-" + laneIndex);
  lanes[laneIndex].channel = ch;
  return ch;
}

export function assignChannelToLane(pc, lanes) {
  pc.ondatachannel = (e) => {
    const laneIndex = Number(e.channel.label.split["-"](1));
    lanes[laneIndex].channel = e.channel;
  };
}

---------------------------------------

🟦 utils/fileUtils.js

export async function divideIntoSlices(file, laneCount) {
  const sliceSize = Math.ceil(file.size / laneCount);
  const slices = [];

  for (let i = 0; i < laneCount; i++) {
    slices.push({
      start: i *sliceSize,
      end: Math.min(file.size, (i + 1)* sliceSize),
    });
  }

  return slices;
}

export async function openWritableFile(name) {
  const handle = await showSaveFilePicker({
    suggestedName: name,
  });
  return { handle, writable: await handle.createWritable() };
}

--------------------------------------------------

🟦 context/WebRTCProvider.jsx (Resume-aware)


import React, { createContext, useContext, useRef } from "react";
import { assignChannelToLane, createDataChannel } from "../utils/lanes";

const WebRTCContext = createContext();
export const useWebRTC = () => useContext(WebRTCContext);

export default function WebRTCProvider({ children }) {
  const pc = useRef(null);

  function createPeer() {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun1.l.google.com:19302"] }],
    });
  }

  async function createOffer(laneCount, lanesRef) {
    createPeer();

    for (let i = 0; i < laneCount; i++) {
      createDataChannel(pc.current, i, lanesRef.current);
    }

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    return offer;
  }

  async function handleOffer(offer, laneCount, lanesRef) {
    createPeer();
    assignChannelToLane(pc.current, lanesRef.current);

    await pc.current.setRemoteDescription(offer);

    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    return answer;
  }

  return (
    <WebRTCContext.Provider value={{ pc, createOffer, handleOffer }}>
      {children}
    </WebRTCContext.Provider>
  );
}


------------------------------------------


🟦 components/Sender.jsx — FULL RESUME-SUPPORTED SENDER



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



----------------------------------------


🟦 components/Receiver.jsx — FULL RESUME RECEIVER
jsx
Copy code


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

