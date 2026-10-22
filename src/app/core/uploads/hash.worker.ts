/// <reference lib="webworker" />
import { sha256 } from '@noble/hashes/sha2.js';

addEventListener('message', async ({ data }: MessageEvent<File>) => {
  try {
    const hash = sha256.create();
    for (let offset = 0; offset < data.size; offset += 4 * 1024 ** 2) {
      hash.update(new Uint8Array(await data.slice(offset, offset + 4 * 1024 ** 2).arrayBuffer()));
      postMessage({ progress: Math.min(1, (offset + 4 * 1024 ** 2) / data.size) });
    }
    postMessage({
      checksum: Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    });
  } catch {
    postMessage({ error: 'Could not read this file.' });
  }
});
