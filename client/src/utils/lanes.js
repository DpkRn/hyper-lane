export function createLaneStates(fileSize, slices, chunkSize) {
  return slices.map((slice, i) => {
    const totalChunks = Math.ceil((slice.end - slice.start) / chunkSize);
    return {
      laneIndex: i,
      start: slice.start,
      end: slice.end,
      chunkSize,
      totalChunks,
      receivedChunks: new Set(),
      completed: false,
    };
  });
}

export function createDataChannel(pc, laneIndex, lanes) {
  const ch = pc.createDataChannel("lane-" + laneIndex);
  lanes[laneIndex].channel = ch;
  return ch;
}

export function assignChannelToLane(pc, lanes) {
  pc.ondatachannel = (e) => {
    const laneIndex = Number(e.channel.label.split("-")[1]);
    lanes[laneIndex].channel = e.channel;
  };
}
