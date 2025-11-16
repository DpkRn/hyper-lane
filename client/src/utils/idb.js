const DB_NAME = "multiLaneFileDB";
const STORE = "fileMeta";

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileId" });
      } else {
        const store = req.transaction.objectStore(STORE);

        // Add new fields if updating DB
        if (!store.indexNames.contains("lanes")) {
          // auto-handled when saving
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

export async function saveMeta(meta) {
  const db = await openDB();
  db.transaction(STORE, "readwrite").objectStore(STORE).put(meta);
}

export async function loadMeta(fileId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(fileId);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function updateLaneProgress(fileId, laneId, received, done = false) {
  const meta = await loadMeta(fileId);
  const lane = meta.lanes[laneId];
  lane.received = received;
  if (done) lane.isComplete = true;

  await saveMeta(meta);
}
