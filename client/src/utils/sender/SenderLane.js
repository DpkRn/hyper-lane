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
