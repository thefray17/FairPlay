const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawFn) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const rowBytes = width * 4 + 1;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function drawFairPlayIcon(x, y, w, h, isMaskable = false) {
  const nx = x / w; // 0 to 1
  const ny = y / h; // 0 to 1

  // Background rounded rectangle or full bleed
  if (!isMaskable) {
    const cornerRadius = 0.22;
    // Check 4 corners
    const inLeft = nx < cornerRadius;
    const inRight = nx > 1 - cornerRadius;
    const inTop = ny < cornerRadius;
    const inBottom = ny > 1 - cornerRadius;
    if ((inLeft || inRight) && (inTop || inBottom)) {
      const cx = inLeft ? cornerRadius : 1 - cornerRadius;
      const cy = inTop ? cornerRadius : 1 - cornerRadius;
      const dist = Math.hypot(nx - cx, ny - cy);
      if (dist > cornerRadius) {
        return [0, 0, 0, 0]; // Transparent outside corner
      }
    }
  }

  // Base background: Deep Indigo #4338CA
  let r = 67;
  let g = 56;
  let b = 202;
  let a = 255;

  // Shuttlecock Cork (bottom center circle)
  // Center at (0.5, 0.74), radius 0.10
  const corkDist = Math.hypot(nx - 0.5, ny - 0.74);
  if (corkDist <= 0.095) {
    if (corkDist <= 0.065) {
      // Inner cork highlight #E2E8F0
      return [226, 232, 240, 255];
    }
    // Cork base #F8FAFC
    return [248, 250, 252, 255];
  }

  // Shuttlecock Feathers Cone:
  // Top wide span: from x = 0.28 to 0.72 at y = 0.31
  // Bottom narrow span: from x = 0.41 to 0.59 at y = 0.67
  if (ny >= 0.31 && ny <= 0.67) {
    const progress = (ny - 0.31) / (0.67 - 0.31); // 0 (top) to 1 (bottom)
    const leftX = 0.28 + (0.41 - 0.28) * progress;
    const rightX = 0.72 - (0.72 - 0.59) * progress;

    if (nx >= leftX && nx <= rightX) {
      // Netting lines / ribs in Indigo
      const isCenterSpine = Math.abs(nx - 0.5) < 0.012;
      const isCrossBar1 = Math.abs(ny - 0.45) < 0.012 && nx >= leftX + 0.02 && nx <= rightX - 0.02;
      const isCrossBar2 = Math.abs(ny - 0.55) < 0.012 && nx >= leftX + 0.02 && nx <= rightX - 0.02;

      if (isCenterSpine || isCrossBar1 || isCrossBar2) {
        return [67, 56, 202, 255]; // Indigo line
      }

      // Feather body (bright white with high opacity)
      return [255, 255, 255, 240];
    }
  }

  return [r, g, b, a];
}

const publicDir = path.join(__dirname, '..', 'public');

// 1. 192x192 PNG
const png192 = createPng(192, 192, (x, y, w, h) => drawFairPlayIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
console.log('Created public/pwa-192x192.png');

// 2. 512x512 PNG
const png512 = createPng(512, 512, (x, y, w, h) => drawFairPlayIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
console.log('Created public/pwa-512x512.png');

// 3. 512x512 Maskable PNG (full bleed background)
const pngMaskable512 = createPng(512, 512, (x, y, w, h) => drawFairPlayIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable512);
console.log('Created public/pwa-maskable-512x512.png');

// 4. Apple Touch Icon 180x180 PNG
const appleIcon = createPng(180, 180, (x, y, w, h) => drawFairPlayIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('Created public/apple-touch-icon.png');

// 5. 64x64 favicon PNG
const favicon64 = createPng(64, 64, (x, y, w, h) => drawFairPlayIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon64);
console.log('Created public/favicon.png');
