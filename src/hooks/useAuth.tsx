import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { registerIntellideskBearerTokenGetter } from '@/src/services/intellideskApi';
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

    return () => unsubscribe();
  }, []);

  const signIn = async (account?: string) => {
    try {
      // 若有输入特定账号，可用于简单 mock 不同角色（比如包含 agent 字样就给一线客服角色）
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
      console.error("Sign in error:", error);
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
