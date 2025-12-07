let worker;

export function initMetadataWorker() {
  if (!worker) {
    worker = new Worker(new URL("../workers/metadata.worker.js", import.meta.url), {
      type: "module",
    });
  }
}

export function saveChunkMetadata(sessionId, lane, chunkIndex) {
  if (!worker) return;
  worker.postMessage({ type: "chunk", sessionId, lane, chunkIndex });
}

export function requestResume(sessionId) {
  if (!worker) return Promise.resolve(null);

  return new Promise((resolve) => {
    const handler = (e) => {
      if (e.data.type === "resume-data") {
        worker.removeEventListener("message", handler);
        resolve(e.data);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "resume-request", sessionId });
  });
}
