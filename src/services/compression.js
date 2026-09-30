export async function gzipJSON(value) {
  const text = JSON.stringify(value);
  if (!('CompressionStream' in globalThis)) return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function gunzipJSON(blob) {
  if (!('DecompressionStream' in globalThis)) throw new Error('This browser cannot open compressed Notevora backups. Import the .json backup instead.');
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
