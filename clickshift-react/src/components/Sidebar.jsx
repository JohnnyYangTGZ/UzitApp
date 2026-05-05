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
  const { clinics, selectedClinicId, setSelectedClinicId, loadingClinics } = useLocationContext();

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
    { name: 'Time Off Calendar', icon: 'event_busy', path: '/manager/calendar' },
    { name: 'Employees', icon: 'group', path: '/employees' },
    { name: 'Shifts', icon: 'calendar_view_week', path: '/shifts' },
  ];

  const adminItems = [
    { name: 'Admin Dashboard', icon: 'dashboard', path: '/admin' },
    { name: 'Auto-Scheduler', icon: 'auto_awesome', path: '/scheduler' },
    { name: 'Employees', icon: 'group', path: '/employees' },
    { name: 'Shifts', icon: 'calendar_view_week', path: '/shifts' },
  ];

  const navItems = isAdmin ? adminItems : isStaff ? staffItems : managerItems;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-slate-200 z-40 bg-slate-50 font-['Inter'] font-medium text-sm flex flex-col pt-20 pb-6">
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
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.name}
              to={item.path}
              className={`flex items-center px-4 py-3 gap-3 transition-all rounded-lg ${
                isActive 
                  ? 'bg-blue-50 text-blue-800 border-r-4 border-blue-700' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4 space-y-1">
        {location.pathname === '/employees' || (location.pathname === '/scheduler' && viewParam === 'employees') ? (
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-new-employee'))}
            className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            New Employee
          </button>
        ) : location.pathname === '/shifts' ? (
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-new-template'))}
            className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Template
          </button>
        ) : !isStaff && (
          <button 
            onClick={() => setIsAddShiftModalOpen(true)}
            className="w-full bg-blue-900 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 mb-6 hover:bg-blue-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Ad-hoc Shift
          </button>
        )}
        {isAdmin && (
          <Link to="/settings" className="text-slate-600 flex items-center px-4 py-3 gap-3 hover:bg-slate-100 transition-all rounded-lg">
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
        onClose={() => setIsAddShiftModalOpen(false)} 
        onSuccess={() => {
          // If on admin or weekly-board, reload to see new data
          if (location.pathname === '/admin' || location.pathname === '/weekly-board') {
            window.location.reload();
          }
        }} 
      />
    </aside>
  );
}
