# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This repo implements a browser-based, multi-lane, resumable peer‑to‑peer file transfer using WebRTC data channels and a Socket.IO signaling server.

- `client/`: React + Vite single-page app that provides sender/receiver UIs, manages WebRTC connections, and handles multi-lane file slicing/merging and resume metadata.
- `server/`: Node.js + Express + Socket.IO signaling server. It manages per-session rooms and relays offers/answers, ICE candidates, and resume messages between peers.

### High-Level Data Flow

1. **Session creation (sender)**
   - `Sender` UI (`client/src/components/Sender.jsx`) lets the user pick a file.
   - `TransferProvider` (`client/src/context/TransferProvider.jsx`) generates a `sessionId`, marks this peer as sender, stores `fileInfo`, and joins a Socket.IO room identified by that `sessionId`.
   - A share link is generated as `https://<origin>/?session=<sessionId>` and shown in the Sender UI.

2. **Receiver join & metadata exchange**
   - When a receiver opens the link, `TransferProvider` reads `session` from `window.location.search`, treats this peer as receiver, and joins the same room.
   - The server (`server/server.js`) emits `peer-joined` to the sender; the sender responds with `file-info` (name, size, type).
   - The receiver displays this metadata in `Receiver.jsx` and can start the download.

3. **WebRTC setup & multi-lane channels**
   - `SocketProvider` (`client/src/context/SocketProvider.jsx`) wraps `socket.io-client` and exposes `emit`/`on` against `http://localhost:5000`.
   - `WebRTCProvider` (`client/src/context/WebRTCProvider.jsx`) owns a single `RTCPeerConnection` and an array of RTCDataChannels ("lanes").
     - `LANE_COUNT` and `CHUNK_SIZE` are defined near the top of `WebRTCProvider` and in `client/src/utils/constants.js`.
     - For the sender role, it pre-creates `LANE_COUNT` ordered data channels (`lane-0` … `lane-3`) and immediately starts chunking and sending data over each lane.
     - For the receiver role, it listens to `ondatachannel` and wires each incoming channel index to lane-specific handlers.
   - Signaling messages (`offer`, `answer`, `ice-candidate`) are sent over Socket.IO:
     - Client: via `socket.emit(...)` from `WebRTCProvider.attachSocketListeners` and `handleOffer`/`handleAnswer`/`addIceCandidate`.
     - Server: in `server/server.js`, each event is relayed to peers in the same `sessionId` room.

4. **Chunking, backpressure, and writing to disk**
   - The sender walks the file in an interleaved pattern per lane so that each lane sends every N‑th chunk: offset starts at `laneIndex * CHUNK_SIZE` and increments by `CHUNK_SIZE * LANE_COUNT`.
   - Basic backpressure handling is implemented by checking `dataChannel.bufferedAmount` and awaiting `onbufferedamountlow` when it exceeds a threshold.
   - On the receiver side, each lane writes chunks to a lane-specific temporary file via `client/src/utils/fileUtils.js`:
     - `setSaveDirectory(handle)` sets a directory-level handle using the File System Access API.
     - `initLaneFiles(laneCount, sessionId)` creates per-lane temp files like `<sessionId>-lane-0.tmp` and opens write streams.
     - `writeChunkToLane(laneIndex, offset, buffer)` writes directly at the correct offset within the lane file.
     - After all lanes send an `EOF` marker, `mergeLanesToFinalFile(sessionId, filename, fileSize)` merges the temp lane files into a final file in chunk order, then cleans up temp files.

5. **Resume metadata & background worker**
   - `client/src/services/metadataService.js` initializes a `metadata.worker.js` Web Worker and sends metadata messages for each chunk (`sessionId`, `lane`, `chunkIndex`).
   - `client/src/workers/metadata.worker.js` is responsible for batching these updates and persisting them using IndexedDB via functions imported from `client/src/utils/db.js`.
   - `client/src/utils/db.js` wraps `idb` to manage a `"webrtc-multi-lane"` database and a `sessions` object store for high-level session state (file info, per-lane state).
   - `TransferProvider` coordinates resume orchestration at the signaling layer using `resume-request` and `resume-response` messages over Socket.IO; code paths for fully resuming transfers are partially implemented and marked with TODOs.

6. **UI & routing**
   - `client/src/main.jsx` renders `App` into `#root`.
   - `client/src/App.jsx` composes providers and routes:
     - `SocketProvider` → `WebRTCProvider` → `BrowserRouter` routes.
     - `/` renders `Sender` and `/receiver` renders `Receiver`.
   - `Sender.jsx` and `Receiver.jsx` are high-level components that consume the `TransferProvider` state (progress, speed, ETA, status) and drive user actions (start, pause, resume, cancel).

## Commands & Development Workflow

### Client (React + Vite)

From the repo root:

```bash path=null start=null
cd client
npm install
```

Common scripts:

- Run dev server (default Vite port):
  ```bash path=null start=null
  cd client
  npm run dev
  ```
- Build production bundle:
  ```bash path=null start=null
  cd client
  npm run build
  ```
- Preview built bundle with Vite:
  ```bash path=null start=null
  cd client
  npm run preview
  ```
- Lint the client codebase (ESLint flat config with React hooks & React Refresh):
  ```bash path=null start=null
  cd client
  npm run lint
  ```

Tests are not currently configured for the client (no Jest/Vitest setup or `test` script).

### Server (Node + Express + Socket.IO)

From the repo root:

```bash path=null start=null
cd server
npm install
```

Scripts:

- Start signaling server with hot reload (requires `nodemon`, already in dependencies):
  ```bash path=null start=null
  cd server
  npm run dev
  ```
- Start signaling server with plain Node:
  ```bash path=null start=null
  cd server
  npm start
  ```

The server listens on port `5000` (see `server/server.js`), and the client connects via `socket.io-client` to `http://localhost:5000` (see `client/src/context/SocketProvider.jsx`). Run the server before the client dev server so WebRTC negotiation has a signaling path.

## Architecture Notes for Future Changes

- **WebRTC behavior**: Centralized in `WebRTCProvider`. To change lane count, chunk size, or backpressure thresholds, update `LANE_COUNT` / `CHUNK_SIZE` and the sending/receiving logic there and in `client/src/utils/constants.js` / `client/src/utils/fileUtils.js`.
- **Signaling protocol**: If you modify or extend the signaling messages, you must update both:
  - client handlers in `WebRTCProvider` and `TransferProvider` (all `socket.on` / `socket.emit` calls), and
  - server event relays in `server/server.js`.
- **Resume implementation**: Resume is split between three layers:
  - WebRTC lanes (what chunks are actually sent/received),
  - worker + IndexedDB (what chunks have been persisted), and
  - signaling (`resume-request` / `resume-response`).
  When changing resume behavior, verify all three stay in sync.
- **File system access**: The receiver path relies on the File System Access API (`FileSystemDirectoryHandle`, `createWritable`, etc.) in `client/src/utils/fileUtils.js`. Any browser/platform constraints or permission prompts will surface here; changes to where/how files are saved should go through this utility first.
