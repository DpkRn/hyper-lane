importScripts("/src/utils/db.js");

let buffer = [];
const FLUSH_SIZE = 20;

self.onmessage = async ({ data }) => {
  if (data.type === "chunk") {
    buffer.push(data);

    if (buffer.length >= FLUSH_SIZE) {
      await flush();
    }
  }

  if (data.type === "resume-request") {
    const result = await getResumeState(data.sessionId);
    self.postMessage({ type: "resume-data", ...result });
  }
};

async function flush() {
  const db = await getDB();

  for (const entry of buffer) {
    await db.put("chunks", entry);
  }

  buffer = [];
}

async function getResumeState(sessionId) {
  const db = await getDB();
  const all = await db.getAllFromIndex("chunks", "bySession", sessionId);

  return {
    receivedChunks: all.map(c => c.chunkIndex)
  };
}
