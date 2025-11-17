import { createContext, useContext, useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SERVER_URL = "http://localhost:5000";
const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    socketRef.current = io(SERVER_URL, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("🟢 Socket connected");
      setReady(true);
    });

    return () => socketRef.current.disconnect();
  }, []);

  const emit = (event, data) => socketRef.current.emit(event, data);
  const on = (event, cb) => socketRef.current.on(event, cb);

  return (
    <SocketContext.Provider value={{ ready, emit, on }}>
      {children}
    </SocketContext.Provider>
  );
}
