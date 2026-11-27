import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TMAIL_DOMAIN } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  hd: 'tmail.ilc.edu.tw',
  prompt: 'select_account',
});

// In-memory access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function isTmailAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(TMAIL_DOMAIN);
}

export function initAuth(
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!isTmailAccount(user.email) || !user.emailVerified) {
        if (!isSigningIn) {
          cachedAccessToken = null;
          await auth.signOut();
          onAuthFailure?.();
        }
        return;
      }
      onAuthSuccess?.(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (!isSigningIn) {
        onAuthFailure?.();
      }
    }
  });
}

export async function googleTmailSignIn(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email || '';

    if (!isTmailAccount(email) || !result.user.emailVerified) {
      cachedAccessToken = null;
      await auth.signOut();
      throw new Error(
        `您目前選擇的帳號（${email || '未知帳號'}）非宜蘭縣 Tmail（@tmail.ilc.edu.tw）。請改用宜蘭縣教育處 Tmail 帳號登入驗證。`
      );
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('無法取得 Google Drive 上傳授權權杖，請確認已勾選 Google 雲端硬碟存取權限。');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export async function logout(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
