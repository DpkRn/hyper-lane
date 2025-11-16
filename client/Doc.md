/src
  /utils
    laneUtils.js
    idb.js
    backpressure.js
  /webrtc
    createConnection.js
    signaling.js
  /sender
    SenderLane.js
    SenderManager.js
  /receiver
    ReceiverLane.js
    ReceiverManager.js




📌 utils/idb.js (Upgraded)
const DB_NAME = "multiLaneFileDB";
const STORE = "fileMeta";

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileId" });
      } else {
        const store = req.transaction.objectStore(STORE);

        // Add new fields if updating DB
        if (!store.indexNames.contains("lanes")) {
          // auto-handled when saving
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

export async function saveMeta(meta) {
  const db = await openDB();
  db.transaction(STORE, "readwrite").objectStore(STORE).put(meta);
}

export async function loadMeta(fileId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(fileId);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function updateLaneProgress(fileId, laneId, received, done = false) {
  const meta = await loadMeta(fileId);
  const lane = meta.lanes[laneId];
  lane.received = received;
  if (done) lane.isComplete = true;

  await saveMeta(meta);
}


📌 utils/laneUtils.js (Slice Calculations)
export function splitIntoLanes(fileSize, laneCount) {
  const laneSize = Math.ceil(fileSize / laneCount);

  const lanes = [];
  let start = 0;

  for (let i = 0; i < laneCount; i++) {
    const end = Math.min(start + laneSize, fileSize);
    lanes.push({ laneId: i, start, end });
    start = end;
  }

  return lanes;
}



utils/backpressure.js (WebRTC Backpressure Helper)
export function waitForLowBuffer(dc, threshold = 256 * 1024) {
  return new Promise(resolve => {
    if (dc.bufferedAmount < threshold) {
      return resolve();
    }
    const handler = () => {
      if (dc.bufferedAmount < threshold) {
        dc.removeEventListener("bufferedamountlow", handler);
        resolve();
      }
    };
    dc.addEventListener("bufferedamountlow", handler);
  });
}


📌 webrtc/createConnection.js
export function createPeer() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
}


📌 webrtc/signaling.js

You already have your signaling (socket.io or ws).
Just fill these functions with your existing logic.

export async function sendOffer(socket, roomId, offer) {
  socket.emit("offer", { roomId, offer });
}

export async function sendAnswer(socket, roomId, answer) {
  socket.emit("answer", { roomId, answer });
}

export function sendCandidate(socket, roomId, candidate) {
  socket.emit("candidate", { roomId, candidate });
}



📌 sender/SenderLane.js (One Lane = One Range Stream)
import { waitForLowBuffer } from "../utils/backpressure";

export class SenderLane {
  constructor(file, lane, dataChannel) {
    this.file = file;
    this.lane = lane;
    this.dc = dataChannel;
  }

  async send() {
    const realStart = this.lane.start + (this.lane.received || 0);
    const realEnd = this.lane.end;

    const slice = this.file.slice(realStart, realEnd);
    const stream = slice.stream();

    await stream.pipeTo(new WritableStream({
      write: async chunk => {
        this.dc.send(chunk);
        await waitForLowBuffer(this.dc);
      }
    }));

    this.dc.send(JSON.stringify({ laneDone: this.lane.laneId }));
  }
}



📌 sender/SenderManager.js
import { splitIntoLanes } from "../utils/laneUtils.js";
import { saveMeta } from "../utils/idb.js";
import { SenderLane } from "./SenderLane.js";

export class SenderManager {
  constructor(peer, file, laneCount = 4) {
    this.peer = peer;
    this.file = file;
    this.fileId = crypto.randomUUID();
    this.laneCount = laneCount;

    this.dc = [];
  }

  async prepare() {
    const lanes = splitIntoLanes(this.file.size, this.laneCount);

    const meta = {
      fileId: this.fileId,
      fileName: this.file.name,
      totalSize: this.file.size,
      lanes
    };

    await saveMeta(meta);

    // Create lane channels
    lanes.forEach((lane, i) => {
      const dc = this.peer.createDataChannel(`lane-${i}`);
      this.dc[i] = dc;
    });

    return meta;
  }

  async start() {
    const meta = await saveMeta;

    meta.lanes.forEach((lane, i) => {
      const senderLane = new SenderLane(this.file, lane, this.dc[i]);
      senderLane.send();
    });
  }
}



📌 receiver/ReceiverLane.js
import { updateLaneProgress } from "../utils/idb.js";

export class ReceiverLane {
  constructor(dirHandle, fileId, laneInfo, dataChannel) {
    this.dirHandle = dirHandle;
    this.fileId = fileId;
    this.lane = laneInfo;
    this.dc = dataChannel;
  }

  async start() {
    const tempName = `lane-${this.lane.laneId}.tmp`;

    // create or reopen temp
    this.tempHandle = await this.dirHandle.getFileHandle(tempName, { create: true });

    this.writable = await this.tempHandle.createWritable({
      keepExistingData: true // <-- IMPORTANT FOR RESUME
    });

    this.received = this.lane.received || 0;

    this.dc.onmessage = async evt => {
      if (typeof evt.data === "string") {
        const msg = JSON.parse(evt.data);

        if (msg.laneDone === this.lane.laneId) {
          await this.writable.close();
          await updateLaneProgress(this.fileId, this.lane.laneId, this.received, true);
          this.onComplete?.();
        }
        return;
      }

      await this.writable.write(evt.data);
      this.received += evt.data.byteLength;

      updateLaneProgress(this.fileId, this.lane.laneId, this.received);
    };
  }
}




📌 receiver/ReceiverManager.js
import { loadMeta } from "../utils/idb.js";
import { ReceiverLane } from "./ReceiverLane.js";

export class ReceiverManager {
  constructor(peer, fileId, directoryHandle) {
    this.peer = peer;
    this.fileId = fileId;
    this.dirHandle = directoryHandle;
    this.lanes = [];
  }

  async prepare() {
    const meta = await loadMeta(this.fileId);
    this.meta = meta;

    meta.lanes.forEach((lane, i) => {
      const dc = this.peer.dataChannel(`lane-${i}`);
      const laneObj = new ReceiverLane(
        this.dirHandle,
        this.fileId,
        lane,
        dc
      );
      this.lanes.push(laneObj);
    });

    return meta;
  }

  async start() {
    this.lanes.forEach(lane => lane.start());
  }

  async merge(finalHandle) {
    const writable = await finalHandle.createWritable();

    for (let lane of this.meta.lanes) {
      const tempFile = await this.dirHandle.getFileHandle(
        `lane-${lane.laneId}.tmp`
      );

      const file = await tempFile.getFile();
      const stream = file.stream();

      await stream.pipeTo(writable, { preventClose: true });
    }

    await writable.close();
  }
}
