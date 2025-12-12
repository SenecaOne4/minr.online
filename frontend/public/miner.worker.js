// Fast SHA256 implementation for Web Worker
// Based on optimized SHA256 algorithm

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x6f6c7067,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(message) {
  const msgLength = message.length;
  const msgBitLength = msgLength * 8;
  
  // Pre-processing
  let padded = new Uint8Array(((msgLength + 9 + 63) & ~63));
  padded.set(message);
  padded[msgLength] = 0x80;
  
  // Append length (big-endian)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(msgBitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, msgBitLength & 0xffffffff, false);
  
  // Initialize hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  
  // Process message in 512-bit chunks
  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const w = new Uint32Array(64);
    
    // Copy chunk into first 16 words
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunkStart + i * 4, false);
    }
    
    // Extend the first 16 words into the remaining 48 words
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    
    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    
    // Main loop
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    
    // Add compressed chunk to hash
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  
  // Produce final hash value
  const hash = new Uint8Array(32);
  const hashView = new DataView(hash.buffer);
  hashView.setUint32(0, h0, false);
  hashView.setUint32(4, h1, false);
  hashView.setUint32(8, h2, false);
  hashView.setUint32(12, h3, false);
  hashView.setUint32(16, h4, false);
  hashView.setUint32(20, h5, false);
  hashView.setUint32(24, h6, false);
  hashView.setUint32(28, h7, false);
  
  return hash;
}

function doubleSha256(input) {
  const encoder = new TextEncoder();
  const firstHash = sha256(encoder.encode(input));
  const secondHash = sha256(firstHash);
  
  // Convert to hex string
  return Array.from(secondHash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Worker state
let isRunning = false;
let currentJob = null;
let startNonce = 0;
let nonceCounter = 0;
let hashesCompleted = 0;
let fakeShareCount = 0;
let lastReportTime = performance.now();
let batchSize = 50000; // 50k nonces per batch

function mineBatch() {
  if (!isRunning || !currentJob) {
    return;
  }
  
  const batchStartTime = performance.now();
  let batchHashes = 0;
  
  for (let i = 0; i < batchSize; i++) {
    const nonce = startNonce + nonceCounter++;
    let jobString;
    
    if (currentJob) {
      jobString = `${currentJob.jobId}|${currentJob.prevhash}|${currentJob.nTime}|${currentJob.nBits}|${nonce}`;
    } else {
      jobString = `GarciaFamilyBlock|${Date.now()}|${nonce}`;
    }
    
    const hash = doubleSha256(jobString);
    batchHashes++;
    hashesCompleted++;
    
    // Toy difficulty check: hash starting with "0000"
    if (hash.startsWith('0000')) {
      fakeShareCount++;
    }
  }
  
  const now = performance.now();
  const elapsed = (now - lastReportTime) / 1000;
  
  // Report every ~1 second
  if (elapsed >= 1.0) {
    const hashesPerSecond = Math.round(hashesCompleted / elapsed);
    
    self.postMessage({
      type: 'progress',
      hashesCompleted,
      hashesPerSecond,
      fakeShareCount,
    });
    
    hashesCompleted = 0;
    lastReportTime = now;
  }
  
  // Continue mining
  if (isRunning) {
    setTimeout(mineBatch, 0);
  }
}

// Worker message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'start':
      if (!isRunning) {
        isRunning = true;
        hashesCompleted = 0;
        fakeShareCount = 0;
        lastReportTime = performance.now();
        startNonce = Math.floor(Math.random() * 0xffffffff);
        nonceCounter = 0;
        mineBatch();
      }
      break;
      
    case 'stop':
      isRunning = false;
      self.postMessage({
        type: 'stopped',
        hashesCompleted,
        fakeShareCount,
      });
      break;
      
    case 'job':
      currentJob = data;
      // Reset nonce counter when job changes
      nonceCounter = 0;
      break;
      
    default:
      break;
  }
};

