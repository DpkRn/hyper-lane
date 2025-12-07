/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketProvider";
import { useWebRTC } from "./WebRTCProvider";
import { requestResume } from "../services/metadataService";

const TransferContext = createContext(null);
export const useTransfer = () => useContext(TransferContext);

export function TransferProvider({ children }) {
  const socket = useSocket();
  const { startWebRTC, connected } = useWebRTC();

  // STATE
  const [status, setStatus] = useState("idle");
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("session");
  });
  const [isSender, setIsSender] = useState(false);
  const [receiverJoined, setReceiverJoined] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);

  const [progress, setProgress] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);

  const lastBytesRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const totalBytesTransferred = useRef(0);
  const expectedSize = useRef(0);

  // Detect receiver based on URL param and join room
  useEffect(() => {
    if (!socket?.ready || !sessionId) return;

    socket.emit("join-room", { sessionId });
  }, [socket.ready, sessionId]);

  // ───────────────────────────────────────────────
  // SEND FILE INFO WHEN RECEIVER JOINS
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket.ready) return;

    const handlePeerJoined = () => {
      setReceiverJoined(true);

      if (isSender && fileInfo) {
        socket.emit("file-info", { sessionId, ...fileInfo });
      }
    };

    const handleFileInfo = (data) => {
      setFileInfo({
        name: data.name,
        type: data.type,
        size: data.size,
      });
    };

    socket.on("peer-joined", handlePeerJoined);
    socket.on("file-info", handleFileInfo);

    return () => {
      socket.off("peer-joined", handlePeerJoined);
      socket.off("file-info", handleFileInfo);
    };
  }, [socket.ready, fileInfo, isSender, sessionId, socket]);

  // ───────────────────────────────────────────────
  // DOWNLOAD BUTTON → START NEGOTIATION
  // ───────────────────────────────────────────────
  function startDownload() {
    if (!sessionId || !fileInfo) return;

    resetTransferStats(fileInfo.size);
    setStatus("negotiating");

    startWebRTC(null, sessionId, "receiver", updateTransferStats);

    // ask sender to re-send resume metadata
    socket.emit("resume-request", { sessionId });
  }

  // ───────────────────────────────────────────────
  // RESUME LOGIC
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket.ready) return;

    const handler = async () => {
      if (!isSender) return;

      const state = await requestResume(sessionId);
      socket.emit("resume-response", { sessionId, lanes: state });
    };

    socket.on("resume-request", handler);
    return () => {
      socket.off("resume-request", handler);
    };
  }, [isSender, sessionId, socket]);

  // ───────────────────────────────────────────────
  // HANDLE RESUME RESPONSE FROM PEER
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket.ready) return;

    const handler = ({ lanes }) => {
      console.log("📦 Resume data from sender:", lanes);
      // TODO: instruct WebRTC to resume lanes missing chunks
    };

    socket.on("resume-response", handler);
    return () => {
      socket.off("resume-response", handler);
    };
  }, [socket]);

  // ───────────────────────────────────────────────
  // SPEED + ETA ESTIMATOR
  // ───────────────────────────────────────────────
  function resetTransferStats(totalSize) {
    totalBytesTransferred.current = 0;
    lastBytesRef.current = 0;
    lastUpdateRef.current = 0;
    expectedSize.current = totalSize;
    setProgress(0);
    setSpeedMbps(0);
    setEtaSeconds(null);
  }

  function updateTransferStats(bytesReceived) {
    totalBytesTransferred.current += bytesReceived;

    if (!expectedSize.current) return;

    const now = Date.now();

    if (lastUpdateRef.current === 0) {
      lastUpdateRef.current = now;
      lastBytesRef.current = totalBytesTransferred.current;
    }

    const timeDiff = now - lastUpdateRef.current;

    if (timeDiff >= 1000) {
      const diffBytes = totalBytesTransferred.current - lastBytesRef.current;
      const mbps = (diffBytes / timeDiff) * 1000 / (1024 * 1024);

      setSpeedMbps(mbps.toFixed(2));

      const remaining = expectedSize.current - totalBytesTransferred.current;
      const bytesPerMs = diffBytes / timeDiff || 0;
      setEtaSeconds(bytesPerMs ? remaining / bytesPerMs / 1000 : null);

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

    resetTransferStats(file.size);
    setFileInfo({ name: file.name, size: file.size, type: file.type });

    socket.emit("join-room", { sessionId: sid });
  }

  function startTransfer() {
    if (!connected || !fileInfo || !sessionId) return;

    setStatus("transferring");
    startWebRTC(fileInfo, sessionId, "sender", updateTransferStats);
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
    <TransferContext.Provider
      value={{
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
        cancel,
      }}
    >
      {children}
    </TransferContext.Provider>
  );
}
