import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { CollectionReference, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env';

function getFirebaseApp() {
  if (getApps().length) return getApps()[0];

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  }

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

let registrationsCollectionCache: CollectionReference | null = null;

export function getRegistrationsCollection() {
  if (registrationsCollectionCache) return registrationsCollectionCache;
  const firestore = getFirestore(getFirebaseApp(), env.FIRESTORE_DATABASE_ID);
  registrationsCollectionCache = firestore.collection(env.FIRESTORE_REGISTRATIONS_COLLECTION);
  return registrationsCollectionCache;
}

export const serverTimestamp = () => FieldValue.serverTimestamp();
