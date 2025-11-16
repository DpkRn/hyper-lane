import { SocketProvider } from "./context/SocketProvider";
import { WebRTCProvider } from "./context/WebRTCProvider";
import Sender from "./components/Sender";
import Receiver from "./components/Receiver";

function App() {
  return (
    <SocketProvider>
      <WebRTCProvider>
        <Sender />
        <Receiver />
      </WebRTCProvider>
    </SocketProvider>
  );
}

export default App;
