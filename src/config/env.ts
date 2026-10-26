import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  firebaseProjectId: required('FIREBASE_PROJECT_ID'),
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
};
