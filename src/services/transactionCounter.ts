import { Firestore, doc, runTransaction } from 'firebase/firestore';

/**
 * Mengambil ID unik perangkat untuk penomoran transaksi mode offline.
 * Tersimpan di localStorage agar konsisten per browser/perangkat.
 */
export function getBrowserDeviceId(): string {
  try {
    let devId = localStorage.getItem('ary_device_id');
    if (!devId) {
      devId = `DEV${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      localStorage.setItem('ary_device_id', devId);
    }
    // Bersihkan karakter selain alfanumerik (maksimal 8 karakter agar nomor struk tetap ringkas)
    const clean = devId.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    return clean || 'DEV01';
  } catch {
    return 'DEV01';
  }
}

/**
 * Menghasilkan nomor transaksi sementara untuk mode offline dengan prefix perangkat: OFF-<deviceId>-<seq>
 * Urutan nomor disimpan di localStorage per perangkat.
 */
export function getNextOfflineTransactionNo(): {
  transactionNo: string;
  sequence: number;
  deviceId: string;
} {
  const deviceId = getBrowserDeviceId();
  let seq = 1;
  try {
    const rawSeq = localStorage.getItem('ary_offline_sale_seq');
    seq = rawSeq ? parseInt(rawSeq, 10) + 1 : 1;
    localStorage.setItem('ary_offline_sale_seq', String(seq));
  } catch {
    seq = Math.floor(Date.now() % 10000);
  }
  const seqStr = String(seq).padStart(3, '0');
  const transactionNo = `OFF-${deviceId}-${seqStr}`;
  return { transactionNo, sequence: seq, deviceId };
}

/**
 * Mengambil nomor transaksi berurutan atomik dari Firestore
 * Menggunakan runTransaction pada dokumen counters/sales_YYYYMMDD
 */
export async function getNextTransactionNumber(
  firestore: Firestore,
  dateInput?: Date | string
): Promise<{ transactionNo: string; sequence: number; counterDocId: string }> {
  const d = dateInput
    ? typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput
    : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  const yyyymmdd = `${year}${month}${day}`;
  const counterDocId = `sales_${yyyymmdd}`;
  const counterRef = doc(firestore, 'counters', counterDocId);

  const nextSeq = await runTransaction(firestore, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let currentSeq = 0;
    if (counterSnap.exists()) {
      const data = counterSnap.data();
      currentSeq = typeof data.lastSequence === 'number' ? data.lastSequence : 0;
    }
    const next = currentSeq + 1;
    transaction.set(
      counterRef,
      {
        lastSequence: next,
        date: yyyymmdd,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return next;
  });

  const seqStr = String(nextSeq).padStart(3, '0');
  const transactionNo = `TRX-${yyyymmdd}-${seqStr}`;

  return { transactionNo, sequence: nextSeq, counterDocId };
}

/**
 * Memeriksa apakah sebuah nomor transaksi berformat sementara offline (OFF-...)
 */
export function isOfflineTransactionNo(transactionNo: string | undefined): boolean {
  if (!transactionNo) return false;
  return transactionNo.startsWith('OFF-');
}
