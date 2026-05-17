import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import LoginPage from '@/src/components/auth/LoginPage';
import H5Shell from './H5Shell';
import H5BiPage from './H5BiPage';
import H5MailboxPage from './H5MailboxPage';
import H5MePage from './H5MePage';

export default function H5App() {
  const { user } = useAuth();

  return (
    <Router>
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
        <Routes>
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/bi" replace />} />
          <Route
            element={user ? <Outlet /> : <Navigate to="/login" replace />}
          >
            <Route element={<H5Shell />}>
              <Route path="/bi" element={<H5BiPage />} />
              <Route path="/inbox" element={<H5MailboxPage />} />
              <Route path="/ticket/:ticketId" element={<H5MailboxPage />} />
              <Route path="/me" element={<H5MePage />} />
              <Route path="/" element={<Navigate to="/bi" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/bi" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
