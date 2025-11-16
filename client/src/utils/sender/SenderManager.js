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
