/**
 * Recursively sanitizes any JavaScript object or array for Firebase Firestore.
 * Removes any properties with `undefined` values, which are forbidden by Firestore WriteBatch/setDoc/updateDoc.
 */
export function sanitizeFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        res[key] = sanitizeFirestore(value);
      }
    }
    return res as T;
  }
  return data;
}
