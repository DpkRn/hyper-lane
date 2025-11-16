import React, { createContext, useContext, useEffect, useRef } from "react";
import { createPeer } from "../webrtc/createConnection";
import { useSocket } from "./SocketProvider";

const WebRTCContext = createContext(null);

export function WebRTCProvider({ children }) {
  const socket = useSocket();
  const peer = useRef(null);
  const channels = useRef({}); // laneId → channel object

  useEffect(() => {
    peer.current = createPeer();

    peer.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("candidate", {
          roomId: window.roomId,
          candidate: e.candidate
        });
      }
    };

    peer.current.ondatachannel = (e) => {
      channels.current[e.channel.label] = e.channel;
    };
  }, []);

  return (
    <WebRTCContext.Provider value={{ peer: peer.current, channels }}>
      {children}
    </WebRTCContext.Provider>
  );
}

export const useWebRTC = () => useContext(WebRTCContext);
