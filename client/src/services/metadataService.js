let worker;

export function initMetadataWorker() {
  worker = new Worker("/src/workers/metadata.worker.js");
}

export function saveChunkMetadata(sessionId, lane, chunkIndex) {
  worker.postMessage({ type: "chunk", sessionId, lane, chunkIndex });
}

export function requestResume(sessionId) {
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
