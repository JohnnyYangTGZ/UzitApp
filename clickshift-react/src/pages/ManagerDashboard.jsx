import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { supabase } from '../lib/supabaseClient';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { clinics, selectedClinicId } = useLocationContext();
  
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay()); // 0-6 (Sun-Sat)
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All Staff');
  
  const [dashboardData, setDashboardData] = useState({
    weeklyCoverage: [],
    rosterByDay: {}
  });

  const ANCHOR_DATE = new Date(2025, 11, 14);

  useEffect(() => {
    if (!selectedClinicId) return;

    async function fetchData() {
      setLoading(true);

      // Determine the 7 days of the selected week
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + (weekOffset * 7));

      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - targetDate.getDay()); // Sunday

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        
        const utcDate = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        const utcAnchor = Date.UTC(ANCHOR_DATE.getFullYear(), ANCHOR_DATE.getMonth(), ANCHOR_DATE.getDate());
        const diffDays = Math.round((utcDate - utcAnchor) / (1000 * 60 * 60 * 24));
        const cycleIndex = ((diffDays % 14) + 14) % 14;
        
        weekDates.push({
          date: d,
          cycleIndex,
          dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        });
      }

      const minDateStr = weekDates[0].dateStr;
      const maxDateStr = weekDates[6].dateStr;

      // 1. Fetch users for this clinic
      const { data: clinicUsers } = await supabase
        .from('employee_clinics')
        .select('user_id')
        .eq('clinic_id', selectedClinicId);
      const userIds = (clinicUsers || []).map(cu => cu.user_id);

      // 2. Fetch profiles & users
      let profiles = [];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('employee_profiles')
          .select(`
            *,
            users:user_id ( id, name )
          `)
          .in('user_id', userIds)
          .eq('is_active', true);
        profiles = profs || [];
      }

      // 3. Fetch Time Off for the whole week
      let timeOffs = [];
      if (userIds.length > 0) {
        const { data: offData } = await supabase
          .from('time_off_requests')
          .select('*')
          .eq('status', 'approved')
          .in('user_id', userIds)
          .lte('start_date', maxDateStr)
          .gte('end_date', minDateStr);
        timeOffs = offData || [];
      }

      // 4. Fetch Requirements
      const { data: reqs } = await supabase
        .from('coverage_requirements')
        .select('*')
        .eq('location_id', selectedClinicId);

      // Build data structures
      let weeklyCoverage = [];
      let rosterByDay = {};

      weekDates.forEach((dayData, index) => {
        let required = { RN: 0, LVN: 0, MA: 0, OTHER: 0, total: 0 };
        let actual = { RN: 0, LVN: 0, MA: 0, OTHER: 0, total: 0 };
        let workingStaff = [];
        
        // Calculate requirements for this day
        (reqs || []).forEach(req => {
          let pattern = req.schedule_pattern;
          if (typeof pattern === 'string') {
            try { pattern = JSON.parse(pattern.replace('{', '[').replace('}', ']')); } catch(e) {}
          }
          if (Array.isArray(pattern)) {
            const dayVal = pattern[dayData.cycleIndex];
            if (dayVal !== false && dayVal !== null && dayVal !== undefined) {
              let role = req.staffing_role?.toUpperCase().trim() || 'OTHER';
              if (!['RN', 'LVN', 'MA'].includes(role)) role = 'OTHER';
              required[role] += (req.required_count || 1);
              required.total += (req.required_count || 1);
            }
          }
        });

        // Calculate actual assigned for this day
        profiles.forEach(prof => {
          let pattern = prof.schedule_pattern;
          if (typeof pattern === 'string') {
            try { pattern = JSON.parse(pattern.replace('{', '[').replace('}', ']')); } catch(e) {}
          }
          if (Array.isArray(pattern)) {
            const dayVal = pattern[dayData.cycleIndex];
            if (dayVal !== false && dayVal !== null && dayVal !== undefined) {
              const isOff = timeOffs.some(to => to.user_id === prof.user_id && to.start_date <= dayData.dateStr && to.end_date >= dayData.dateStr);
              
              let role = prof.staffing_role?.toUpperCase().trim() || 'OTHER';
              if (!['RN', 'LVN', 'MA'].includes(role)) role = 'OTHER';
              
              const effectiveShiftTime = typeof dayVal === 'string' ? dayVal : prof.shift_time;

              workingStaff.push({
                ...prof,
                effectiveShiftTime,
                isOff,
                status: isOff ? 'Offsite' : 'Onsite'
              });
            
            if (!isOff) {
              actual[role] += 1;
              actual.total += 1;
            }
          }
        }
      });
        
        const gap = required.RN > actual.RN || required.LVN > actual.LVN || required.MA > actual.MA;
        
        weeklyCoverage.push({
          date: dayData.date,
          dateStr: dayData.dateStr,
          required,
          actual,
          gap
        });
        
        // Sort roster: Onsite first, then alphabetical
        workingStaff.sort((a, b) => {
          if (a.isOff !== b.isOff) return a.isOff ? 1 : -1;
          const nameA = a.users?.name || '';
          const nameB = b.users?.name || '';
          return nameA.localeCompare(nameB);
        });
        
        rosterByDay[index] = workingStaff;
      });

      setDashboardData({
        weeklyCoverage,
        rosterByDay
      });
      
      setLoading(false);
    }
    fetchData();
  }, [selectedClinicId, weekOffset]);

  const clinicName = clinics.find(c => c.id === selectedClinicId)?.name || 'Loading Clinic...';
  const currentRoster = dashboardData.rosterByDay[selectedDayIndex] || [];
  const selectedDate = dashboardData.weeklyCoverage?.[selectedDayIndex]?.date;
  
  const allRolesInWeek = Array.from(
    new Set(Object.values(dashboardData.rosterByDay).flat().map(s => s.staffing_role))
  ).filter(Boolean).sort();

  const filteredRoster = selectedRoleFilter === 'All Staff' 
    ? currentRoster 
    : currentRoster.filter(s => s.staffing_role === selectedRoleFilter);

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-h1 text-h1 text-primary mb-1">Weekly Staffing Overview</h1>
            <p className="font-body-md text-on-surface-variant">
              {dashboardData.weeklyCoverage.length > 0 ? (
                <>Week of {dashboardData.weeklyCoverage[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {clinicName}</>
              ) : (
                <>{clinicName}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Week Toggles */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setWeekOffset(w => w - 1)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all flex items-center"
                title="Previous Week"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button 
                onClick={() => { setWeekOffset(0); setSelectedDayIndex(new Date().getDay()); }}
                className={`px-4 py-1.5 text-sm font-semibold rounded transition-all ${weekOffset === 0 ? 'bg-white shadow-sm text-primary' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
              >
                Current Week
              </button>
              <button 
                onClick={() => setWeekOffset(w => w + 1)}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all flex items-center"
                title="Next Week"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
            
            <button className="px-4 py-2 border border-secondary text-secondary rounded-lg font-label-sm hover:bg-secondary hover:text-white transition-colors">
              Download Report
            </button>
          </div>
        </div>

        {/* 7-Day Matrix */}
        {loading ? (
          <div className="h-48 bg-white rounded-xl border border-surface-border shadow-sm flex items-center justify-center mb-8">
            <span className="text-slate-400">Loading weekly schedule...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-10">
            {dashboardData.weeklyCoverage.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              const isToday = new Date().toDateString() === day.date.toDateString();
              
              return (
                <div 
                  key={idx} 
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                    isSelected ? 'border-primary ring-2 ring-primary shadow-md transform scale-[1.02]' : 
                    day.gap ? 'border-error/30 hover:border-error/50 hover:shadow-sm' : 'border-surface-border hover:border-primary/30 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {day.date.toLocaleDateString('en-US', { weekday: 'short' })} {isToday && '(Today)'}
                      </div>
                      <div className={`text-2xl font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-on-background'}`}>
                        {day.date.getDate()}
                      </div>
                    </div>
                    {day.gap && (
                      <span className="material-symbols-outlined text-error text-[20px]" title="Coverage Shortage">warning</span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-medium">RN</span>
                      <span className={day.actual.RN < day.required.RN ? 'text-error font-bold' : 'text-status-approved font-bold'}>
                        {day.actual.RN} <span className="text-xs font-normal text-slate-400">/ {day.required.RN}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-medium">LVN</span>
                      <span className={day.actual.LVN < day.required.LVN ? 'text-error font-bold' : 'text-status-approved font-bold'}>
                        {day.actual.LVN} <span className="text-xs font-normal text-slate-400">/ {day.required.LVN}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-medium">MA</span>
                      <span className={day.actual.MA < day.required.MA ? 'text-error font-bold' : 'text-status-approved font-bold'}>
                        {day.actual.MA} <span className="text-xs font-normal text-slate-400">/ {day.required.MA}</span>
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress bar indicator */}
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-4 overflow-hidden">
                    <div 
                      className={`h-full ${day.gap ? 'bg-error' : 'bg-status-approved'}`} 
                      style={{ width: `${day.required.total ? Math.min(100, (day.actual.total / day.required.total) * 100) : 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Daily Roster Header */}
        <div className="flex items-center justify-between mb-4">
           <div>
             <h2 className="text-h2 font-h2 text-on-background">
               Staff Roster
             </h2>
             <p className="text-body-md text-on-surface-variant">
               {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Loading...'}
             </p>
           </div>
        </div>

        {/* High-Density Operational Board */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden mb-12">
          <div className="p-4 bg-surface-container-low border-b border-surface-border flex justify-between items-center">
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedRoleFilter('All Staff')}
                className={`px-3 py-1 rounded font-label-sm transition-colors ${selectedRoleFilter === 'All Staff' ? 'bg-white border border-surface-border text-primary shadow-sm' : 'text-on-surface-variant hover:bg-white/50'}`}
              >
                All Staff
              </button>
              {allRolesInWeek.map(role => (
                <button 
                  key={role}
                  onClick={() => setSelectedRoleFilter(role)}
                  className={`px-3 py-1 rounded font-label-sm transition-colors ${selectedRoleFilter === role ? 'bg-white border border-surface-border text-primary shadow-sm' : 'text-on-surface-variant hover:bg-white/50'}`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-status-onsite"></span>
                <span className="text-label-sm">Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-status-off"></span>
                <span className="text-label-sm">Off / Leave</span>
              </div>
            </div>
          </div>

          {/* Grid Header */}
          <div className="grid grid-cols-[240px_1.5fr_1fr_140px_140px_180px] bg-slate-50 border-b border-surface-border text-label-sm text-on-surface-variant font-bold uppercase tracking-wider px-6 py-3">
            <div>Employee Name</div>
            <div>Clinic</div>
            <div>Role</div>
            <div>Shift Window</div>
            <div>Status</div>
            <div className="text-right">Schedule</div>
          </div>

          {/* Grid Rows */}
          <div className="divide-y divide-surface-border min-h-[200px]">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading roster...</div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No staff scheduled for this day.</div>
            ) : (
              filteredRoster.map(staff => (
                <div key={staff.user_id} className={`grid grid-cols-[240px_1.5fr_1fr_140px_140px_180px] px-6 py-3 items-center hover:bg-slate-50 transition-colors ${staff.isOff ? 'bg-slate-50/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden ${staff.isOff ? 'bg-slate-200 text-slate-500' : 'bg-primary-fixed text-primary'}`}>
                      {staff.users?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className={`font-data-tabular ${staff.isOff ? 'text-slate-400' : 'text-on-background'}`}>{staff.users?.name}</p>
                      <p className="text-[11px] text-on-surface-variant">ID: {staff.employee_code || 'N/A'}</p>
                    </div>
                  </div>
                  <div className={`text-body-md font-medium text-on-surface-variant truncate pr-4 ${staff.isOff ? 'opacity-60' : ''}`}>
                    {clinicName}
                  </div>
                  <div className={`text-body-md font-medium text-on-surface-variant ${staff.isOff ? 'opacity-60' : ''}`}>
                    {{
                      'RN': 'Registered Nurse',
                      'MA': 'Medical Assistant',
                      'LVN': 'Licensed Vocational Nurse'
                    }[staff.staffing_role] || staff.staffing_role || staff.job_title}
                  </div>
                  <div className={`text-data-tabular ${staff.isOff ? 'text-slate-400' : ''}`}>{staff.effectiveShiftTime || '08:00 – 16:00 (AM)'}</div>
                  <div>
                    {staff.isOff ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-status-off text-label-sm border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-off"></span>
                        Offsite
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-status-onsite text-label-sm border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-onsite"></span>
                        Scheduled
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-1">
                    {staff.isOff ? (
                      <div className="w-12 h-6 border border-dashed border-slate-300 rounded-sm flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase">OFF</div>
                    ) : (
                      <>
                        <div className="w-12 h-6 bg-primary rounded-sm flex items-center justify-center text-[9px] text-white font-bold">WORK</div>
                        <div className="w-12 h-6 bg-slate-100 rounded-sm flex items-center justify-center text-[9px] text-slate-400 font-bold">OFF</div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-surface-border flex justify-between items-center">
            <span className="text-body-md text-on-surface-variant">Showing {filteredRoster.length} staff members</span>
            <div className="flex gap-2">
              <button className="p-1 rounded hover:bg-white text-on-surface-variant disabled:opacity-50" disabled>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="px-2 py-1 bg-white border border-surface-border rounded text-body-md font-medium">1</button>
              <button className="p-1 rounded hover:bg-white text-on-surface-variant disabled:opacity-50" disabled>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pending PTO Requests (Mocked) */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 font-h2 text-on-background">
              Pending Time Off Requests
            </h2>
            <button className="text-primary font-label-sm hover:underline">View All Requests</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Mock Card 1 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg border border-orange-100">
                    S
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">Sarah Jenkins</p>
                    <p className="text-xs text-on-surface-variant font-medium">Medical Assistant</p>
                  </div>
                </div>
                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Pending</span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">calendar_month</span> Dates</span>
                  <span className="text-sm font-bold text-slate-700">Oct 12 - Oct 15</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">schedule</span> Time</span>
                  <span className="text-sm font-bold text-slate-700">Full Shift</span>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">beach_access</span> Type</span>
                  <span className="text-sm font-bold text-slate-700">PTO / Vacation</span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 italic">"Taking a family trip out of state."</p>
              
              <div className="flex gap-3 mt-2">
                <button className="flex-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 py-2 rounded-lg text-sm font-bold transition-colors">Deny</button>
                <button className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow py-2 rounded-lg text-sm font-bold transition-all">Approve</button>
              </div>
            </div>

            {/* Mock Card 2 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
                    M
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">Marcus Thorne</p>
                    <p className="text-xs text-on-surface-variant font-medium">Registered Nurse</p>
                  </div>
                </div>
                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Pending</span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">calendar_month</span> Dates</span>
                  <span className="text-sm font-bold text-slate-700">Nov 02</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">schedule</span> Time</span>
                  <span className="text-sm font-bold text-slate-700">08:00 - 12:00</span>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">medical_services</span> Type</span>
                  <span className="text-sm font-bold text-slate-700">Sick Leave</span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 italic">"Scheduled dental surgery."</p>
              
              <div className="flex gap-3 mt-2">
                <button className="flex-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 py-2 rounded-lg text-sm font-bold transition-colors">Deny</button>
                <button className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow py-2 rounded-lg text-sm font-bold transition-all">Approve</button>
              </div>
            </div>

            {/* Mock Card 3 */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg border border-purple-100">
                    E
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">Elena Rodriguez</p>
                    <p className="text-xs text-on-surface-variant font-medium">Licensed Voc. Nurse</p>
                  </div>
                </div>
                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Pending</span>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">calendar_month</span> Dates</span>
                  <span className="text-sm font-bold text-slate-700">Dec 20 - Jan 02</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">schedule</span> Time</span>
                  <span className="text-sm font-bold text-slate-700">Full Shift</span>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">flight_takeoff</span> Type</span>
                  <span className="text-sm font-bold text-slate-700">PTO / Holiday</span>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 italic">"Holiday travel to see parents."</p>
              
              <div className="flex gap-3 mt-2">
                <button className="flex-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 py-2 rounded-lg text-sm font-bold transition-colors">Deny</button>
                <button className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow py-2 rounded-lg text-sm font-bold transition-all">Approve</button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
}
