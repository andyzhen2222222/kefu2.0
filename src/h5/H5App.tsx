import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import LoginPage from '@/src/components/auth/LoginPage';
import H5MailboxPage from './H5MailboxPage';
import IntellideskSourceStrip from '@/src/components/dev/IntellideskSourceStrip';

export default function H5App() {
  const { user } = useAuth();

  return (
    <Router>
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
        <IntellideskSourceStrip />
        <Routes>
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
          <Route
            element={user ? <Outlet /> : <Navigate to="/login" replace />}
          >
            <Route path="/" element={<H5MailboxPage />} />
            <Route path="/ticket/:ticketId" element={<H5MailboxPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}