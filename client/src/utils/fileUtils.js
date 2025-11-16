export async function divideIntoSlices(file, laneCount) {
  const sliceSize = Math.ceil(file.size / laneCount);
  const slices = [];

  for (let i = 0; i < laneCount; i++) {
    slices.push({
      start: i * sliceSize,
      end: Math.min(file.size, (i + 1) * sliceSize),
    });
  }

  return slices;
}

export async function openWritableFile(name) {
  const handle = await showSaveFilePicker({
    suggestedName: name,
  });
  return { handle, writable: await handle.createWritable() };
}
