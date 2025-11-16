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
