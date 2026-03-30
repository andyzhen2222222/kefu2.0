import { Navigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { getDefaultSettingsPath } from './settingsNavConfig';

export default function SettingsIndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={getDefaultSettingsPath(user?.role)} replace />;
}
