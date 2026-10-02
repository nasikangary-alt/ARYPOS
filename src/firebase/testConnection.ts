import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './config';

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_check'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: Client is offline.');
      return false;
    }
    // Document might not exist, but connection is alive if no network error thrown
    return true;
  }
}
