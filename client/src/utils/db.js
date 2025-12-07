import { openDB } from "idb";

export const getDB = () => {
  return openDB("webrtc-multi-lane", 2, {
    upgrade(db) {
      // v1: sessions store
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "sessionId" });
        s.createIndex("fileId", "fileId");
      }

      // v2: chunks store for resume metadata
      if (!db.objectStoreNames.contains("chunks")) {
        const c = db.createObjectStore("chunks", {
          keyPath: ["sessionId", "lane", "chunkIndex"],
        });
        c.createIndex("bySession", "sessionId");
      }
    },
  });
};

export async function createSession(sessionId, fileInfo) {
  const db = await getDB();
  await db.put("sessions", {
    sessionId,
    fileId: fileInfo.name,
    fileInfo,
    lanes: {},
  });
}

export async function saveLaneState(sessionId, laneIndex, laneState) {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);
  session.lanes[laneIndex] = laneState;
  await db.put("sessions", session);
}

export async function updateChunkReceived(sessionId, laneIndex, chunkId) {
  const db = await getDB();
  const session = await db.get("sessions", sessionId);

  session.lanes[laneIndex].receivedChunks.add(chunkId);
  await db.put("sessions", session);
}

export async function loadSession(sessionId) {
  const db = await getDB();
  return db.get("sessions", sessionId);
}

export async function deleteSession(sessionId) {
  const db = await getDB();
  await db.delete("sessions", sessionId);
}
