import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// --- Sandbox Auth Bypass Utility ---
export function getSandboxUser() {
  const sandboxUserStr = typeof window !== 'undefined' ? localStorage.getItem('sandbox_user') : null;
  if (sandboxUserStr) {
    try {
      return JSON.parse(sandboxUserStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function getCurrentUser() {
  const sandbox = getSandboxUser();
  if (sandbox) {
    return {
      uid: sandbox.uid,
      email: sandbox.email,
      displayName: sandbox.name,
      emailVerified: true,
      isAnonymous: false,
      providerData: [{ providerId: 'google.com', uid: sandbox.uid, displayName: sandbox.name, email: sandbox.email }]
    } as any;
  }
  return auth.currentUser;
}


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = getCurrentUser();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
