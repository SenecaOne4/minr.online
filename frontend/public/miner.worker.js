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

// Reusable buffers to avoid allocations in hot path
let sha256PaddedBuffer = null;
let sha256WBuffer = null;
let sha256HashBuffer = null;

function sha256(message) {
  const msgLength = message.length;
  const msgBitLength = msgLength * 8;
  
  // Pre-processing - calculate padded length once
  const paddedLength = ((msgLength + 9 + 63) & ~63);
  
  // Reuse buffer if possible, otherwise allocate
  if (!sha256PaddedBuffer || sha256PaddedBuffer.length < paddedLength) {
    sha256PaddedBuffer = new Uint8Array(paddedLength);
  }
  const padded = sha256PaddedBuffer.subarray(0, paddedLength);
  padded.set(message);
  padded[msgLength] = 0x80;
  
  // Append length (big-endian) - use DataView for efficiency
  const view = new DataView(padded.buffer, padded.byteOffset, paddedLength);
  view.setUint32(paddedLength - 8, Math.floor(msgBitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, msgBitLength & 0xffffffff, false);
  
  // Initialize hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  
  // Reuse w buffer
  if (!sha256WBuffer) {
    sha256WBuffer = new Uint32Array(64);
  }
  const w = sha256WBuffer;
  
  // Process message in 512-bit chunks
  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    // Copy chunk into first 16 words (optimized - use bit shift for multiplication)
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunkStart + (i << 2), false);
    }
    
    // Extend the first 16 words into the remaining 48 words
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      // Optimize: cache rightRotate results
      const r15_7 = rightRotate(w15, 7);
      const r15_18 = rightRotate(w15, 18);
      const r2_17 = rightRotate(w2, 17);
      const r2_19 = rightRotate(w2, 19);
      const s0 = r15_7 ^ r15_18 ^ (w15 >>> 3);
      const s1 = r2_17 ^ r2_19 ^ (w2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    
    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    
    // Main loop - optimized with inlined operations
    for (let i = 0; i < 64; i++) {
      // Cache rightRotate results
      const re_6 = rightRotate(e, 6);
      const re_11 = rightRotate(e, 11);
      const re_25 = rightRotate(e, 25);
      const S1 = re_6 ^ re_11 ^ re_25;
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      
      const ra_2 = rightRotate(a, 2);
      const ra_13 = rightRotate(a, 13);
      const ra_22 = rightRotate(a, 22);
      const S0 = ra_2 ^ ra_13 ^ ra_22;
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
  
  // Reuse hash buffer
  if (!sha256HashBuffer) {
    sha256HashBuffer = new Uint8Array(32);
  }
  const hash = sha256HashBuffer;
  const hashView = new DataView(hash.buffer);
  hashView.setUint32(0, h0, false);
  hashView.setUint32(4, h1, false);
  hashView.setUint32(8, h2, false);
  hashView.setUint32(12, h3, false);
  hashView.setUint32(16, h4, false);
  hashView.setUint32(20, h5, false);
  hashView.setUint32(24, h6, false);
  hashView.setUint32(28, h7, false);
  
  // Return a copy to avoid buffer reuse issues
  return new Uint8Array(hash);
}

function doubleSha256(input) {
  const encoder = new TextEncoder();
  const firstHash = sha256(encoder.encode(input));
  const secondHash = sha256(firstHash);
  
  // Convert to hex string (optimized - avoid Array.from)
  let hex = '';
  for (let i = 0; i < secondHash.length; i++) {
    hex += (secondHash[i] < 16 ? '0' : '') + secondHash[i].toString(16);
  }
  return hex;
}

// Helper: Reverse byte order (little-endian to big-endian for hex strings)
function reverseHex(hex) {
  let result = '';
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    result += hex.substr(i, 2);
  }
  return result;
}

// Helper: Build merkle root from coinbase hash and merkle branches
function buildMerkleRoot(coinbaseHashHex, merkleBranches) {
  // Start with coinbase hash as 32-byte buffer (little-endian)
  let current = hexToBytes(reverseHex(coinbaseHashHex));
  
  for (let i = 0; i < merkleBranches.length; i++) {
    const branchHex = merkleBranches[i];
    // Convert branch to 32-byte buffer (little-endian)
    const branch = hexToBytes(reverseHex(branchHex));
    
    // Concatenate: current (32 bytes) + branch (32 bytes) = 64 bytes
    const combined = new Uint8Array(64);
    combined.set(current, 0);
    combined.set(branch, 32);
    
    // Double SHA256
    current = sha256(sha256(combined));
  }
  
  // Convert back to hex (little-endian) for header assembly
  return bytesToHex(current);
}

// Helper: Convert hex string to bytes
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper: Convert bytes to hex string
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Assemble block header (80 bytes, all little-endian)
function assembleBlockHeader(versionHex, prevhashHex, merkleRootBytes, ntimeHex, nbitsHex, nonce) {
  // version: 4-byte little-endian from hex
  const versionBytes = hexToBytes(reverseHex(versionHex.padStart(8, '0')));
  
  // prevhash: convert hex to bytes then reverse to little-endian (Stratum gives big-endian)
  const prevhashBytes = hexToBytes(reverseHex(prevhashHex));
  
  // merkle_root: already in bytes (little-endian from buildMerkleRoot)
  const merkleRoot = merkleRootBytes;
  
  // ntime: 4-byte little-endian from hex
  const ntimeBytes = hexToBytes(reverseHex(ntimeHex.padStart(8, '0')));
  
  // nbits: 4-byte little-endian from hex
  const nbitsBytes = hexToBytes(reverseHex(nbitsHex.padStart(8, '0')));
  
  // nonce: 4-byte little-endian integer
  const nonceBytes = new Uint8Array(4);
  const nonceView = new DataView(nonceBytes.buffer);
  nonceView.setUint32(0, nonce, true); // true = little-endian
  
  // Assemble 80-byte header
  const header = new Uint8Array(80);
  header.set(versionBytes, 0);
  header.set(prevhashBytes, 4);
  header.set(merkleRoot, 36);
  header.set(ntimeBytes, 68);
  header.set(nbitsBytes, 72);
  header.set(nonceBytes, 76);
  
  return header;
}

// Helper: Compare hash to target
// Hash is from dblSHA256(header) - result is in little-endian bytes
// Target is big-endian hex string
// Compare: reverse hash to big-endian hex and compare lexicographically
function hashMeetsTarget(hashBytes, targetHex) {
  // Convert hash bytes to big-endian hex
  const hashHex = reverseHex(bytesToHex(hashBytes));
  
  // Compare lexicographically (same length hex strings)
  // Since both are 64-char hex strings, we can compare directly
  return hashHex <= targetHex;
}

// Worker state
let isRunning = false;
let currentJob = null;
let extraNonce = null;
let extranonce2Counter = 0;
let nonceStart = 0;
let nonceStride = 1;
let nonceCounter = 0;
let hashesCompleted = 0;
let lastReportTime = performance.now();
let batchSize = 500000; // 500k nonces per batch (increased for better performance - larger batches = less overhead)

// Cache for merkle root per extranonce2 (performance optimization)
let cachedExtranonce2 = null;
let cachedMerkleRootBytes = null;

function mineBatch() {
  if (!isRunning || !currentJob) {
    return;
  }
  
  // Only real share mode now - always use real mining
  if (!currentJob.coinb1 || !currentJob.coinb2 || !extraNonce || !currentJob.target) {
    // Not ready - skip batch
    return;
  }
  
  // Pre-compute header parts that don't change (everything except nonce)
  const versionBytes = hexToBytes(reverseHex((currentJob.version || '20000000').padStart(8, '0')));
  const prevhashBytes = hexToBytes(reverseHex(currentJob.prevhash));
  const ntimeBytes = hexToBytes(reverseHex(currentJob.nTime.padStart(8, '0')));
  const nbitsBytes = hexToBytes(reverseHex(currentJob.nBits.padStart(8, '0')));
  
  // Pre-assemble header parts 0-75 (everything except nonce at bytes 76-79)
  const headerPrefix = new Uint8Array(76);
  headerPrefix.set(versionBytes, 0);
  headerPrefix.set(prevhashBytes, 4);
  headerPrefix.set(ntimeBytes, 68);
  headerPrefix.set(nbitsBytes, 72);
  
  // Pre-compute merkle root once per extranonce2
  if (cachedExtranonce2 !== extranonce2Counter || !cachedMerkleRootBytes) {
    const extranonce2Hex = extranonce2Counter.toString(16).padStart(extraNonce.extranonce2Size * 2, '0');
    const coinbaseHex = currentJob.coinb1 + extraNonce.extranonce1 + extranonce2Hex + currentJob.coinb2;
    const coinbaseBytes = hexToBytes(coinbaseHex);
    const coinbaseHashBytes = sha256(sha256(coinbaseBytes));
    const coinbaseHashHex = bytesToHex(coinbaseHashBytes);
    cachedMerkleRootBytes = hexToBytes(buildMerkleRoot(coinbaseHashHex, currentJob.merkleBranches || []));
    cachedExtranonce2 = extranonce2Counter;
  }
  
  // Pre-assemble header with merkle root (only nonce will change)
  const headerBase = new Uint8Array(80);
  headerBase.set(headerPrefix, 0);
  headerBase.set(cachedMerkleRootBytes, 36);
  
  // Reusable DataView for nonce updates
  const headerView = new DataView(headerBase.buffer);
  
  // Process batch with optimized loop - tighter loop, fewer allocations
  const targetHex = currentJob.target;
  let foundShare = null;
  
  // Pre-compute extranonce2 hex string length
  const extranonce2HexLength = extraNonce.extranonce2Size * 2;
  
  // Process in chunks to allow for extranonce2 updates
  let processedInBatch = 0;
  const maxNoncesBeforeExtranonce2Update = 200000;
  
  while (processedInBatch < batchSize && isRunning) {
    // Determine how many nonces to process in this chunk
    const remainingInBatch = batchSize - processedInBatch;
    const remainingUntilExtranonce2Update = maxNoncesBeforeExtranonce2Update - (nonceCounter % maxNoncesBeforeExtranonce2Update);
    const chunkSize = Math.min(remainingInBatch, remainingUntilExtranonce2Update);
    
    // Tight inner loop - minimize allocations
    for (let i = 0; i < chunkSize; i++) {
      // Use stride: nonce = start + (counter * stride) mod 2^32
      const nonce = (nonceStart + (nonceCounter * nonceStride)) & 0xffffffff;
      nonceCounter++;
      
      // Update nonce in header (little-endian) - reuse same buffer
      headerView.setUint32(76, nonce, true);
      
      // Hash block header (double SHA256)
      const headerHashBytes = sha256(sha256(headerBase));
      hashesCompleted++;
      
      // Check against target (optimized comparison)
      if (hashMeetsTarget(headerHashBytes, targetHex)) {
        // Share found!
        const headerHashHex = bytesToHex(headerHashBytes);
        const extranonce2Hex = cachedExtranonce2.toString(16).padStart(extranonce2HexLength, '0');
        foundShare = {
          jobId: currentJob.jobId,
          extranonce2: extranonce2Hex,
          ntime: currentJob.nTime,
          nonce: nonce.toString(16).padStart(8, '0'),
          headerHash: reverseHex(headerHashHex),
        };
        // Continue mining - don't break
      }
    }
    
    processedInBatch += chunkSize;
    
    // Increment extranonce2 periodically (every 200k nonces to reduce recomputation)
    if (nonceCounter > 0 && nonceCounter % maxNoncesBeforeExtranonce2Update === 0) {
      extranonce2Counter++;
      cachedExtranonce2 = null; // Force recompute on next batch
      break; // Exit loop to recompute merkle root
    }
  }
  
  // Send share if found
  if (foundShare) {
    self.postMessage({
      type: 'shareFound',
      share: foundShare,
    });
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
      fakeShareCount: 0, // No fake shares in real mode
    });
    
    hashesCompleted = 0;
    lastReportTime = now;
  }
  
  // Continue mining with optimized scheduling
  if (isRunning) {
    // Use requestIdleCallback if available, otherwise setTimeout with minimal delay
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(mineBatch, { timeout: 1 });
    } else {
      setTimeout(mineBatch, 0);
    }
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
        lastReportTime = performance.now();
        // Use provided nonceStart and nonceStride, or generate random
        if (e.data.nonceStart !== undefined) {
          nonceStart = e.data.nonceStart;
        } else {
          nonceStart = Math.floor(Math.random() * 0xffffffff);
        }
        if (e.data.nonceStride !== undefined) {
          nonceStride = Math.max(1, e.data.nonceStride);
        } else {
          nonceStride = 1;
        }
        nonceCounter = 0;
        extranonce2Counter = Math.floor(Math.random() * 0xffff);
        cachedExtranonce2 = null; // Reset cache
        cachedMerkleRootBytes = null;
        mineBatch();
      }
      break;
      
    case 'stop':
      isRunning = false;
      self.postMessage({
        type: 'stopped',
        hashesCompleted,
        fakeShareCount: 0,
      });
      break;
      
    case 'job':
      currentJob = data;
      if (data.extraNonce) {
        extraNonce = data.extraNonce;
      }
      if (data.nonceStart !== undefined) {
        nonceStart = data.nonceStart;
      }
      if (data.nonceStride !== undefined) {
        nonceStride = Math.max(1, data.nonceStride);
      }
      // Reset nonce counter when job changes
      nonceCounter = 0;
      extranonce2Counter = Math.floor(Math.random() * 0xffff);
      cachedExtranonce2 = null; // Reset cache on new job
      cachedMerkleRootBytes = null;
      break;
      
    default:
      break;
  }
};

