import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketProvider";
import { useWebRTC } from "./WebRTCProvider";
import { requestResume } from "../services/metadataService";
import { useLocation } from "react-router-dom";


const TransferContext = createContext(null);
export const useTransfer = () => useContext(TransferContext);

export function TransferProvider({ children }) {
  const socket = useSocket();
  const { startWebRTC, connected } = useWebRTC();

  // STATE
  const [status, setStatus] = useState("idle"); 
  const [sessionId, setSessionId] = useState(null);
  const [isSender, setIsSender] = useState(false);
  const [receiverJoined, setReceiverJoined] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);

  const [progress, setProgress] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);

  const lastBytesRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const totalBytesTransferred = useRef(0);
  const expectedSize = useRef(0);


  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("session");

  if (sid) {
    // This device is receiver 
    setSessionId(sid);
    setIsReceiver(true);
    socket.emit("join-room", { sessionId: sid });
  }
}, [socket.ready]);
  // ───────────────────────────────────────────────
  // SEND FILE INFO WHEN RECEIVER JOINS
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket.ready) return;

    socket.on("peer-joined", () => {
      setReceiverJoined(true);

      if (isSender && fileInfo) {
        socket.emit("file-info", { sessionId, ...fileInfo });
      }
    });

    socket.on("file-info", (data) => {
      setFileInfo({
        name: data.name,
        type: data.type,
        size: data.size
      });
    });

  }, [socket.ready, fileInfo, isSender, sessionId]);

  // ───────────────────────────────────────────────
  // DOWNLOAD BUTTON → START NEGOTIATION
  // ───────────────────────────────────────────────
  function startDownload() {
    setStatus("negotiating");
    startWebRTC(null, sessionId, "receiver");

    // ask sender to re-send resume metadata
    socket.emit("resume-request", { sessionId });
  }

  // ───────────────────────────────────────────────
  // RESUME LOGIC
  // ───────────────────────────────────────────────
  useEffect(() => {
    socket.on("resume-request", async () => {
      if (!isSender) return;

      const state = await requestResume(sessionId);
      socket.emit("resume-response", { sessionId, lanes: state });
    });
  }, [isSender, sessionId]);

  // ───────────────────────────────────────────────
  // HANDLE RESUME RESPONSE FROM PEER
  // ───────────────────────────────────────────────
  useEffect(() => {
    socket.on("resume-response", ({ lanes }) => {
      console.log("📦 Resume data from sender:", lanes);
      // TODO: instruct WebRTC to resume lanes missing chunks
    });
  }, []);

  // ───────────────────────────────────────────────
  // SPEED + ETA ESTIMATOR
  // ───────────────────────────────────────────────
  function updateTransferStats(bytesReceived) {
    totalBytesTransferred.current += bytesReceived;

    const now = Date.now();
    const timeDiff = now - lastUpdateRef.current;

    if (timeDiff >= 1000) {
      const diffBytes = totalBytesTransferred.current - lastBytesRef.current;
      const mbps = (diffBytes / timeDiff) * 1000 / (1024 * 1024);

      setSpeedMbps(mbps.toFixed(2));

      const remaining = expectedSize.current - totalBytesTransferred.current;
      setEtaSeconds(remaining / (diffBytes / timeDiff) / 1000);

      lastBytesRef.current = totalBytesTransferred.current;
      lastUpdateRef.current = now;
    }

    const progressPercent = (totalBytesTransferred.current / expectedSize.current) * 100;
    setProgress(progressPercent.toFixed(2));
  }

  // ───────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────
  function startSender(file) {
    const sid = Math.random().toString(36).substring(7);
    setSessionId(sid);
    setIsSender(true);

    expectedSize.current = file.size;
    setFileInfo({ name: file.name, size: file.size, type: file.type });

    socket.emit("join-room", { sessionId: sid });
  }

  function startTransfer() {
    if (!connected) return;
    setStatus("transferring");
    startWebRTC(fileInfo, sessionId, "sender");
  }

  function pause() {
    setStatus("paused");
    // TODO: notify WebRTC lanes
  }

  function resume() {
    setStatus("transferring");
    // TODO: resume lanes logic
  }

  function cancel() {
    // TODO: cleanup logic
  }

  return (
    <TransferContext.Provider value={{
      status,
      progress,
      speedMbps,
      etaSeconds,
      sessionId,
      fileInfo,
      receiverJoined,
      startSender,
      startTransfer,
      startDownload,
      pause,
      resume,
      cancel
    }}>
      {children}
    </TransferContext.Provider>
  );
}
