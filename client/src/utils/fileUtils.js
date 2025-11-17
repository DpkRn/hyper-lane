const CHUNK_SIZE = 64 * 1024;

let directoryHandle = null;
let laneHandles = [];
let writeStreams = [];
let mergedFileHandle = null;

export function setSaveDirectory(handle) {
  directoryHandle = handle;
}

export async function initLaneFiles(laneCount, sessionId) {
  laneHandles = [];
  writeStreams = [];

  for (let i = 0; i < laneCount; i++) {
    const tempName = `${sessionId}-lane-${i}.tmp`;
    const fileHandle = await directoryHandle.getFileHandle(tempName, { create: true });

    const writable = await fileHandle.createWritable();
    laneHandles.push(fileHandle);
    writeStreams.push(writable);
  }
}

export async function writeChunkToLane(laneIndex, offset, buffer) {
  // Write directly to correct position
  await writeStreams[laneIndex].write({
    type: "write",
    position: offset,
    data: buffer
  });
}

export async function closeAllLanes() {
  for (const ws of writeStreams) {
    await ws.close();
  }
}

export async function mergeLanesToFinalFile(sessionId, filename, fileSize) {
  const finalName = `${filename}`;
  mergedFileHandle = await directoryHandle.getFileHandle(finalName, { create: true });
  const writable = await mergedFileHandle.createWritable();

  const chunkCount = Math.ceil(fileSize / CHUNK_SIZE);

  for (let globalChunkIndex = 0; globalChunkIndex < chunkCount; globalChunkIndex++) {
    const laneIndex = globalChunkIndex % laneHandles.length;
    const file = await laneHandles[laneIndex].getFile();
    const buffer = await file.slice(globalChunkIndex * CHUNK_SIZE, (globalChunkIndex + 1) * CHUNK_SIZE).arrayBuffer();

    await writable.write(new Uint8Array(buffer));
  }

  await writable.close();
  cleanupTempFiles();
  return mergedFileHandle;
}

async function cleanupTempFiles() {
  for (let i = 0; i < laneHandles.length; i++) {
    const name = laneHandles[i].name;
    await directoryHandle.removeEntry(name);
  }
}
