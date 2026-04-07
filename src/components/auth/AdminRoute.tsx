import { Navigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';

/** 仅 `role === 'admin'` 可访问，否则回首页 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}
