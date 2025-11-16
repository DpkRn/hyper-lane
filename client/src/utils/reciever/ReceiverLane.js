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
