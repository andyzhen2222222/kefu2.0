import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import {
  intellideskConfigured,
  intellideskTenantId,
  registerIntellideskBearerTokenGetter,
  resolveSessionUserFromAccount,
} from '@/src/services/intellideskApi';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '@/src/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (account?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerIntellideskBearerTokenGetter(async () => {
      try {
        const u = auth.currentUser;
        if (!u) return null;
        return await u.getIdToken();
      } catch {
        return null;
      }
    });
  }, []);

  useEffect(() => {
    const mockUser = localStorage.getItem('mockUser');
    if (mockUser) {
      try {
        setUser(JSON.parse(mockUser) as User);
      } catch {
        localStorage.removeItem('mockUser');
        setUser(null);
      }
      setLoading(false);
      return;
    }

    /** mock 构建/开发不挂 Firebase，避免网络或配置问题导致 onAuthStateChanged 迟迟不回调、页面一直转圈 */
    if (import.meta.env.MODE === 'mock') {
      setUser(null);
      setLoading(false);
      return;
    }

    /** Firebase SDK 偶发不回调时避免登录页永久转圈（计划：前端启动排查） */
    const authStuckMs = 12_000;
    const stuckTimer = window.setTimeout(() => {
      setLoading(false);
    }, authStuckMs);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      window.clearTimeout(stuckTimer);
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Create new user profile
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email || '',
              role: 'agent', // Default role
              avatar: firebaseUser.photoURL || undefined
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching or creating user profile:", error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(stuckTimer);
      unsubscribe();
    };
  }, []);

  const signIn = async (account?: string) => {
    try {
      if (intellideskConfigured()) {
        const tid = intellideskTenantId();
        const result = await resolveSessionUserFromAccount(tid, account);
        if (!result.user) {
          const msg =
            'error' in result && result.error
              ? result.error
              : '登录失败：坐席请输入与后台「2·坐席」中一致的登录账号或邮箱；管理员请输入完整邮箱（如 admin@demo.local）。';
          window.alert(msg);
          return;
        }
        setUser(result.user);
        localStorage.setItem('mockUser', JSON.stringify(result.user));
        return;
      }

      // 纯前端演示：无后端时按关键字粗分角色（与真实联调无关）
      let role: User['role'] = 'admin';
      let name = '管理员（演示）';
      if (account?.includes('agent')) {
        role = 'agent';
        name = '一线客服（演示）';
      } else if (account?.includes('finance')) {
        role = 'finance';
        name = '财务（演示）';
      }

      const mockUser: User = {
        id: account ? `mock-user-${account}` : 'mock-user-id',
        name,
        email: account ? `${account}@example.com` : 'admin@example.com',
        role,
      };
      setUser(mockUser);
      localStorage.setItem('mockUser', JSON.stringify(mockUser));
    } catch (error) {
      console.error('Sign in error:', error);
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('mockUser');
      setUser(null);
      // await signOut(auth); // 不调用真实的 firebase signOut，避免报错
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
