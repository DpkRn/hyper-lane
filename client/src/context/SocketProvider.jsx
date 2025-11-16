import React, { createContext, useContext, useRef, useEffect } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

export default function SocketProvider({ children }) {
  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = io("http://localhost:8000");
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}
