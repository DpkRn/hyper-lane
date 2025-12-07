import {SocketProvider}  from "./context/SocketProvider.jsx";
import {WebRTCProvider}  from "./context/WebRTCProvider.jsx";
import Sender from "./components/Sender";
import Receiver from "./components/Receiver";
import {BrowserRouter,Routes,Route} from "react-router-dom" 

function App() {
  return (

    <SocketProvider>
      <WebRTCProvider>
        <BrowserRouter>
        <Routes>

       <Route path='/' element={<Sender/>}/>
       <Route path='/receiver' element={<Receiver/>}/>

         </Routes>
         </BrowserRouter>
      </WebRTCProvider>
    </SocketProvider>
  );
}

export default App;
