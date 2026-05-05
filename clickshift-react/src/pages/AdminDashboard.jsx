import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import CreateRoleModal from '../components/CreateRoleModal';
import CreateClinicModal from '../components/CreateClinicModal';

export default function AdminDashboard() {
  const { clinics, selectedClinicId, setSelectedClinicId, loadingClinics } = useLocationContext();
  const navigate = useNavigate();
  
  const handleAddEmployee = () => {
    navigate('/employees');
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-new-employee')), 100);
  };

  const handleAddShift = () => {
    navigate('/shifts');
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-new-template')), 100);
  };
  
  const [employeeCount, setEmployeeCount] = useState(0); // Keeping for backwards compatibility if used elsewhere
  const [departmentEmployeeCount, setDepartmentEmployeeCount] = useState(0);
  const [clinicSupportCount, setClinicSupportCount] = useState(0);
  const [clinicDailyShiftCounts, setClinicDailyShiftCounts] = useState({
    RN: [0, 0, 0, 0, 0, 0, 0],
    LVN: [0, 0, 0, 0, 0, 0, 0],
    MA: [0, 0, 0, 0, 0, 0, 0],
    OTHER: [0, 0, 0, 0, 0, 0, 0]
  });
  const [clinicActualShiftCounts, setClinicActualShiftCounts] = useState({
    RN: [0, 0, 0, 0, 0, 0, 0],
    LVN: [0, 0, 0, 0, 0, 0, 0],
    MA: [0, 0, 0, 0, 0, 0, 0],
    OTHER: [0, 0, 0, 0, 0, 0, 0]
  });
  const [staffOff, setStaffOff] = useState([]);
  const [staffOnCall, setStaffOnCall] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [currentDepartmentId, setCurrentDepartmentId] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedClinicId) return;

    async function loadClinicData() {
      setLoadingStats(true);
      // Get selected clinic details to find department_id
      const { data: clinicData } = await supabase
        .from('locations')
        .select('parent_location_id')
        .eq('id', selectedClinicId)
        .single();
      
      const departmentId = clinicData?.parent_location_id;
      setCurrentDepartmentId(departmentId);

      // 1. Department Employees Count
      if (departmentId) {
        const { count: deptCount } = await supabase
          .from('employee_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('department_id', departmentId)
          .eq('is_active', true);
        setDepartmentEmployeeCount(deptCount || 0);
      } else {
        setDepartmentEmployeeCount(0);
      }

      // Fetch users for this clinic first
      const { data: clinicUsers } = await supabase
        .from('employee_clinics')
        .select('user_id')
        .eq('clinic_id', selectedClinicId);
      
      const validUserIds = (clinicUsers || []).map(cu => cu.user_id);
      
      // 2. Clinic Support Count
      setClinicSupportCount(validUserIds.length);

      // Fetch Employee Profiles to calculate ACTUAL scheduled shifts
      const actualCounts = {
        RN: [0, 0, 0, 0, 0, 0, 0],
        LVN: [0, 0, 0, 0, 0, 0, 0],
        MA: [0, 0, 0, 0, 0, 0, 0],
        OTHER: [0, 0, 0, 0, 0, 0, 0]
      };
      
      if (validUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('employee_profiles')
          .select('staffing_role, schedule_pattern')
          .in('user_id', validUserIds)
          .eq('is_active', true);
          
        if (profiles) {
          profiles.forEach(prof => {
            let role = prof.staffing_role?.toUpperCase().trim() || 'OTHER';
            if (!['RN', 'LVN', 'MA'].includes(role)) role = 'OTHER';
            
            let pattern = prof.schedule_pattern;
            if (typeof pattern === 'string') {
              try {
                pattern = JSON.parse(pattern.replace('{', '[').replace('}', ']'));
              } catch(e) {}
            }
            
            if (Array.isArray(pattern)) {
              const startIdx = weekOffset * 7;
              for (let i = 0; i < 7; i++) {
                const val = pattern[startIdx + i];
                if (val !== false && val !== null && val !== undefined) {
                  actualCounts[role][i] += 1;
                }
              }
            }
          });
        }
      }
      setClinicActualShiftCounts(actualCounts);

      // 3. Clinic Daily Shifts
      const { data: reqs } = await supabase
        .from('coverage_requirements')
        .select('staffing_role, required_count, schedule_pattern')
        .eq('location_id', selectedClinicId);
      
      const dailyCounts = {
        RN: [0, 0, 0, 0, 0, 0, 0],
        LVN: [0, 0, 0, 0, 0, 0, 0],
        MA: [0, 0, 0, 0, 0, 0, 0],
        OTHER: [0, 0, 0, 0, 0, 0, 0]
      };
      
      if (reqs) {
        reqs.forEach(req => {
          let role = req.staffing_role?.toUpperCase().trim() || 'OTHER';
          if (!['RN', 'LVN', 'MA'].includes(role)) role = 'OTHER';
          
          let pattern = req.schedule_pattern;
          if (typeof pattern === 'string') {
            try {
              pattern = JSON.parse(pattern.replace('{', '[').replace('}', ']'));
            } catch(e) {}
          }
          
          if (Array.isArray(pattern)) {
            const startIdx = weekOffset * 7;
            for (let i = 0; i < 7; i++) {
              const val = pattern[startIdx + i];
              if (val !== false && val !== null && val !== undefined) {
                dailyCounts[role][i] += (req.required_count || 1);
              }
            }
          }
        });
      }
      setClinicDailyShiftCounts(dailyCounts);

      if (validUserIds.length > 0) {
        // Fetch Staff Off Today (using local date)
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const { data: offData } = await supabase
          .from('time_off_requests')
          .select(`
            id,
            reason,
            users ( id, name ),
            time_off_types ( name )
          `)
          .eq('status', 'approved')
          .in('user_id', validUserIds)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr);
        
        setStaffOff(offData || []);

        const { data: onCallAvail } = await supabase
          .from('employee_availability')
          .select(`
            user_id, shift_time, notes,
            users ( name ),
            employee_profiles!inner ( job_title )
          `)
          .eq('date', todayStr)
          .in('user_id', validUserIds);

        setStaffOnCall(onCallAvail || []);
      } else {
        setStaffOff([]);
        setStaffOnCall([]);
      }
      
      setLoadingStats(false);
    }
    
    loadClinicData();
  }, [selectedClinicId, weekOffset]);

  // Determine current date
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Layout>
      <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Welcome Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h2 className="font-h1 text-h1 text-on-surface">Admin Dashboard</h2>
            </div>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">Operational health overview for {currentDate}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 bg-status-approved/10 text-status-approved px-3 py-1.5 rounded-full text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-status-approved animate-pulse"></span>
              System Online
            </div>
          </div>
        </div>

        {/* Bento Grid - Stats & Management */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* System Overview Stats */}
          <div className="md:col-span-8 flex flex-col h-full">
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-surface-border shadow-sm flex flex-col justify-between h-full relative">
              <div>
                <div className="flex items-center justify-center gap-4 mb-6 relative">
                  <button 
                    onClick={() => setWeekOffset(0)}
                    disabled={weekOffset === 0}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center absolute left-0 bg-slate-50 border border-slate-200 transition-colors"
                    title="Previous Week"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase text-center">
                    Daily Staffing Health <span className="font-semibold text-primary ml-1">W{weekOffset + 1}</span>
                  </p>
                  <button 
                    onClick={() => setWeekOffset(1)}
                    disabled={weekOffset === 1}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center absolute right-0 bg-slate-50 border border-slate-200 transition-colors"
                    title="Next Week"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
                {loadingStats ? (
                  <div className="h-16 flex items-center justify-center text-slate-400 text-sm">Loading...</div>
                ) : (
                  <div className="w-full text-center max-w-2xl mx-auto flex flex-col gap-8">
                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="grid grid-cols-8 gap-2 mb-3">
                        <div className="text-xs font-bold text-slate-400 flex items-center">ROLE</div>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                          <div key={i} className="text-xs font-bold text-slate-500 py-1">{day}</div>
                        ))}
                      </div>
                      {['RN', 'LVN', 'MA'].map(role => (
                        <div key={role} className="grid grid-cols-8 gap-2 items-center mb-2">
                          <div className="text-sm font-bold text-slate-600 text-left">{role}</div>
                          {clinicActualShiftCounts[role].map((actual, i) => {
                            const required = clinicDailyShiftCounts[role][i];
                            let cellStyle = 'text-slate-300 bg-white border border-slate-100'; // Default / Grey (Actual == 0 && Required == 0)
                            
                            if (required > 0 || actual > 0) {
                              if (actual === required) {
                                cellStyle = 'bg-emerald-100 text-emerald-700'; // Enough
                              } else if (actual > required) {
                                cellStyle = 'bg-amber-100 text-amber-700'; // Too many
                              } else {
                                cellStyle = 'bg-rose-100 text-rose-700'; // Not enough
                              }
                            }
                            
                            return (
                              <div key={i} className={`text-xs font-semibold rounded-md py-1.5 ${cellStyle} flex items-center justify-center gap-1`}>
                                <span>{actual}</span>
                                <span className="opacity-60 font-normal text-[10px]">({required})</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-6 text-slate-500">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-400"></span> <span className="text-sm font-semibold">OK</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400"></span> <span className="text-sm font-semibold">Over</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-400"></span> <span className="text-sm font-semibold">Short</span></div>
              </div>
            </div>
          </div>

          {/* Quick Management Cards */}
          <div className="md:col-span-4 bg-primary text-white p-6 rounded-xl shadow-lg relative overflow-hidden flex flex-col justify-start h-full">
            <div className="relative z-10 mb-6">
              <h3 className="font-h3 text-h3 text-white">Administrative Actions</h3>
              <p className="text-blue-100 text-sm mt-1">Configure global system parameters</p>
            </div>
            <div className="space-y-3 relative z-10">
              <button onClick={handleAddEmployee} className="w-full flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">person_add</span>
                  <span className="font-semibold text-sm">Add Employee</span>
                </div>
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
              <button onClick={handleAddShift} className="w-full flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">edit_calendar</span>
                  <span className="font-semibold text-sm">Add Shift</span>
                </div>
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
              <button onClick={() => setIsRoleModalOpen(true)} className="w-full flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">badge</span>
                  <span className="font-semibold text-sm">Create Staff Type</span>
                </div>
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
              <button onClick={() => setIsClinicModalOpen(true)} className="w-full flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">domain_add</span>
                  <span className="font-semibold text-sm">Create Clinic</span>
                </div>
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
              <button onClick={() => navigate('/settings')} className="w-full flex items-center justify-between p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">settings</span>
                  <span className="font-semibold text-sm">Enter Settings</span>
                </div>
                <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
              </button>
            </div>
            {/* Decorative Background Element */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none"></div>
          </div>
        </div>

        {/* Dashboard Middle Section */}
        <div className="grid grid-cols-1 gap-8">
          {/* Today's Adjustments */}
          <div className="space-y-6">
            <h3 className="font-h2 text-h2 text-on-surface">Today's Adjustments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Staff Off Today */}
              <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border bg-slate-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500">event_busy</span>
                  <h4 className="font-semibold text-on-surface">Staff Off Today</h4>
                </div>
                <div className="p-2">
                  {loadingStats ? (
                    <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
                  ) : staffOff.length > 0 ? (
                    staffOff.map(req => (
                      <div key={req.id} className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex justify-between items-center group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                            {req.users?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{req.users?.name}</p>
                            <p className="text-xs text-slate-500">{req.time_off_types?.name} &bull; {req.reason}</p>
                          </div>
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{req.reason || 'No reason'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-500">No staff scheduled off today.</div>
                  )}
                </div>
              </div>

              {/* Staff On Call */}
              <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border bg-slate-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500">contact_phone</span>
                  <h4 className="font-semibold text-on-surface">Available On-Call</h4>
                </div>
                <div className="p-2">
                  {loadingStats ? (
                    <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
                  ) : staffOnCall.length > 0 ? (
                    staffOnCall.map(staff => (
                      <div key={staff.user_id} className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex justify-between items-center group cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                            {staff.users?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{staff.users?.name}</p>
                            <p className="text-xs text-slate-500">
                              {staff.employee_profiles?.job_title}
                              {staff.notes && <span className="text-slate-400 italic ml-1">- {staff.notes}</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{staff.shift_time || 'Any'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-500">No on-call staff available.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      
      <CreateRoleModal 
        isOpen={isRoleModalOpen} 
        onClose={() => setIsRoleModalOpen(false)} 
        departmentId={currentDepartmentId}
      />
      
      <CreateClinicModal 
        isOpen={isClinicModalOpen} 
        onClose={() => setIsClinicModalOpen(false)} 
        departmentId={currentDepartmentId}
        onSuccess={() => window.location.reload()}
      />
    </Layout>
  );
}
