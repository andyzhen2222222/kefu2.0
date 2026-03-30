/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MailboxPage from './components/inbox/MailboxPage';
import DashboardPage from './components/dashboard/DashboardPage';
import OrdersPage from './components/order/OrdersPage';
import CustomersPage from './components/customer/CustomersPage';
import TemplatesPage from './components/settings/TemplatesPage';
import SLAPage from './components/sla/SLAPage';
import AutoReplyRulesPage from './components/rules/AutoReplyRulesPage';
import AfterSalesPage from './components/aftersales/AfterSalesPage';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/auth/LoginPage';

import SettingsLayout from './components/settings/SettingsLayout';
import DataDictionaryPage from './components/settings/DataDictionaryPage';
import SeatsAndRolesPage from './components/settings/SeatsAndRolesPage';
import RoutingRulesPage from './components/settings/RoutingRulesPage';
import SettingsIndexRedirect from './components/settings/SettingsIndexRedirect';
import TranslationSettingsPage from './components/settings/TranslationSettingsPage';
import KnowledgeBasePage from './components/settings/KnowledgeBasePage';

// Placeholder components
const Insights = () => <div className="p-8">Insights</div>;

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        
        <Route element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mailbox" element={<MailboxPage />} />
          <Route path="/mailbox/:ticketId" element={<MailboxPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/after-sales" element={<AfterSalesPage />} />
          <Route path="/insights" element={<Insights />} />
          
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<SettingsIndexRedirect />} />
            <Route path="seats" element={<SeatsAndRolesPage />} />
            <Route path="translation" element={<TranslationSettingsPage />} />
            <Route path="routing" element={<RoutingRulesPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="knowledge" element={<KnowledgeBasePage />} />
            <Route path="sla" element={<SLAPage />} />
            <Route path="rules" element={<AutoReplyRulesPage />} />
            <Route path="dictionary" element={<DataDictionaryPage />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
