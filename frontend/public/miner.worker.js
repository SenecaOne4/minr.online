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

// Helper: Reverse byte order (little-endian to big-endian for hex strings)
function reverseHex(hex) {
  let result = '';
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    result += hex.substr(i, 2);
  }
  return result;
}

// Helper: Build merkle root from coinbase hash and merkle branches
function buildMerkleRoot(coinbaseHash, merkleBranches) {
  // Reverse coinbase hash to little-endian for merkle calculation
  let merkleRoot = reverseHex(coinbaseHash);
  for (let i = 0; i < merkleBranches.length; i++) {
    const branch = merkleBranches[i];
    // Concatenate (little-endian) and double SHA256
    const combined = merkleRoot + branch;
    const hashBytes = sha256(sha256(hexToBytes(combined)));
    merkleRoot = bytesToHex(hashBytes);
  }
  return reverseHex(merkleRoot); // Convert back to big-endian for block header
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

// Helper: Assemble block header
function assembleBlockHeader(version, prevhash, merkleRoot, ntime, nbits, nonce) {
  // Block header: version (4) + prevhash (32) + merkle_root (32) + ntime (4) + nbits (4) + nonce (4) = 80 bytes
  const versionHex = reverseHex(version.padStart(8, '0'));
  const prevhashHex = reverseHex(prevhash);
  const merkleRootHex = reverseHex(merkleRoot);
  const ntimeHex = reverseHex(ntime.padStart(8, '0'));
  const nbitsHex = reverseHex(nbits.padStart(8, '0'));
  const nonceHex = reverseHex(nonce.toString(16).padStart(8, '0'));
  
  return versionHex + prevhashHex + merkleRootHex + ntimeHex + nbitsHex + nonceHex;
}

// Helper: Compare hash to target (both as hex strings)
function hashMeetsTarget(hashHex, targetHex) {
  // Compare as big integers (little-endian)
  const hashRev = reverseHex(hashHex);
  const targetRev = reverseHex(targetHex);
  return BigInt('0x' + hashRev) <= BigInt('0x' + targetRev);
}

// Worker state
let isRunning = false;
let currentJob = null;
let realShareMode = false;
let extraNonce = null;
let extranonce2Counter = 0;
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
    
    if (realShareMode && currentJob.coinb1 && currentJob.coinb2 && extraNonce) {
      // Real share mode: assemble proper block header
      try {
        // Generate extranonce2 (incrementing counter)
        const extranonce2Hex = extranonce2Counter.toString(16).padStart(extraNonce.extranonce2Size * 2, '0');
        
        // Assemble coinbase: coinb1 + extranonce1 + extranonce2 + coinb2
        const coinbaseHex = currentJob.coinb1 + extraNonce.extranonce1 + extranonce2Hex + currentJob.coinb2;
        const coinbaseBytes = hexToBytes(coinbaseHex);
        const coinbaseHashBytes = sha256(sha256(coinbaseBytes));
        const coinbaseHash = bytesToHex(coinbaseHashBytes);
        
        // Build merkle root
        const merkleRoot = buildMerkleRoot(coinbaseHash, currentJob.merkleBranches || []);
        
        // Assemble block header
        const blockHeaderHex = assembleBlockHeader(
          currentJob.version || '20000000',
          currentJob.prevhash,
          merkleRoot,
          currentJob.nTime,
          currentJob.nBits,
          nonce
        );
        
        // Hash block header (double SHA256)
        const blockHeaderBytes = hexToBytes(blockHeaderHex);
        const headerHashBytes = sha256(sha256(blockHeaderBytes));
        const headerHash = bytesToHex(headerHashBytes);
        hashesCompleted++;
        
        // Check against target
        if (currentJob.target && hashMeetsTarget(headerHash, currentJob.target)) {
          // Share found!
          self.postMessage({
            type: 'share',
            share: {
              jobId: currentJob.jobId,
              extranonce2: extranonce2Hex,
              ntime: currentJob.nTime,
              nonce: nonce.toString(16).padStart(8, '0'),
              headerHash: headerHash,
            },
          });
        }
        
        // Increment extranonce2 every 1000 nonces (or reset nonce range)
        if (nonceCounter % 1000 === 0) {
          extranonce2Counter++;
        }
      } catch (error) {
        // Fallback to simple mode on error
        const hash = doubleSha256(`${currentJob.jobId}|${currentJob.prevhash}|${currentJob.nTime}|${currentJob.nBits}|${nonce}`);
        hashesCompleted++;
        if (hash.startsWith('0000')) {
          fakeShareCount++;
        }
      }
    } else {
      // Demo mode: simple hashing
      let jobString;
      if (currentJob) {
        jobString = `${currentJob.jobId}|${currentJob.prevhash}|${currentJob.nTime}|${currentJob.nBits}|${nonce}`;
      } else {
        jobString = `GarciaFamilyBlock|${Date.now()}|${nonce}`;
      }
      
      const hash = doubleSha256(jobString);
      hashesCompleted++;
      
      // Toy difficulty check: hash starting with "0000"
      if (hash.startsWith('0000')) {
        fakeShareCount++;
      }
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
  const { type, data, realShareMode: mode } = e.data;
  
  switch (type) {
    case 'start':
      if (!isRunning) {
        isRunning = true;
        realShareMode = mode || false;
        hashesCompleted = 0;
        fakeShareCount = 0;
        lastReportTime = performance.now();
        startNonce = Math.floor(Math.random() * 0xffffffff);
        nonceCounter = 0;
        extranonce2Counter = Math.floor(Math.random() * 0xffff);
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
      if (data.realShareMode !== undefined) {
        realShareMode = data.realShareMode;
      }
      if (data.extraNonce) {
        extraNonce = data.extraNonce;
      }
      // Reset nonce counter when job changes
      nonceCounter = 0;
      extranonce2Counter = Math.floor(Math.random() * 0xffff);
      break;
      
    default:
      break;
  }
};

