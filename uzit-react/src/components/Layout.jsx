import Header from './Header';
import Sidebar from './Sidebar';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { activeRole, user } = useAuth();
  const location = useLocation();
  const role = activeRole || user?.role;

  const isStaff = role === 'staff';

  // Mobile Nav: Removed Employees & Shifts. At bottom show Schedule!
  const mobileNavItems = isStaff
    ? [
        { name: 'Dashboard', icon: 'dashboard', path: '/staff' },
        { name: 'Calendar', icon: 'calendar_month', path: '/my-schedule' },
      ]
    : [
        { name: 'Schedule', icon: 'calendar_month', path: '/manager' },
        { name: 'Calendar', icon: 'event_busy', path: '/manager/calendar' },
      ];

  return (
    <div className="bg-surface-background text-on-surface min-h-screen flex flex-col">
      <Header />
      <Sidebar />
      
      <main className="ml-0 md:ml-64 pt-16 md:pt-24 px-3 md:px-8 pb-20 md:pb-12 flex-1">
        {children}
      </main>

      {/* Simplified Mobile Bottom Navigation Bar: Schedule Focus */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-1.5 justify-around items-center shadow-lg">
        {mobileNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>

      <footer className="ml-0 md:ml-64 p-4 md:p-8 border-t border-slate-200 text-slate-500 text-xs md:text-sm flex flex-col md:flex-row gap-3 justify-between items-center bg-white mt-auto pb-20 md:pb-8">
        <div>© 2023 Uzit Operations. All rights reserved.</div>
        <div className="flex gap-6">
          <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors" href="#">Help Center</a>
          <a className="hover:text-primary transition-colors" href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
