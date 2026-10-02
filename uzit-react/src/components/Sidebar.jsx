import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import AddShiftModal from './AddShiftModal';

export default function Sidebar() {
  const { user, activeRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const viewParam = searchParams.get('view');
  
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [addShiftInitialData, setAddShiftInitialData] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { clinics, selectedClinicId, setSelectedClinicId, loadingClinics } = useLocationContext();

  useEffect(() => {
    const handleOpenShift = (e) => {
      setAddShiftInitialData(e.detail || null);
      setIsAddShiftModalOpen(true);
    };
    const handleToggleMobileSidebar = () => {
      setMobileOpen(prev => !prev);
    };

    window.addEventListener('open-add-shift', handleOpenShift);
    window.addEventListener('toggle-mobile-sidebar', handleToggleMobileSidebar);

    return () => {
      window.removeEventListener('open-add-shift', handleOpenShift);
      window.removeEventListener('toggle-mobile-sidebar', handleToggleMobileSidebar);
    };
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Reset "ALL" clinic selection if navigating away from the calendar
  useEffect(() => {
    if (selectedClinicId === 'ALL' && location.pathname !== '/manager/calendar' && clinics.length > 0) {
      setSelectedClinicId(clinics[0].id);
    }
  }, [location.pathname, selectedClinicId, clinics, setSelectedClinicId]);

  const role = activeRole || user?.role;
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';

  const staffItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/staff' },
    { name: 'My Schedule', icon: 'calendar_view_week', path: '/my-schedule' },
    { name: 'Requests', icon: 'pending_actions', path: '/requests' },
  ];

  const managerItems = [
    { name: 'Manager\'s Dashboard', icon: 'dashboard', path: '/manager' },
    { name: 'Calendar', icon: 'event_busy', path: '/manager/calendar' },
    { name: 'Employees', icon: 'group', path: '/employees' },
    { name: 'Shifts', icon: 'calendar_view_week', path: '/shifts' },
  ];

  const adminItems = [
    { name: 'Admin Dashboard', icon: 'dashboard', path: '/admin' },
    { name: 'Schedule Editor', icon: 'calendar_month', path: '/scheduler' },
    { name: 'Employees', icon: 'group', path: '/employees' },
    { name: 'Shifts', icon: 'calendar_view_week', path: '/shifts' },
  ];

  // Streamlined mobile items: Removes complex admin tools on mobile devices
  const mobileItems = isStaff
    ? staffItems
    : [
        { name: 'Manager\'s Dashboard', icon: 'dashboard', path: '/manager' },
        { name: 'Calendar', icon: 'event_busy', path: '/manager/calendar' },
        { name: 'Employees', icon: 'group', path: '/employees' },
        { name: 'My Schedule', icon: 'calendar_view_week', path: '/my-schedule' },
      ];

  const desktopItems = isAdmin ? adminItems : isStaff ? staffItems : managerItems;

  return (
    <>
      {/* Mobile Dark Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-full w-64 border-r border-slate-200 z-50 bg-slate-50 font-['Inter'] font-medium text-sm flex flex-col pt-20 pb-6 transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Mobile Header Close Button */}
        <div className="flex md:hidden items-center justify-between px-6 mb-4">
          <span className="font-bold text-slate-900 text-sm">Navigation Menu</span>
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-6 mb-8">
          {loadingClinics ? (
            <div className="p-3 text-slate-500 text-xs">Loading clinics...</div>
          ) : isStaff ? (
            <div className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-bold py-3 px-4 rounded-xl shadow-sm cursor-not-allowed select-none">
              {clinics.find(c => c.id === selectedClinicId)?.name || 'No Clinic Assigned'}
            </div>
          ) : (
            <select 
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-900 font-bold py-3 px-4 rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer"
            >
              {location.pathname === '/manager/calendar' && (
                <option value="ALL">All Clinics</option>
              )}
              {clinics.map(clinic => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
          )}
        </div>
        
        {/* Navigation Items (Mobile vs Desktop) */}
        <nav className="flex-1 px-4 space-y-1">
          {/* Mobile Menu Items */}
          <div className="block md:hidden space-y-1">
            {mobileItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.name}
                  to={item.path}
                  className={`flex items-center px-4 py-3 gap-3 transition-all rounded-lg ${
                    isActive 
                      ? 'bg-blue-50 text-blue-800 border-r-4 border-blue-700 font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Desktop Menu Items */}
          <div className="hidden md:block space-y-1">
            {desktopItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.name}
                  to={item.path}
                  className={`flex items-center px-4 py-3 gap-3 transition-all rounded-lg ${
                    isActive 
                      ? 'bg-blue-50 text-blue-800 border-r-4 border-blue-700 font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto px-4 space-y-1">
          {location.pathname === '/employees' || (location.pathname === '/scheduler' && viewParam === 'employees') ? (
            <button 
              onClick={() => { setMobileOpen(false); window.dispatchEvent(new CustomEvent('open-new-employee')); }}
              className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              New Employee
            </button>
          ) : location.pathname === '/shifts' ? (
            <button 
              onClick={() => { setMobileOpen(false); window.dispatchEvent(new CustomEvent('open-new-template')); }}
              className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Template
            </button>
          ) : !isStaff && (
            <button 
              onClick={() => { setMobileOpen(false); setAddShiftInitialData(null); setIsAddShiftModalOpen(true); }}
              className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Ad-hoc Shift
            </button>
          )}
          {isAdmin && (
            <Link to="/settings" className="hidden md:flex text-slate-600 items-center px-4 py-3 gap-3 hover:bg-slate-100 transition-all rounded-lg">
              <span className="material-symbols-outlined">settings</span>
              Settings
            </Link>
          )}
          <button onClick={logout} className="w-full text-left text-slate-600 flex items-center px-4 py-3 gap-3 hover:bg-slate-100 transition-all rounded-lg">
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </div>

        <AddShiftModal 
          isOpen={isAddShiftModalOpen} 
          initialData={addShiftInitialData}
          onClose={() => setIsAddShiftModalOpen(false)} 
          onSuccess={() => {
            if (location.pathname === '/admin' || location.pathname === '/weekly-board') {
              window.location.reload();
            }
          }} 
        />
      </aside>
    </>
  );
}
