import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import IntellideskSourceStrip from '@/src/components/dev/IntellideskSourceStrip';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <IntellideskSourceStrip />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
