const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlineLength = width * 4;
  const rawScanlines = Buffer.alloc(height * (scanlineLength + 1));
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (scanlineLength + 1);
    rawScanlines[rawOffset] = 0; // Filter None
    rgbaBuffer.copy(rawScanlines, rawOffset + 1, y * scanlineLength, (y + 1) * scanlineLength);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawPwaIcon(size, isMaskable = false) {
  const buf = Buffer.alloc(size * size * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const srcA = a / 255;
    const dstA = buf[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    buf[idx] = Math.round((r * srcA + buf[idx] * dstA * (1 - srcA)) / outA);
    buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
    buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
    buf[idx + 3] = Math.round(outA * 255);
  }

  const cornerRadius = isMaskable ? 0 : Math.round(size * 0.22);

  // 1. Background Gradient
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isMaskable && cornerRadius > 0) {
        // Rounded corners check
        const inLeft = x < cornerRadius;
        const inRight = x >= size - cornerRadius;
        const inTop = y < cornerRadius;
        const inBottom = y >= size - cornerRadius;
        if ((inLeft || inRight) && (inTop || inBottom)) {
          const cx = inLeft ? cornerRadius : size - cornerRadius - 1;
          const cy = inTop ? cornerRadius : size - cornerRadius - 1;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist > cornerRadius) continue;
        }
      }

      // Diagonal gradient from #D92D20 to #FF641F to #F79009
      const t = (x + y) / (2 * size);
      let r, g, b;
      if (t < 0.5) {
        const factor = t / 0.5;
        r = Math.round(217 + (255 - 217) * factor);
        g = Math.round(45 + (100 - 45) * factor);
        b = Math.round(32 + (31 - 32) * factor);
      } else {
        const factor = (t - 0.5) / 0.5;
        r = Math.round(255 + (247 - 255) * factor);
        g = Math.round(100 + (144 - 100) * factor);
        b = Math.round(31 + (9 - 31) * factor);
      }
      setPixel(x, y, r, g, b, 255);
    }
  }

  // 2. Central White Plate Emblem
  const emblemY = isMaskable ? size * 0.44 : size * 0.43;
  const plateRadius = isMaskable ? size * 0.23 : size * 0.25;
  const centerX = size * 0.5;

  // Shadow under plate
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - centerX, y - (emblemY + size * 0.02));
      if (d <= plateRadius + size * 0.03) {
        const alpha = Math.max(0, 1 - (d - plateRadius) / (size * 0.03)) * 60;
        setPixel(x, y, 0, 0, 0, alpha);
      }
    }
  }

  // Plate White Circle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - centerX, y - emblemY);
      if (d <= plateRadius) {
        setPixel(x, y, 255, 255, 255, 255);
      } else if (d <= plateRadius + 1.2) {
        setPixel(x, y, 255, 255, 255, Math.round((1 - (d - plateRadius)) * 255));
      }
    }
  }

  // 3. Stylized Chicken Drumstick Emblem
  // Drumstick body ellipse rotated approx 35 deg
  const drumX = centerX + size * 0.02;
  const drumY = emblemY - size * 0.02;
  const drumRadius = plateRadius * 0.65;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - drumX;
      const dy = y - drumY;
      // Rotated ellipse equation
      const angle = 0.55; // radians
      const rx = dx * Math.cos(angle) + dy * Math.sin(angle);
      const ry = -dx * Math.sin(angle) + dy * Math.cos(angle);
      const val = (rx * rx) / (drumRadius * drumRadius * 0.7) + (ry * ry) / (drumRadius * drumRadius * 1.1);
      if (val <= 1.0) {
        setPixel(x, y, 234, 88, 12, 255); // Rich roast orange
      } else if (val <= 1.1) {
        setPixel(x, y, 234, 88, 12, Math.round((1.1 - val) * 10 * 255));
      }
    }
  }

  // Drumstick highlight / crisp texture
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - (drumX + size * 0.02);
      const dy = y - (drumY - size * 0.02);
      const val = (dx * dx) / (drumRadius * drumRadius * 0.35) + (dy * dy) / (drumRadius * drumRadius * 0.55);
      if (val <= 1.0) {
        setPixel(x, y, 251, 146, 60, 240); // Crispy golden highlight
      }
    }
  }

  // Bone knob (bottom-left)
  const boneX = drumX - plateRadius * 0.6;
  const boneY = drumY + plateRadius * 0.55;
  const boneRadius = plateRadius * 0.16;

  // Bone handle
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = drumX - plateRadius * 0.25 * (1 - t) - plateRadius * 0.55 * t;
    const by = drumY + plateRadius * 0.2 * (1 - t) + plateRadius * 0.5 * t;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x - bx, y - by) <= plateRadius * 0.1) {
          setPixel(x, y, 243, 244, 246, 255);
        }
      }
    }
  }

  // Two rounded bone joints
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.hypot(x - boneX, y - (boneY + boneRadius * 0.4)) <= boneRadius ||
          Math.hypot(x - (boneX - boneRadius * 0.5), y - (boneY - boneRadius * 0.3)) <= boneRadius) {
        setPixel(x, y, 255, 255, 255, 255);
      }
    }
  }

  // 4. Golden Star Badge on Plate
  const starBadgeX = centerX + plateRadius * 0.72;
  const starBadgeY = emblemY + plateRadius * 0.55;
  const starBadgeRadius = plateRadius * 0.32;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - starBadgeX, y - starBadgeY);
      if (d <= starBadgeRadius) {
        setPixel(x, y, 245, 158, 11, 255); // Amber-500
      } else if (d <= starBadgeRadius + size * 0.01) {
        setPixel(x, y, 255, 255, 255, 255); // White border
      }
    }
  }

  // 5. White Star Icon
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - starBadgeX, y - starBadgeY);
      if (d <= starBadgeRadius * 0.5) {
        setPixel(x, y, 255, 255, 255, 255);
      }
    }
  }

  return encodePNG(size, size, buf);
}

// Generate all target PNG icons
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), drawPwaIcon(192, false));
console.log('Created pwa-192x192.png');

fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), drawPwaIcon(512, false));
console.log('Created pwa-512x512.png');

fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), drawPwaIcon(512, true));
console.log('Created pwa-maskable-512x512.png');

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), drawPwaIcon(180, false));
console.log('Created apple-touch-icon.png');

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), drawPwaIcon(64, false));
console.log('Created favicon.ico');

console.log('All PWA icons generated successfully!');
