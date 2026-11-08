/**
 * Utilitas keamanan PIN Staf (Hash SHA-256 + Salt).
 * Memastikan PIN tidak pernah disimpan plaintext di Firestore serta mendukung
 * verifikasi kompatibilitas mundur (legacy plaintext PIN) untuk migrasi otomatis.
 */

// Konstanta K untuk algoritma SHA-256 (fallback murni JS jika Web Crypto tidak tersedia di HTTP lokal)
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Fallback(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const bitLen = bytes.length * 8;

  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
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

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Menghasilkan salt acak sepanjang 32 karakter hex (16 byte).
 */
export function generatePinSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Menghitung hash SHA-256 (64 karakter hex) dari kombinasi salt dan PIN.
 */
export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const cleanPin = pin.trim();
  const cleanSalt = salt.trim();
  const payload = `arypos_pin_v1:${cleanSalt}:${cleanPin}`;

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoded = new TextEncoder().encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return sha256Fallback(payload);
    }
  }

  return sha256Fallback(payload);
}

/**
 * Membuat pasangan { pinHash, pinSalt } baru dari PIN plaintext.
 */
export async function createHashedPinCredentials(
  pin: string
): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = generatePinSalt();
  const pinHash = await hashPinWithSalt(pin, pinSalt);
  return { pinHash, pinSalt };
}

/**
 * Memverifikasi input PIN terhadap record kredensial (mendukung pinHash+pinSalt maupun legacy plaintext pin).
 */
export async function verifyStaffPin(
  inputPin: string,
  record: {
    pinHash?: string;
    pinSalt?: string;
    pin?: string;
  }
): Promise<{ valid: boolean; needsMigration: boolean }> {
  const cleanInput = inputPin.trim();
  if (!cleanInput) {
    return { valid: false, needsMigration: false };
  }

  // 1. Prioritaskan verifikasi menggunakan Hash + Salt
  if (record.pinHash && record.pinSalt) {
    const computedHash = await hashPinWithSalt(cleanInput, record.pinSalt);
    const isMatch = computedHash === record.pinHash;
    // Jika masih ada field plaintext `pin` yang tersisa di dokumen lama, tandai perlu migrasi pembersihan
    return {
      valid: isMatch,
      needsMigration: isMatch && Boolean(record.pin),
    };
  }

  // 2. Kompatibilitas data lama: jika dokumen lama masih menyimpan plaintext `pin`
  if (record.pin) {
    const isLegacyMatch = record.pin.trim() === cleanInput;
    return {
      valid: isLegacyMatch,
      needsMigration: isLegacyMatch,
    };
  }

  return { valid: false, needsMigration: false };
}
