import admin from 'firebase-admin';
import { config } from './environment';

let db: FirebaseFirestore.Firestore | null = null;

export function initializeFirebase(): FirebaseFirestore.Firestore {
  if (db) return db;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
        clientEmail: config.firebase.clientEmail,
      }),
    });
  }

  db = admin.firestore();
  return db;
}

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
}
