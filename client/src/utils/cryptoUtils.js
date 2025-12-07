// cryptoUtils.js

export async function generateAESKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptChunk(key, chunk, iv) {
  return crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    chunk,
  );
}

export async function decryptChunk(key, encrypted, iv) {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted,
  );
}

export function createHasher() {
  return {
    chunks: [],
    update(chunk) {
      this.chunks.push(chunk);
    },
    async digest() {
      const blob = new Blob(this.chunks);
      const buffer = await blob.arrayBuffer();
      return crypto.subtle.digest("SHA-256", buffer);
    },
  };
}

export function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
