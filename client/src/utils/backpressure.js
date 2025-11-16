export function waitForLowBuffer(dc, threshold = 256 * 1024) {
  return new Promise(resolve => {
    if (dc.bufferedAmount < threshold) {
      return resolve();
    }
    const handler = () => {
      if (dc.bufferedAmount < threshold) {
        dc.removeEventListener("bufferedamountlow", handler);
        resolve();
      }
    };
    dc.addEventListener("bufferedamountlow", handler);
  });
}
