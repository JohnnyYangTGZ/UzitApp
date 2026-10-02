import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { supabase } from '../lib/supabaseClient';

const formatDateRange = (startStr, endStr) => {
  if (!startStr) return '';
  const parseD = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  if (startStr === endStr) return parseD(startStr);
  return `${parseD(startStr)} - ${parseD(endStr)}`;
};

const formatTimeRange = (startTime, endTime) => {
  if (startTime && endTime) {
    const fmt = (t) => {
      const [h, m] = t.split(':');
      const d = new Date();
      d.setHours(parseInt(h, 10), parseInt(m, 10));
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };
    return `${fmt(startTime)} - ${fmt(endTime)}`;
  }
  return 'Full Shift';
};

const getTypeCodeLabel = (code) => {
  switch (code) {
    case 'VAC': return 'PTO / Vacation';
    case 'PTO': return 'Paid Time Off';
    case 'SCK': return 'Sick Leave';
    case 'LOA': return 'Leave of Absence';
    case 'OFF': return 'Unpaid Leave';
    default: return code || 'Time Off';
  }
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { clinics, selectedClinicId } = useLocationContext();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay()); // 0-6 (Sun-Sat)
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All Staff');
  const [activeDropdown, setActiveDropdown] = useState(null); // { dayIdx, role }
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [denyModalRequest, setDenyModalRequest] = useState(null);
  const [denyNote, setDenyNote] = useState('');
  const [isSubmittingDenial, setIsSubmittingDenial] = useState(false);
  const [dashboardData, setDashboardData] = useState({ weeklyCoverage: [], rosterByDay: {} });

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchPendingRequests = async () => {
    if (!selectedClinicId) return;
    setLoadingRequests(true);

    try {
      const { data: clinicUsers } = await supabase
        .from('employee_clinics')
        .select('user_id')
        .eq('clinic_id', selectedClinicId);

      const userIds = (clinicUsers || []).map(cu => cu.user_id);
      if (userIds.length === 0) {
        setPendingRequests([]);
        setLoadingRequests(false);
        return;
      }

      const { data: requests, error } = await supabase
        .from('time_off_requests')
        .select(`
          *,
          users!time_off_requests_user_id_fkey (
            id,
            name,
            email,
            employee_profiles!employee_profiles_user_id_fkey (
              job_title,
              staffing_role,
              employee_code
            )
          )
        `)
        .eq('status', 'pending')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(requests || []);
    } catch (err) {
      console.error('Error fetching pending time off requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [selectedClinicId]);

  const updateTimeOffRequestStatus = async (requestId, updates) => {
    const { error: updateErr } = await supabase
      .from('time_off_requests')
      .update(updates)
      .eq('id', requestId);

    if (!updateErr) return;

    const { data: existing, error: fetchErr } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !existing) throw updateErr;

    const { error: delErr } = await supabase
      .from('time_off_requests')
      .delete()
      .eq('id', requestId);

    if (delErr) throw delErr;

    const updatedRecord = {
      ...existing,
      ...updates
    };

    const { error: insErr } = await supabase
      .from('time_off_requests')
      .insert([updatedRecord]);

    if (insErr) {
      await supabase.from('time_off_requests').insert([existing]).catch(() => {});
      throw insErr;
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await updateTimeOffRequestStatus(requestId, {
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenDenyModal = (req) => {
    setDenyModalRequest(req);
    setDenyNote('');
  };

  const confirmDenyRequest = async () => {
    if (!denyModalRequest) return;
    setIsSubmittingDenial(true);
    try {
      await updateTimeOffRequestStatus(denyModalRequest.id, {
        status: 'denied',
        manager_note: denyNote.trim() || 'Request denied by manager',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      });
      setPendingRequests(prev => prev.filter(r => r.id !== denyModalRequest.id));
      setDenyModalRequest(null);
      setDenyNote('');
    } catch (err) {
      console.error('Error denying request:', err);
      alert('Failed to deny request: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingDenial(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      if (!selectedClinicId) return;
      setLoading(true);

      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + (weekOffset * 7); 
      const Sunday = new Date(curr.setDate(first));
      
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Sunday);
        d.setDate(Sunday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return {
          date: d,
          dateStr: `${y}-${m}-${day}`,
          dayOfWeek: d.getDay(),
          cycleIndex: i
        };
      });

      const minDateStr = weekDates[0].dateStr;
      const maxDateStr = weekDates[6].dateStr;

      const { data: clinicUsers } = await supabase
        .from('employee_clinics')
        .select('user_id')
        .eq('clinic_id', selectedClinicId);
      
      const userIds = (clinicUsers || []).map(cu => cu.user_id);

      let profiles = [];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('employee_profiles')
          .select(`
            *,
            users:user_id ( id, name )
          `)
          .in('user_id', userIds);
        profiles = (profs || []).filter(p => {
          const role = (p.staffing_role || p.job_title || '').toUpperCase();
          return !role.includes('ADMIN') && !role.includes('MANAGER') && !role.includes('SYSTEM ADMINISTRATOR');
        });
      }

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

      const { data: reqs } = await supabase
        .from('coverage_requirements')
        .select('*')
        .eq('location_id', selectedClinicId);

      let weeklyCoverage = [];
      let rosterByDay = {};

      weekDates.forEach((dayData, index) => {
        let required = { RN: 0, LVN: 0, MA: 0, OTHER: 0, total: 0 };
        let actual = { RN: 0, LVN: 0, MA: 0, OTHER: 0, total: 0 };
        let workingStaff = [];
        
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
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-2 border-b border-slate-100">
          <div>
            <h1 className="font-h1 text-2xl md:text-h1 text-primary mb-1">Weekly Staffing Overview</h1>
            <p className="font-body-md text-sm md:text-base text-on-surface-variant">
              {dashboardData.weeklyCoverage.length > 0 ? (
                <>Week of {dashboardData.weeklyCoverage[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {clinicName}</>
              ) : (
                <>{clinicName}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
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
            
            <button className="hidden md:block px-4 py-2 border border-secondary text-secondary rounded-lg font-label-sm hover:bg-secondary hover:text-white transition-colors">
              Download Report
            </button>
          </div>
        </div>

        {/* 1. Daily Health Stats (Clinic Health for Selected Day) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">analytics</span>
              Clinic Health for the Day
            </h2>
            {dashboardData.weeklyCoverage?.[selectedDayIndex]?.date && (
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                {dashboardData.weeklyCoverage[selectedDayIndex].date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {/* Day Selector Pill Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
            {dashboardData.weeklyCoverage.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              const isToday = new Date().toDateString() === day.date.toDateString();
              const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center min-w-[62px] shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/30'
                      : day.gap
                      ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wider">{dayName}</span>
                    {day.gap && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                    )}
                  </div>
                  <span className="text-sm font-extrabold">{day.date.getDate()}</span>
                  {isToday && (
                    <span className={`text-[9px] ${isSelected ? 'text-blue-100' : 'text-blue-600'} font-black uppercase`}>Today</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day's Health Card */}
          {loading ? (
            <div className="h-44 bg-white rounded-xl border border-surface-border shadow-xs flex items-center justify-center">
              <span className="text-slate-400 text-sm">Loading daily health stats...</span>
            </div>
          ) : (
            (() => {
              const day = dashboardData.weeklyCoverage[selectedDayIndex];
              if (!day) return null;
              const isToday = new Date().toDateString() === day.date.toDateString();

              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs transition-all">
                  <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm md:text-base font-bold text-slate-900">
                          {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {isToday && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Target staffing vs actual working count
                      </p>
                    </div>

                    {day.gap ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shrink-0">
                        <span className="material-symbols-outlined text-[16px] text-rose-600">warning</span>
                        Shortage
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                        Fully Staffed
                      </span>
                    )}
                  </div>

                  {/* Staffing Roles Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {['RN', 'LVN', 'MA'].map(role => {
                      const actualCount = day.actual[role] || 0;
                      const requiredCount = day.required[role] || 0;
                      const isDeficit = actualCount < requiredCount;
                      const isOpen = activeDropdown?.dayIdx === selectedDayIndex && activeDropdown?.role === role;

                      const roleStaff = (dashboardData.rosterByDay[selectedDayIndex] || []).filter(st => {
                        if (st.isOff) return false;
                        const r = (st.staffing_role || '').toUpperCase().trim();
                        if (role === 'RN') return r === 'RN' || r === 'REGISTERED NURSE';
                        if (role === 'LVN') return r === 'LVN' || r === 'LICENSED VOCATIONAL NURSE';
                        if (role === 'MA') return r === 'MA' || r === 'MEDICAL ASSISTANT';
                        return r === role;
                      });

                      return (
                        <div 
                          key={role} 
                          className={`relative p-3 rounded-xl border flex flex-col justify-between transition-all ${
                            isDeficit ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{role}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isOpen ? null : { dayIdx: selectedDayIndex, role });
                              }}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-0.5 cursor-pointer ${
                                isOpen ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                              } ${isDeficit ? 'text-rose-700' : 'text-emerald-700'}`}
                            >
                              <span>{actualCount}</span>
                              <span className="text-[11px] font-normal text-slate-400">/ {requiredCount}</span>
                              <span className="material-symbols-outlined text-[14px] text-slate-400">arrow_drop_down</span>
                            </button>
                          </div>

                          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div 
                              className={`h-full ${isDeficit ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${requiredCount ? Math.min(100, (actualCount / requiredCount) * 100) : 100}%` }}
                            ></div>
                          </div>

                          {/* Who's Working Dropdown Popover */}
                          {isOpen && (
                            <div 
                              className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3.5 space-y-3 text-left cursor-default animate-in fade-in zoom-in-95 duration-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <div>
                                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-blue-600">group</span>
                                    Who's Working Today
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {role} ({roleStaff.length})
                                  </p>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown(null);
                                  }}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>

                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                                {roleStaff.length > 0 ? (
                                  roleStaff.map((st, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                                      <div className="flex items-center gap-2 truncate">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                          {st.users?.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="truncate">
                                          <p className="font-bold text-slate-800 truncate">{st.users?.name || 'Staff'}</p>
                                          <p className="text-[10px] text-slate-500 truncate">{st.effectiveShiftTime || 'Scheduled'}</p>
                                        </div>
                                      </div>
                                      <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                                        {role}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3 text-center text-slate-400 text-xs italic">
                                    No {role} staff scheduled for this date.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Bar for Total Staffing */}
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                    <span>Overall Staffing Coverage</span>
                    <span>{day.actual.total} / {day.required.total} Total Onsite</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${day.gap ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${day.required.total ? Math.min(100, (day.actual.total / day.required.total) * 100) : 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* 2. Pending Time Off Requests - Directly below Daily Health Stats */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-xl">pending_actions</span>
              Pending Time Off Requests
            </h2>
            <button 
              onClick={() => navigate('/manager/calendar')} 
              className="text-primary text-xs font-bold hover:underline"
            >
              View All
            </button>
          </div>
          
          {loadingRequests ? (
            <div className="p-6 bg-white rounded-xl border border-surface-border text-center text-slate-400 text-xs">
              Loading pending requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-surface-border p-5 text-center text-slate-500 shadow-xs flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-2xl text-emerald-500">check_circle</span>
              <div className="text-left">
                <p className="font-bold text-slate-800 text-xs sm:text-sm">No pending time off requests</p>
                <p className="text-[11px] text-slate-400">All staff time off requests for this clinic have been reviewed.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {pendingRequests.map(req => {
                const rawProfile = req.users?.employee_profiles;
                const empProfile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
                const empName = req.users?.name || 'Staff Member';
                const empRole = empProfile?.job_title || empProfile?.staffing_role || 'Staff';
                const firstLetter = empName.charAt(0).toUpperCase();

                return (
                  <div key={req.id} className="bg-white rounded-xl border border-surface-border shadow-xs p-4 flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200 shrink-0">
                          {firstLetter}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm leading-tight">{empName}</p>
                          <p className="text-xs text-slate-500 font-medium">{empRole}</p>
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">calendar_month</span> Dates
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatDateRange(req.start_date, req.end_date)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">schedule</span> Time
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatTimeRange(req.start_time, req.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">flight_takeoff</span> Type
                        </span>
                        <span className="font-bold text-slate-800">
                          {getTypeCodeLabel(req.time_off_type_code)}
                        </span>
                      </div>
                    </div>
                    
                    {req.reason ? (
                      <p className="text-xs text-slate-600 italic">"{req.reason}"</p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No note provided.</p>
                    )}
                    
                    <div className="flex gap-2.5 mt-auto pt-1">
                      <button 
                        onClick={() => handleOpenDenyModal(req)}
                        className="flex-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 py-1.5 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        Deny
                      </button>
                      <button 
                        onClick={() => handleApproveRequest(req.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs py-1.5 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Daily Staff Roster Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700 text-xl">badge</span>
                Staff Roster
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-border shadow-xs overflow-hidden">
            <div className="p-3 bg-surface-container-low border-b border-surface-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button 
                  onClick={() => setSelectedRoleFilter('All Staff')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${selectedRoleFilter === 'All Staff' ? 'bg-white border border-surface-border text-primary shadow-xs' : 'text-slate-600 hover:bg-white/50'}`}
                >
                  All Staff
                </button>
                {allRolesInWeek.map(role => (
                  <button 
                    key={role}
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${selectedRoleFilter === role ? 'bg-white border border-surface-border text-primary shadow-xs' : 'text-slate-600 hover:bg-white/50'}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-slate-500 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-onsite"></span>
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-off"></span>
                  <span>Off / Leave</span>
                </div>
              </div>
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <div className="grid grid-cols-[220px_1.5fr_1fr_140px_120px_140px] bg-slate-50 border-b border-surface-border text-[11px] text-slate-500 font-bold uppercase tracking-wider px-6 py-3">
                <div>Employee Name</div>
                <div>Clinic</div>
                <div>Role</div>
                <div>Shift Window</div>
                <div>Status</div>
                <div className="text-right">Schedule</div>
              </div>

              <div className="divide-y divide-surface-border min-h-[160px]">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Loading roster...</div>
                ) : filteredRoster.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No staff scheduled for this day.</div>
                ) : (
                  filteredRoster.map(staff => (
                    <div key={staff.user_id} className={`grid grid-cols-[220px_1.5fr_1fr_140px_120px_140px] px-6 py-3 items-center hover:bg-slate-50 transition-colors text-xs ${staff.isOff ? 'bg-slate-50/50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${staff.isOff ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                          {staff.users?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="truncate">
                          <p className={`font-bold truncate ${staff.isOff ? 'text-slate-400' : 'text-slate-900'}`}>{staff.users?.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">ID: {staff.employee_code || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="font-medium text-slate-700 truncate pr-2">
                        {clinicName}
                      </div>
                      <div className="font-semibold text-slate-800">
                        {{
                          'RN': 'Registered Nurse',
                          'MA': 'Medical Assistant',
                          'LVN': 'Licensed Vocational Nurse'
                        }[staff.staffing_role] || staff.staffing_role || staff.job_title}
                      </div>
                      <div className="font-medium text-slate-600">{staff.effectiveShiftTime || '08:00 – 16:00'}</div>
                      <div>
                        {staff.isOff ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                            Offsite
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end gap-1">
                        {staff.isOff ? (
                          <div className="w-12 h-5 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase">OFF</div>
                        ) : (
                          <div className="w-12 h-5 bg-blue-600 rounded flex items-center justify-center text-[9px] text-white font-bold">WORK</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading roster...</div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No staff scheduled for this day.</div>
              ) : (
                filteredRoster.map(staff => (
                  <div key={staff.user_id} className="p-3.5 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-3 truncate">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${staff.isOff ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'}`}>
                        {staff.users?.name?.charAt(0) || 'U'}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-900 text-sm truncate">{staff.users?.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {staff.staffing_role || staff.job_title} &bull; {staff.effectiveShiftTime || '08:00 – 16:00'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                      staff.isOff 
                        ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {staff.isOff ? 'Off' : 'Working'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-surface-border flex justify-between items-center text-xs text-slate-500">
              <span>Showing {filteredRoster.length} staff members</span>
            </div>
          </div>
        </div>

        {/* 4. Bottom Schedule Button */}
        <div className="pt-2 pb-4">
          <button 
            onClick={() => navigate('/manager/calendar')} 
            className="w-full py-3.5 px-6 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all text-sm sm:text-base cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">calendar_month</span>
            Go to Full Manager Calendar
          </button>
        </div>

      </div>

      {/* Deny Request Modal */}
      {denyModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-lg">
                  <span className="material-symbols-outlined text-[22px]">block</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Deny Time Off Request</h3>
                  <p className="text-xs text-slate-500">
                    {denyModalRequest.users?.name} &bull; {formatDateRange(denyModalRequest.start_date, denyModalRequest.end_date)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDenyModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
              <p className="text-slate-700 font-semibold flex justify-between">
                <span>Type:</span>
                <span className="text-slate-900 font-bold">{getTypeCodeLabel(denyModalRequest.time_off_type_code)}</span>
              </p>
              {denyModalRequest.reason && (
                <p className="text-slate-500 italic pt-1 border-t border-slate-200/60 mt-1">"{denyModalRequest.reason}"</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reason for Denial / Note for Employee <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={denyNote}
                onChange={(e) => setDenyNote(e.target.value)}
                placeholder="e.g. Coverage required for shift, staffing threshold reached..."
                className="w-full text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDenyModalRequest(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDenial}
                onClick={confirmDenyRequest}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isSubmittingDenial ? (
                  <span>Denying...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Confirm Denial
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
