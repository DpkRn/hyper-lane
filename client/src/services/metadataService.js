let metadataWorker;

export function initMetadataWorker() {
  metadataWorker = new Worker("/src/workers/metadata.worker.js");
}

export function recordChunk(sessionId, laneIndex, chunkIndex) {
  metadataWorker.postMessage({
    type: "chunk-received",
    sessionId,
    laneIndex,
    chunkIndex
  });
}

export function requestResumeState(sessionId, laneIndex) {
  return new Promise((resolve) => {
    const listener = (event) => {
      if (event.data.type === "resume-state" && 
          event.data.sessionId === sessionId && 
          event.data.laneIndex === laneIndex) {
        
        metadataWorker.removeEventListener("message", listener);
        resolve(event.data);
      }
    };

    metadataWorker.addEventListener("message", listener);

    metadataWorker.postMessage({
      type: "get-resume-state",
      sessionId,
      laneIndex
    });
  });
}

export function flushMetadata() {
  metadataWorker.postMessage({ type: "force-flush" });
}
