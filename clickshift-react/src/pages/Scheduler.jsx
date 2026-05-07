import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import { useNavigate, useLocation } from 'react-router-dom';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10));
  d.setMinutes(parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Hardcoded Anchor Date: December 14, 2025 (A Sunday)
// This is Pay Period #1
const ANCHOR_DATE = new Date(2025, 11, 14); // Month is 0-indexed in JS (11 = December)

const getCycleDayIndex = (dateObj) => {
  const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const utcAnchor = Date.UTC(ANCHOR_DATE.getFullYear(), ANCHOR_DATE.getMonth(), ANCHOR_DATE.getDate());
  const diffDays = Math.round((utcDate - utcAnchor) / (1000 * 60 * 60 * 24));
  return ((diffDays % 14) + 14) % 14;
};

const getCycleDayLabel = (index) => {
  const week = index < 7 ? 1 : 2;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[index % 7];
  return `W${week} ${dayName.substring(0, 3)}`;
};

const getWeekDays = (dateStr) => {
  if (!dateStr) return [];
  const [y, m, d] = dateStr.split('-');
  const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  
  const dayOfWeek = targetDate.getDay();
  const startOfWeek = new Date(targetDate);
  startOfWeek.setDate(targetDate.getDate() - dayOfWeek);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    week.push(d);
  }
  return week;
};

const CoverageCell = ({ reqCount, employees, isActive, shiftTime }) => {
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10));
    d.setMinutes(parseInt(m, 10));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formattedShiftTime = shiftTime 
    ? shiftTime.split('-').map(t => formatTime(t)).join(' - ') 
    : null;

  if (!isActive) {
    return (
      <div className="h-full min-h-[80px] flex items-center justify-center">
        <span className="text-xs font-bold text-slate-400 tracking-wider">OFF</span>
      </div>
    );
  }

  const filledCount = employees?.length || 0;

  return (
    <div className="flex flex-col gap-2 h-full min-h-[80px]">
      {shiftTime && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200 shadow-sm" title="Shift Time">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {formattedShiftTime}
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        {/* Filled Slots */}
        {employees && employees.map((emp, empIdx) => {
          const isPartial = emp.partialTimeOffs && emp.partialTimeOffs.length > 0;
          return (
            <div key={empIdx} className={`flex flex-col gap-1 p-1.5 rounded shadow-sm border transition-colors ${isPartial ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${isPartial ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {emp.users?.name?.charAt(0) || '?'}
                </div>
                <span className={`font-semibold text-xs truncate ${isPartial ? 'text-amber-800' : 'text-slate-700'}`} title={emp.users?.name}>
                  {emp.users?.name}
                </span>
              </div>
              {isPartial && emp.partialTimeOffs.map((pt, i) => (
                <div key={i} className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 w-fit flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">beach_access</span>
                  Off: {formatTime(pt.start_time)} - {formatTime(pt.end_time)}
                </div>
              ))}
            </div>
          );
        })}

        {/* Unfilled Slots */}
        {Array.from({ length: Math.max(0, reqCount - filledCount) }).map((_, missingIdx) => (
          <div key={`missing-${missingIdx}`} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 border-dashed p-1.5 rounded">
            <span className="material-symbols-outlined text-[14px] text-rose-500">warning</span>
            <span className="font-semibold text-rose-700 text-xs italic">Unfilled Slot</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Scheduler() {
  const { selectedClinicId, clinics, selectedDepartmentId } = useLocationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('view') === 'employees' ? 'employees' : 'shifts';
  
  const setActiveTab = (tab) => {
    navigate(`/scheduler?view=${tab}`, { replace: true });
  };
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Default to today's date
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const shiftWeek = (days) => {
    const [y, m, d] = selectedDate.split('-');
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    current.setDate(current.getDate() + days);
    setSelectedDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  };

  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  // assignments is now a map: shift.id -> array of 7 days
  const [weeklyAssignments, setWeeklyAssignments] = useState({});
  const [employeeAssignments, setEmployeeAssignments] = useState({});
  const [weekDates, setWeekDates] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState([]);

  const clinicName = clinics.find(c => c.id === selectedClinicId)?.name || 'the selected clinic';

  useEffect(() => {
    if (selectedClinicId && selectedDepartmentId) {
      loadData();
    } else {
      setShifts([]);
      setEmployees([]);
      setWeeklyAssignments({});
      setWeekDates([]);
      setLoading(false);
    }
  }, [selectedClinicId, selectedDepartmentId]);

  useEffect(() => {
    if (shifts.length > 0 || employees.length > 0) {
      fetchAdhocAndCalculate(shifts, employees);
    }
  }, [selectedDate, shifts, employees]);

  async function loadData() {
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch Shifts (Coverage Requirements)
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('coverage_requirements')
        .select('*')
        .eq('location_id', selectedClinicId)
        .order('custom_id', { ascending: true });

      if (shiftsError) throw shiftsError;

      // 2. Fetch Employees in the department
      const { data: empsData, error: empsError } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          user_id,
          employee_code,
          job_title,
          staffing_role,
          phone_number,
          shift_time,
          schedule_pattern,
          is_on_call,
          secondary_roles,
          users!employee_profiles_user_id_fkey!inner (
            id,
            name,
            email,
            employee_clinics (
              locations ( id, name )
            )
          )
        `)
        .eq('department_id', selectedDepartmentId);

      if (empsError) throw empsError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('staffing_roles')
        .select('name')
        .eq('department_id', selectedDepartmentId)
        .eq('is_active', true);

      if (rolesError) throw rolesError;
      setAvailableRoles(rolesData?.map(r => r.name).sort() || []);

      setShifts(shiftsData || []);
      setEmployees(empsData || []);
      // fetchAdhocAndCalculate will be triggered by useEffect when states update

    } catch (err) {
      console.error('Error fetching data:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  const parsePattern = (pattern) => {
    if (!pattern) return null;
    if (Array.isArray(pattern)) return pattern;
    if (typeof pattern === 'string') {
      try {
        const parsed = JSON.parse(pattern.replace('{', '[').replace('}', ']'));
        if (Array.isArray(parsed)) return parsed;
      } catch(e) {
        const cleanStr = pattern.replace(/^\{|\}$|^\[|\]$/g, '');
        return cleanStr.split(',').map(s => {
          const t = s.trim();
          if(t==='true'||t==='t') return true;
          if(t==='false'||t==='f') return false;
          if(t==='null'||t==='undefined') return null;
          return t.replace(/^"|"$/g, '');
        });
      }
    }
    if (typeof pattern === 'object' && !Array.isArray(pattern)) {
       return Object.keys(pattern).sort((a,b)=>Number(a)-Number(b)).map(k => pattern[k]);
    }
    return null;
  };

  async function fetchAdhocAndCalculate(currentShifts, currentEmployees) {
    const currentWeekDates = getWeekDays(selectedDate);
    const startDate = currentWeekDates[0].toISOString().split('T')[0];
    const endDate = currentWeekDates[6].toISOString().split('T')[0];

    const { data: manualShiftsData } = await supabase
      .from('shifts')
      .select(`
        id, date, time_block, start_time, end_time, staffing_role,
        shift_assignments ( user_id )
      `)
      .eq('location_id', selectedClinicId)
      .gte('date', startDate)
      .lte('date', endDate);

    const { data: timeOffData } = await supabase
      .from('time_off_requests')
      .select('user_id, start_date, end_date, start_time, end_time')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    let extendedShifts = [...currentShifts];
    let templateOverrides = {}; 

    if (manualShiftsData && manualShiftsData.length > 0) {
      manualShiftsData.forEach(manual => {
        if (manual.time_block === 'AD-HOC') {
          const d = new Date(manual.date + 'T12:00:00Z');
          const cycleDayIndex = getCycleDayIndex(d);

          let pattern = Array(14).fill(false);
          pattern[cycleDayIndex] = true;

          extendedShifts.push({
            id: manual.id,
            custom_id: `AD-HOC ${manual.staffing_role || 'STAFF'}`,
            location_id: selectedClinicId,
            start_time: manual.start_time,
            end_time: manual.end_time,
            schedule_pattern: pattern,
            time_block: manual.time_block,
            day_type: 'WEEKDAY',
            staffing_role: manual.staffing_role || 'OTHER',
            required_count: 1,
            priority_weight: 0,
            _isAdhoc: true,
            _assignedUserId: manual.shift_assignments?.[0]?.user_id || null
          });
        } else {
          // Template override
          if (!templateOverrides[manual.time_block]) {
            templateOverrides[manual.time_block] = {};
          }
          if (!templateOverrides[manual.time_block][manual.date]) {
            templateOverrides[manual.time_block][manual.date] = [];
          }
          if (manual.shift_assignments && manual.shift_assignments.length > 0) {
            manual.shift_assignments.forEach(sa => {
              templateOverrides[manual.time_block][manual.date].push(sa.user_id);
            });
          }
        }
      });
    }

    calculateAssignments(extendedShifts, currentEmployees, currentWeekDates, timeOffData || [], templateOverrides);
  }

  function calculateAssignments(currentShifts, currentEmployees, currentWeekDates, timeOffData = [], templateOverrides = {}) {
    setWeekDates(currentWeekDates);

    const sortedShifts = [...currentShifts].sort((a, b) => {
      const aId = (a.custom_id || '').toUpperCase();
      const bId = (b.custom_id || '').toUpperCase();
      const aIsWkend = aId.includes('WKEND') || aId.includes('WEEKEND');
      const bIsWkend = bId.includes('WKEND') || bId.includes('WEEKEND');
      
      if (aIsWkend && !bIsWkend) return 1;
      if (!aIsWkend && bIsWkend) return -1;
      return aId.localeCompare(bId);
    });
    const newWeeklyAssignments = {};
    const newEmployeeAssignments = {};

    sortedShifts.forEach(shift => {
      newWeeklyAssignments[shift.id] = [];
    });

    currentEmployees.forEach(emp => {
      newEmployeeAssignments[emp.id] = {
        employee: emp,
        days: Array(7).fill().map(() => ({ isActive: false, isTimeOff: false, shifts: [] }))
      };
    });

    // Run engine for each of the 7 days
    currentWeekDates.forEach((dateObj, dayIndex) => {
      const cycleDayIndex = getCycleDayIndex(dateObj);
      const assignedEmployeeIds = new Set();

      // Update employee isActive state for this day
      currentEmployees.forEach(emp => {
        const dateStr = dateObj.toISOString().split('T')[0];
        const fullTimeOffs = timeOffData.filter(t => t.user_id === emp.user_id && t.start_date <= dateStr && t.end_date >= dateStr && !t.start_time && !t.end_time);
        const hasFullTimeOff = fullTimeOffs.length > 0;

        let pattern = parsePattern(emp.schedule_pattern);
        const val = pattern && pattern.length === 14 ? pattern[cycleDayIndex] : false;
        const isScheduled = val !== false && val !== null && val !== undefined;
        newEmployeeAssignments[emp.id].days[dayIndex].isActive = hasFullTimeOff ? false : isScheduled;
        newEmployeeAssignments[emp.id].days[dayIndex].isTimeOff = hasFullTimeOff;
      });

      sortedShifts.forEach(shift => {
        // Is this shift active on this day?
        let pattern = parsePattern(shift.schedule_pattern);
        const dayVal = pattern && pattern.length === 14 ? pattern[cycleDayIndex] : false;
        const isActive = dayVal !== false && dayVal !== null && dayVal !== undefined;

        if (!isActive) {
          newWeeklyAssignments[shift.id].push({ isActive: false, employees: [] });
          return;
        }

        const shiftTimeStr = typeof dayVal === 'string'
          ? dayVal.trim()
          : (shift.start_time && shift.end_time) 
            ? `${shift.start_time.slice(0,5)}-${shift.end_time.slice(0,5)}` 
            : shift.time_block;

        // Find eligible employees
        let eligible = currentEmployees.filter(emp => {
          let pattern = parsePattern(emp.schedule_pattern);
          // Must be scheduled to work
          if (!pattern || pattern.length !== 14) return false;
          
          const dayVal = pattern[cycleDayIndex];
          if (dayVal === false || dayVal === null || dayVal === undefined) return false;

          // If dayVal is a custom string, it must match the shift time block
          if (typeof dayVal === 'string') {
            const empTimeClean = dayVal.trim();
            const shiftTimeClean = (shiftTimeStr || '').trim();
            if (empTimeClean !== shiftTimeClean) return false;
          }

          // Must match role
          const primaryRole = (emp.staffing_role || '').trim();
          const shiftRole = (shift.staffing_role || '').trim();
          const hasSecondary = Array.isArray(emp.secondary_roles) && emp.secondary_roles.includes(shiftRole);
          
          if (primaryRole !== shiftRole && !hasSecondary) return false;

          // Must be authorized for this clinic
          const authorizedClinics = emp.users?.employee_clinics?.map(ec => ec.locations?.id) || [];
          if (!authorizedClinics.includes(selectedClinicId)) return false;

          // Must not be on time off
          if (newEmployeeAssignments[emp.id].days[dayIndex].isTimeOff) return false;
          
          // Must not be already assigned
          if (assignedEmployeeIds.has(emp.id)) return false;

          return true;
        });

        // Check for template overrides (manual assignment to a template shift)
        if (!shift._isAdhoc && templateOverrides && templateOverrides[shift.custom_id]) {
          const dateStr = dateObj.toISOString().split('T')[0];
          const overridenUserIds = templateOverrides[shift.custom_id][dateStr];
          if (overridenUserIds && overridenUserIds.length > 0) {
            // Extract these users from the current eligible list or the general pool
            const overridenEmps = currentEmployees.filter(e => overridenUserIds.includes(e.user_id));
            
            // Remove them from general eligible list to avoid duplicates
            eligible = eligible.filter(e => !overridenUserIds.includes(e.user_id));
            
            // Prepend them to the top of the eligible list so they get picked first
            eligible = [...overridenEmps, ...eligible];
          }
        }

        // Sort alphabetically by name
        eligible.sort((a, b) => (a.users?.name || '').localeCompare(b.users?.name || ''));

        if (eligible.length > 0) {
          const needed = shift.required_count || 1;
          const assignedEmpsRaw = eligible.slice(0, needed);
          
          if (shift._isAdhoc && shift._assignedUserId) {
             const assignedAdhocEmp = eligible.find(e => e.user_id === shift._assignedUserId);
             if (assignedAdhocEmp) {
               assignedEmpsRaw.length = 0;
               assignedEmpsRaw.push(assignedAdhocEmp);
             }
          }

          const dateStr = dateObj.toISOString().split('T')[0];
          const assignedEmps = assignedEmpsRaw.map(e => {
            const partials = timeOffData.filter(t => t.user_id === e.user_id && t.start_date <= dateStr && t.end_date >= dateStr && (t.start_time || t.end_time));
            return {
              ...e,
              partialTimeOffs: partials
            };
          });

          newWeeklyAssignments[shift.id].push({ 
            isActive: true, 
            employees: assignedEmps,
            customTime: typeof dayVal === 'string' ? dayVal : null
          });
          assignedEmps.forEach(e => {
            assignedEmployeeIds.add(e.id);
            if (newEmployeeAssignments[e.id]) {
              newEmployeeAssignments[e.id].days[dayIndex].shifts.push(shift);
            }
          });
        } else {
          newWeeklyAssignments[shift.id].push({ 
            isActive: true, 
            employees: [],
            customTime: typeof dayVal === 'string' ? dayVal : null
          }); // Unfilled
        }
      });
    });

    setWeeklyAssignments(newWeeklyAssignments);
    setEmployeeAssignments(newEmployeeAssignments);
  }

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-3xl text-blue-600">auto_awesome</span>
              <h1 className="font-h1 text-h1 text-on-surface">Auto-Scheduler</h1>
            </div>
            <p className="text-body-md text-on-surface-variant max-w-2xl">
              Generating Daily Schedule for {clinicName}.
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filter by Role</span>
              <select
                className="bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Week</span>
                <div className="flex items-center">
                  <button 
                    onClick={() => shiftWeek(-7)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-l-lg border border-r-0 border-slate-300 transition-colors flex items-center justify-center"
                    title="Previous Week"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_left</span>
                  </button>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-4 py-2 border-y border-slate-300 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm h-[42px]"
                  />
                  <button 
                    onClick={() => shiftWeek(7)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg border border-l-0 border-slate-300 transition-colors flex items-center justify-center"
                    title="Next Week"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 mx-2"></div>
            <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
              <button 
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'shifts' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('shifts')}
              >
                By Shifts
              </button>
              <button 
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('employees')}
              >
                By Employees
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg font-medium text-sm shrink-0">
            Error: {errorMsg}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
          {activeTab === 'shifts' ? (
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-64 bg-slate-50 border-r border-slate-200 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0]">Shift</th>
                    {weekDates.map((dateObj, i) => (
                      <th key={i} className="p-4 border-r border-slate-100 min-w-[180px]">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()]} {dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                          <span className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{getCycleDayLabel(getCycleDayIndex(dateObj))}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-500">
                        <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-4 block">sync</span>
                        <p className="font-semibold">Calculating weekly schedule matches...</p>
                      </td>
                    </tr>
                  ) : shifts.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                          <span className="material-symbols-outlined text-3xl text-slate-400">calendar_month</span>
                        </div>
                        <h3 className="font-h3 text-slate-900 mb-1">No Shifts Configured</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                          There are no shift templates configured for {clinicName}. Check your shift templates in the Settings tab.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const filteredShifts = shifts.filter(s => roleFilter === 'All' || s.staffing_role === roleFilter);
                      const rolesSet = Array.from(new Set(filteredShifts.map(s => s.staffing_role).filter(Boolean))).sort();
                      
                      return rolesSet.map(role => {
                        const roleShifts = filteredShifts.filter(s => s.staffing_role === role).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                        
                        // Group by individual shift template
                        const shiftGroups = {};
                        roleShifts.forEach(shift => {
                          const key = shift.id;
                          if (!shiftGroups[key]) {
                            shiftGroups[key] = {
                              custom_id: shift.custom_id,
                              start_time: shift.start_time,
                              end_time: shift.end_time,
                              time_block: shift.time_block,
                              staffing_role: shift.staffing_role,
                              shifts: []
                            };
                          }
                          shiftGroups[key].shifts.push(shift);
                        });

                        return (
                          <React.Fragment key={role}>
                            <tr className="bg-slate-100 border-y-2 border-slate-200">
                              <td colSpan={8} className="p-3 sticky left-0 z-10">
                                <span className="font-bold text-slate-800 text-base uppercase tracking-wider">{role}</span>
                              </td>
                            </tr>
                            {Object.values(shiftGroups).map((group, groupIdx) => (
                              <tr key={`${role}-${groupIdx}`} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100">
                                {/* Sticky Left Column: Shift Info */}
                                <td className="p-4 bg-white group-hover:bg-slate-50/50 border-r border-slate-200 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] transition-colors align-top">
                                  <p className="text-slate-900 font-bold mb-1">
                                    {group.custom_id || 'Unnamed Shift'}
                                  </p>
                                  <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {group.staffing_role}
                                  </span>
                                </td>

                                {/* 7 Day Columns */}
                                {weekDates.map((_, i) => {
                                  // Aggregate data across all shifts in this timeGroup for day `i`
                                  let reqCount = 0;
                                  let employees = [];
                                  let isActive = false;
                                  let customTime = null;

                                  group.shifts.forEach(shift => {
                                    const dayData = weeklyAssignments[shift.id]?.[i];
                                    if (dayData && dayData.isActive) {
                                      isActive = true;
                                      reqCount += (shift.required_count || 1);
                                      if (dayData.employees) {
                                        employees = [...employees, ...dayData.employees];
                                      }
                                      if (dayData.customTime) {
                                        customTime = dayData.customTime;
                                      }
                                    }
                                  });
                                  
                                  const defaultTimeStr = group.start_time && group.end_time 
                                    ? `${group.start_time.slice(0,5)}-${group.end_time.slice(0,5)}` 
                                    : group.time_block;
                                    
                                  const effectiveTime = customTime || defaultTimeStr;
                                  
                                  return (
                                    <td key={i} className={`p-2 border-r border-slate-100 align-top ${!isActive ? 'bg-slate-50/50' : ''}`}>
                                      <CoverageCell 
                                        isActive={isActive} 
                                        reqCount={reqCount} 
                                        employees={employees} 
                                        shiftTime={effectiveTime}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-64 bg-slate-50 border-r border-slate-200 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0]">Employee</th>
                    {weekDates.map((dateObj, i) => (
                      <th key={i} className="p-4 border-r border-slate-100 min-w-[180px]">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()]} {dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                          <span className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{getCycleDayLabel(getCycleDayIndex(dateObj))}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-500">
                        <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-4 block">sync</span>
                        <p className="font-semibold">Calculating weekly schedule matches...</p>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-500">
                        No employees found for this department.
                      </td>
                    </tr>
                  ) : (
                    [...employees].filter(e => roleFilter === 'All' || e.staffing_role === roleFilter).sort((a, b) => (a.users?.name || '').localeCompare(b.users?.name || '')).map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                        {/* Sticky Left Column: Employee Info */}
                        <td className="p-4 bg-white group-hover:bg-slate-50/50 border-r border-slate-200 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] transition-colors">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {emp.users?.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex flex-col">
                              <p className="font-bold text-slate-900 leading-tight">
                                {emp.users?.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  {emp.staffing_role}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {emp.shift_time || 'No times'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 7 Day Columns */}
                        {employeeAssignments[emp.id]?.days?.map((dayData, i) => (
                          <td key={i} className={`p-2 border-r border-slate-100 align-top ${!dayData.isActive ? 'bg-slate-50/50' : ''}`}>
                            {!dayData.isActive ? (
                              <div className="h-full min-h-[60px] flex items-center justify-center">
                                <span className="text-xs font-medium text-slate-400">Off</span>
                              </div>
                            ) : dayData.shifts && dayData.shifts.length > 0 ? (
                              <div className="flex flex-col gap-2 h-full min-h-[60px]">
                                {dayData.shifts.map((shift, shiftIdx) => (
                                  <div key={shiftIdx} className="flex flex-col gap-1 bg-blue-50/70 p-2 rounded-md border border-blue-100/50 hover:border-blue-300 transition-colors cursor-default">
                                    <div className="flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[14px] text-blue-600">event_available</span>
                                      <p className="font-semibold text-slate-900 text-xs leading-tight" title={shift.custom_id}>
                                        {shift.custom_id || shift.id.split('-')[0]}
                                      </p>
                                    </div>
                                    <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                                      {shift.start_time && shift.end_time 
                                        ? `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`
                                        : shift.time_block}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 bg-amber-50/50 p-2 rounded-md border border-amber-200/50 border-dashed cursor-default h-full min-h-[60px] justify-center items-center text-center">
                                <p className="font-semibold text-amber-700 text-xs">Available</p>
                                <p className="text-[10px] text-amber-600/70">Not Assigned</p>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
