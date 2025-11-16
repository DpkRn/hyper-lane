importScripts("/src/utils/db.js"); // IMPORTANT: path may vary depending bundler

const CACHE = {}; 
let lastFlush = Date.now();
const BATCH_SIZE = 30;
const FLUSH_INTERVAL = 500; // ms

self.onmessage = async (event) => {
  const { type, sessionId, laneIndex, chunkIndex } = event.data;

  switch (type) {

    case "chunk-received":
      trackChunk(sessionId, laneIndex, chunkIndex);
      break;

    case "get-resume-state":
      const result = await getResumeState(sessionId, laneIndex);
      self.postMessage({ type: "resume-state", sessionId, laneIndex, ...result });
      break;

    case "force-flush":
      await flushToDB();
      self.postMessage({ type: "flushed" });
      break;
  }
};

/** Cache chunks then flush in batches */
function trackChunk(sessionId, laneIndex, chunkIndex) {
  if (!CACHE[sessionId]) CACHE[sessionId] = {};
  if (!CACHE[sessionId][laneIndex]) CACHE[sessionId][laneIndex] = [];

  CACHE[sessionId][laneIndex].push(chunkIndex);

  const shouldFlush =
    CACHE[sessionId][laneIndex].length >= BATCH_SIZE ||
    Date.now() - lastFlush > FLUSH_INTERVAL;

  if (shouldFlush) flushToDB();
}

async function flushToDB() {
  lastFlush = Date.now();
  const db = await getDB();

  for (let sessionId in CACHE) {
    for (let laneIndex in CACHE[sessionId]) {
      const chunks = CACHE[sessionId][laneIndex];

      for (let chunkIndex of chunks) {
        // delete missing chunk entry if exists
        await db.delete("chunks", [sessionId, Number(laneIndex), chunkIndex]);

        // update lane metadata
        const lane = await db.get("lanes", [sessionId, Number(laneIndex)]);
        lane.receivedChunks++;
        lane.nextChunkIndex = chunkIndex + 1;
        await db.put("lanes", lane);
      }

      CACHE[sessionId][laneIndex] = [];
    }
  }
}

async function getResumeState(sessionId, laneIndex) {
  const db = await getDB();
  const lane = await db.get("lanes", [sessionId, laneIndex]);
  const pending = (await db.getAllFromIndex("chunks", "byLane", [sessionId, laneIndex]))
    .map(c => c.chunkIndex);

  return {
    nextChunkIndex: lane.nextChunkIndex,
    missingChunks: pending
  };
}
