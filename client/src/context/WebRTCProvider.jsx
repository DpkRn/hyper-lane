/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketProvider";
import { initMetadataWorker, saveChunkMetadata } from "../services/metadataService";
import { writeChunkToLane, mergeLanesToFinalFile, closeAllLanes, initLaneFiles } from "../utils/fileUtils";

const LANE_COUNT = 4;
const CHUNK_SIZE = 64 * 1024; // 64KB per chunk

const WebRTCContext = createContext(null);
export const useWebRTC = () => useContext(WebRTCContext);

export function WebRTCProvider({ children }) {
  const socket = useSocket();

  const pc = useRef(null);
  const lanes = useRef([]); // RTCDataChannels
  const fileRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const totalBytesReceivedRef = useRef(0);
  const completedLanesRef = useRef(0);
  const nextWriteOffsetRef = useRef([]);
  const progressCallbackRef = useRef(null);

  useEffect(() => {
    initMetadataWorker();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1️⃣ Start Negotiation (Called ONLY when Receiver clicks Download)
  // ─────────────────────────────────────────────────────────────
  async function startWebRTC(file, sid, role, onProgress) {
    progressCallbackRef.current = onProgress || null;
    setSessionId(sid);

    fileRef.current = file;
    pc.current = createPeerConnection(sid);

    if (role === "sender") {
      createSenderLanes();
      await createOffer(sid);
    }

    attachSocketListeners(sid);
  }

  // ─────────────────────────────────────────────────────────────
  // Create RTCPeerConnection
  // ─────────────────────────────────────────────────────────────
  function createPeerConnection(sid) {
    const config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        },
        {
          urls: [
            "turn:relay1.expressturn.com:3478",
            "turn:relay1.expressturn.com:3478?transport=tcp",
            "turns:relay1.expressturn.com:5349"
          ],
          username: "000000002078142511",
          credential: "VZ805jWsN6nlnUxR4wA0r6Uv73Q="
        }
      ]
    };

    const peer = new RTCPeerConnection(config);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { sessionId: sid, candidate: event.candidate });
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("RTC State →", peer.connectionState);

      if (peer.connectionState === "connected") setConnected(true);
      if (peer.connectionState === "disconnected") setConnected(false);
    };

    peer.ondatachannel = (event) => {
      const channel = event.channel;
      const index = Number(channel.label.split("-")[1]);

      lanes.current[index] = channel;

      setupReceiverLane(channel, index);
    };

    return peer;
  }

  // ─────────────────────────────────────────────────────────────
  // Sender: Create 4 DataChannels
  // ─────────────────────────────────────────────────────────────
  function createSenderLanes() {
    for (let i = 0; i < LANE_COUNT; i++) {
      const channel = pc.current.createDataChannel(`lane-${i}`, { ordered: true });
      lanes.current[i] = channel;

      setupSenderLane(channel, i);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Create Offer → Send via Signaling
  // ─────────────────────────────────────────────────────────────
  async function createOffer(sid) {
    const offer = await pc.current.createOffer();
    console.log("offer:",offer)
    await pc.current.setLocalDescription(offer);
    console.log("offer done")
    socket.emit("offer", { sessionId: sid, offer });
  }

  // ─────────────────────────────────────────────────────────────
  // Accept Answer (Receiver sends it)
  // ─────────────────────────────────────────────────────────────
  async function handleAnswer(answer) {
    console.log("answer:",answer)
    await pc.current.setRemoteDescription(answer);
    console.log("answer done")
  }

  // ─────────────────────────────────────────────────────────────
  // Apply ICE Candidates
  // ─────────────────────────────────────────────────────────────
  async function addIceCandidate(candidate) {
    if (pc.current) {
      await pc.current.addIceCandidate(candidate);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Receiver: Accept Offer and Respond with Answer
  // ─────────────────────────────────────────────────────────────
  async function handleOffer(offer, sid) {
    setSessionId(sid);

    pc.current = createPeerConnection(sid);

    await pc.current.setRemoteDescription(offer);

    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    socket.emit("answer", { sessionId: sid, answer });
  }

  // ─────────────────────────────────────────────────────────────
  // Sender Lane Logic (Sending Chunks)
  // ─────────────────────────────────────────────────────────────
  function setupSenderLane(channel, index) {
    channel.onopen = () => {
      console.log(`📤 Lane ${index} READY`);
      sendLaneChunks(index);
    };
  }

  async function sendLaneChunks(laneIndex) {
    const file = fileRef.current;
    console.log("file:",file)

    let offset = laneIndex * CHUNK_SIZE;
    console.log("offset:",offset)

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();

      lanes.current[laneIndex].send(buffer);
      saveChunkMetadata(sessionId, laneIndex, offset / CHUNK_SIZE);

      offset += CHUNK_SIZE * LANE_COUNT;

      // WebRTC Backpressure Handling
      if (lanes.current[laneIndex].bufferedAmount > 5 * CHUNK_SIZE) {
        await new Promise((res) => {
          lanes.current[laneIndex].onbufferedamountlow = () => res();
        });
      }
    }

    lanes.current[laneIndex].send("EOF");
  }

  // ─────────────────────────────────────────────────────────────
  // Receiver Lane Logic (Receiving Chunks)
  // ─────────────────────────────────────────────────────────────
  function setupReceiverLane(channel, index) {
    channel.onopen = async () => {
      if (index === 0) {
        await initLaneFiles(LANE_COUNT, sessionId);
        totalBytesReceivedRef.current = 0;
        completedLanesRef.current = 0;

        nextWriteOffsetRef.current = Array.from({ length: LANE_COUNT }, (_, laneIndex) =>
          laneIndex * CHUNK_SIZE,
        );
      }
    };

    channel.onmessage = async (event) => {
      if (event.data === "EOF") {
        completedLanesRef.current += 1;
        if (completedLanesRef.current === LANE_COUNT) {
          await closeAllLanes();
          const fileHandle = await mergeLanesToFinalFile(
            sessionId,
            fileRef.current.name,
            fileRef.current.size,
          );
          console.log("🎉 File merged and saved:", fileHandle);
        }
        return;
      }

      const buffer = event.data;

      const currentOffsets = nextWriteOffsetRef.current;
      const offset = currentOffsets[index] ?? index * CHUNK_SIZE;
      currentOffsets[index] = offset + CHUNK_SIZE * LANE_COUNT;
      nextWriteOffsetRef.current = currentOffsets;

      await writeChunkToLane(index, offset, buffer);
      saveChunkMetadata(sessionId, index, offset / CHUNK_SIZE);

      totalBytesReceivedRef.current += buffer.byteLength;

      if (progressCallbackRef.current) {
        progressCallbackRef.current(buffer.byteLength);
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Wire Socket Listeners
  // ─────────────────────────────────────────────────────────────
  function attachSocketListeners(sid) {
    socket.on("offer", ({ offer }) => handleOffer(offer, sid));
    socket.on("answer", ({ answer }) => handleAnswer(answer));
    socket.on("ice-candidate", ({ candidate }) => addIceCandidate(candidate));
  }

  return (
    <WebRTCContext.Provider value={{ startWebRTC, connected }}>
      {children}
    </WebRTCContext.Provider>
  );
}
