import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TmailLoginView } from './components/TmailLoginView';
import { SchoolSelectorView } from './components/SchoolSelectorView';
import { UploadWorkspaceView } from './components/UploadWorkspaceView';
import { AdminConsoleView } from './components/AdminConsoleView';
import {
  db,
  googleTmailSignIn,
  handleFirestoreError,
  initAuth,
  logout,
  OperationType,
} from './lib/firebase';
import { UserProfile, YilanSchool } from './types';

type AppView = 'portal' | 'select-school' | 'admin';

function MainApp() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [view, setView] = useState<AppView>('portal');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [savingSchool, setSavingSchool] = useState(false);

  const loadUserProfile = async (user: User) => {
    setProfileLoading(true);
    const path = `users/${user.uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setHasDriveToken(Boolean(token));
        setAuthReady(true);
        void loadUserProfile(user);
      },
      () => {
        setFirebaseUser(null);
        setHasDriveToken(false);
        setProfile(null);
        setAuthReady(true);
      }
    );
    return () => unsub();
  }, []);

  const handleTmailLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await googleTmailSignIn();
      setFirebaseUser(res.user);
      setHasDriveToken(Boolean(res.accessToken));
      await loadUserProfile(res.user);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : '宜蘭縣 Tmail 驗證失敗，請再試一次。'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConfirmSchool = async (school: YilanSchool) => {
    if (!firebaseUser || !firebaseUser.email) return;
    setSavingSchool(true);
    const path = `users/${firebaseUser.uid}`;
    try {
      const existingSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      const displayName = (
        firebaseUser.displayName ||
        firebaseUser.email.split('@')[0] ||
        'Tmail使用者'
      ).slice(0, 120);

      if (existingSnap.exists()) {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          displayName,
          schoolId: school.id,
          schoolName: school.name,
          schoolTownship: school.township,
          schoolLevel: school.level,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName,
          schoolId: school.id,
          schoolName: school.name,
          schoolTownship: school.township,
          schoolLevel: school.level,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const updatedSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (updatedSnap.exists()) {
        setProfile(updatedSnap.data() as UserProfile);
      }
      setView('portal');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSavingSchool(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setFirebaseUser(null);
    setHasDriveToken(false);
    setProfile(null);
    setView('portal');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setView('portal')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer font-display"
          >
            宜蘭縣學校資料上傳平台
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView('portal')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                view === 'portal'
                  ? 'text-blue-700 border-blue-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              資料上傳介面
            </button>

            {firebaseUser && (
              <button
                type="button"
                onClick={() => setView('select-school')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  view === 'select-school'
                    ? 'text-blue-700 border-blue-700'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                選擇服務學校
              </button>
            )}

            <button
              type="button"
              onClick={() => setView('admin')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                view === 'admin'
                  ? 'text-blue-700 border-blue-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              管理者後台
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                登出 Tmail
              </button>
            ) : (
              <button
                type="button"
                onClick={view === 'admin' ? () => setView('portal') : handleTmailLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {view === 'admin' ? '返回上傳入口' : isLoggingIn ? '驗證中...' : '登入 Tmail'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1">
        {!authReady ? (
          <div className="max-w-4xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
            正在初始化連線與帳號狀態...
          </div>
        ) : view === 'admin' ? (
          <AdminConsoleView
            currentUserEmail={firebaseUser?.email || null}
            hasDriveToken={hasDriveToken}
            onConnectAdminTmail={handleTmailLogin}
            onBackToPortal={() => setView('portal')}
          />
        ) : !firebaseUser ? (
          <TmailLoginView
            onLogin={handleTmailLogin}
            isLoggingIn={isLoggingIn}
            errorMessage={loginError}
            onOpenAdmin={() => setView('admin')}
          />
        ) : profileLoading ? (
          <div className="max-w-4xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
            正在讀取您的 Tmail 學校設定...
          </div>
        ) : view === 'select-school' || !profile ? (
          <SchoolSelectorView
            userEmail={firebaseUser.email || ''}
            userName={
              firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Tmail 使用者'
            }
            currentSchoolId={profile?.schoolId}
            onConfirmSchool={handleConfirmSchool}
            isSaving={savingSchool}
          />
        ) : (
          <UploadWorkspaceView
            profile={profile}
            hasDriveToken={hasDriveToken}
            onRefreshDriveAuth={handleTmailLogin}
            onChangeSchool={() => setView('select-school')}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>宜蘭縣各級學校資料線上繳交平台</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView('portal')}
              className="hover:text-slate-900 cursor-pointer"
            >
              資料上傳介面
            </button>
            <button
              type="button"
              onClick={() => setView('admin')}
              className="hover:text-slate-900 cursor-pointer"
            >
              管理者後台
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
