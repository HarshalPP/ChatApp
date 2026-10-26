import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function createFirestore(projectId: string, databaseId: string, emulatorHost?: string): Firestore {
  if (!getApps().length) {
    
    initializeApp(emulatorHost ? { projectId } : { projectId, credential: applicationDefault() });
  }
  return getFirestore(databaseId);
}


export async function checkFirestoreConnection(db: Firestore, projectId: string, databaseId: string) {
  try {
    await db.listCollections();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 5) {
      throw new Error(
        `Firestore database "${databaseId}" was not found in project "${projectId}"`,
      );
    }
    if (code === 7 || code === 16) {
      throw new Error('Firestore rejected the credentials.');
    }
    throw err;
  }
}
