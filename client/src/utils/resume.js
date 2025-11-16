export function getMissingChunks(laneState) {
  const missing = [];
  for (let i = 0; i < laneState.totalChunks; i++) {
    if (!laneState.receivedChunks.has(i)) missing.push(i);
  }
  return missing;
}
