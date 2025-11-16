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
