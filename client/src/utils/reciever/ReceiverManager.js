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

async function resumeDownload() {
  const meta = await loadMeta(fileId);

  const receiver = new ReceiverManager(peer, meta.fileId, dirHandle);
  await receiver.prepare();
  await receiver.start(); // lanes continue from old offset

  console.log("Resumed!");
}

