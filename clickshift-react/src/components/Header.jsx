import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
  const { user, activeRole, switchRole, logout } = useAuth();
  const { departments, selectedDepartmentId, setSelectedDepartmentId, loadingDepartments } = useLocationContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="fixed top-0 w-full h-16 z-50 border-b border-slate-200 bg-white flex items-center justify-between px-6 font-['Inter'] text-sm tracking-tight">
      <div className="flex items-center gap-8 w-64">
        {loadingDepartments ? (
          <div className="text-slate-500 text-xs">Loading departments...</div>
        ) : (
          <select 
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 font-bold py-2 px-3 rounded-lg focus:ring-2 focus:ring-primary outline-none shadow-sm"
          >
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-slate-50 transition-colors rounded-full text-slate-500">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 hover:bg-slate-50 transition-colors rounded-full text-slate-500">
          <span className="material-symbols-outlined">help</span>
        </button>
        <div className="relative flex items-center gap-2 pl-2 ml-2 border-l border-slate-200" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 hover:bg-slate-50 p-1 pr-2 rounded-lg transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200">
              <img 
                alt="User profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZh82-MiQXypUTSzk1Zv6MilKiH9M1qVWLCWXlX22MuwpjMLH0I6rjozMhIZzlVcF67SbEM-KGO6k5ZP9GV3PV6rZCRNLKyA9rD_e2yyML9aMpVLbBGe_4u6Llr_FNdV-LuZszbLnCqiI-CrqQhhxnjV_ZTqjjC713TDH8EnECh0mCwxS5oIYqZ1h8-Oc7mcetBv0fuaoM_VICZjow4I59BvcG7XDU6R7_NuGssqqQbkaxHbrBZ3vQfewawZJmiVCvxl1HEsUJGv3q"
              />
            </div>
            <span className="font-medium text-slate-700">
              {activeRole === 'admin' ? 'Admin Dashboard' : activeRole === 'manager' ? 'Manager Dashboard' : (user?.name || user?.email)}
            </span>
            <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden py-1 z-50">
              {user?.role === 'admin' && (
                <>
                  <div className="px-4 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Switch Dashboard</p>
                  </div>
              <button 
                onClick={() => { navigate('/admin'); setTimeout(() => switchRole('admin'), 0); setDropdownOpen(false); }}
                className="w-full text-left block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors"
              >
                Admin Dashboard
              </button>
              <button 
                onClick={() => { navigate('/manager'); setTimeout(() => switchRole('manager'), 0); setDropdownOpen(false); }}
                className="w-full text-left block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors"
              >
                Manager Dashboard
              </button>
              <div className="h-px bg-slate-100 my-1"></div>
                </>
              )}
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
