import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useScheduleData } from '../hooks/useScheduleData';
import TimeOffRequestModal from '../components/TimeOffRequestModal';
import ProvideAvailabilityModal from '../components/ProvideAvailabilityModal';
import { supabase } from '../lib/supabaseClient';

export default function StaffSchedule() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { fetchMySchedule, loading } = useScheduleData();
  const [shifts, setShifts] = useState([]);
  const [timeOffs, setTimeOffs] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [activeDateMenu, setActiveDateMenu] = useState(null);
  const [selectedDateForModal, setSelectedDateForModal] = useState('');
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const [publicationsMap, setPublicationsMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);

  // Derive start and end of the current month view
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('users').select('id, name');
      if (data) {
        const uMap = {};
        data.forEach(u => { uMap[u.id] = u.name; });
        setUsersMap(uMap);
      }
    } catch(e) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setAuditLogs(data || []);
    } catch(e) {}
  };

  const fetchPublications = async () => {
    try {
      const { data } = await supabase
        .from('schedule_publications')
        .select('*');

      const pubMap = {};
      if (data) {
        data.forEach(p => {
          if (p.status === 'published') {
            pubMap[`${p.location_id}_${p.week_start_date}`] = p;
          }
        });
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('schedule_pub_')) {
          try {
            const val = JSON.parse(localStorage.getItem(key));
            if (val && val.status === 'published') {
              const parts = key.replace('schedule_pub_', '').split('_');
              const clinicId = parts[0];
              const weekStart = parts[1];
              if (!pubMap[`${clinicId}_${weekStart}`]) {
                pubMap[`${clinicId}_${weekStart}`] = val;
              }
            }
          } catch(e) {}
        }
      }

      setPublicationsMap(pubMap);
    } catch(err) {
      console.warn("Could not fetch publications:", err);
    }
  };

  const getWeekStartStr = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const targetDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const dayOfWeek = targetDate.getDay();
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
    return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
  };

  const getShiftPublicationInfo = (assignment) => {
    if (!assignment || !assignment.shifts) return { published: false };
    const locationId = assignment.shifts.location?.id || assignment.shifts.location_id;
    const dateStr = assignment.shifts.date;
    if (!dateStr) return { published: false };
    const weekStart = getWeekStartStr(dateStr);
    
    let pub = locationId ? publicationsMap[`${locationId}_${weekStart}`] : null;
    if (!pub) {
      const foundKey = Object.keys(publicationsMap).find(k => k.endsWith(`_${weekStart}`));
      if (foundKey) pub = publicationsMap[foundKey];
    }
    
    if (pub && (pub.status === 'published' || pub === true)) {
      const pubAt = typeof pub === 'object' && pub.published_at ? pub.published_at : assignment.shifts.created_at;
      const pubBy = typeof pub === 'object' && pub.published_by ? (usersMap[pub.published_by] || 'Manager') : 'Manager';
      return {
        published: true,
        publishedAt: pubAt,
        publishedBy: pubBy
      };
    }
    return { published: false };
  };

  const isShiftPublished = (assignment) => {
    return getShiftPublicationInfo(assignment).published;
  };

  const [availabilities, setAvailabilities] = useState([]);

  const fetchAvailabilities = async () => {
    if (!user) return;
    const startDateStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, 0).getDate();
    const endDateStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('user_id', user.id)
      .lte('date', endDateStr)
      .gte('date', startDateStr);
    
    setAvailabilities(data || []);
  };

  const fetchTimeOffs = async () => {
    if (!user) return;
    const startDateStr = monthStart.toISOString().split('T')[0];
    const endDateStr = monthEnd.toISOString().split('T')[0];

    const { data } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('user_id', user.id)
      .lte('start_date', endDateStr)
      .gte('end_date', startDateStr);
    
    setTimeOffs(data || []);
  };

  useEffect(() => {
    if (!user) return;
    
    const loadAllData = () => {
      const startDateStr = monthStart.toISOString().split('T')[0];
      const endDateStr = monthEnd.toISOString().split('T')[0];
      
      fetchMySchedule(user.id, startDateStr, endDateStr).then(data => {
        setShifts(data || []);
      });
      
      fetchTimeOffs();
      fetchAvailabilities();
      fetchPublications();
      fetchUsers();
      fetchAuditLogs();
    };

    loadAllData();

    // 1. Supabase Realtime Subscription (Instant WebSocket pushes)
    const channel = supabase
      .channel(`staff_schedule_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assigned_shifts' }, loadAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_publications' }, loadAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, loadAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off_requests' }, loadAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_availability' }, loadAllData)
      .subscribe();

    // 2. Tab Focus listener (auto-refreshes if employee switches back to tab)
    const handleFocus = () => loadAllData();
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, currentDate, fetchMySchedule]);

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(hour, 10));
    d.setMinutes(parseInt(minute, 10));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateTime = (dateStrOrIso) => {
    if (!dateStrOrIso) return '';
    try {
      const d = new Date(dateStrOrIso);
      if (isNaN(d.getTime())) return dateStrOrIso;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStrOrIso;
    }
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days = [];
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // start at previous Sunday

    const endDate = new Date(monthEnd);
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // end at next Saturday
    }

    let d = new Date(startDate);
    while (d <= endDate) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;

      // Find all shift assignments for this day
      const dayShifts = shifts.filter(a => a.shifts?.date === dateStr);
      // Find all time offs for this day
      const dayTimeOffs = timeOffs.filter(to => to.start_date <= dateStr && to.end_date >= dateStr);
      // Find availabilities for this day
      const dayAvailabilities = availabilities.filter(a => a.date === dateStr);
      
      days.push({
        date: new Date(d),
        dateStr,
        isCurrentMonth: d.getMonth() === currentDate.getMonth(),
        shifts: dayShifts,
        timeOffs: dayTimeOffs,
        availabilities: dayAvailabilities
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [currentDate, monthStart, monthEnd, shifts, timeOffs, availabilities]);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const activeDayDetails = useMemo(() => {
    if (!selectedDayDetails) return null;
    return calendarDays.find(d => d.dateStr === selectedDayDetails.dateStr) || selectedDayDetails;
  }, [selectedDayDetails, calendarDays]);

  const dayAuditLogs = useMemo(() => {
    if (!activeDayDetails || !auditLogs) return [];
    return auditLogs.filter(log => {
      const targetDate = log.metadata?.dateStr || log.metadata?.date;
      return targetDate === activeDayDetails.dateStr;
    });
  }, [activeDayDetails, auditLogs]);

  useEffect(() => {
    const targetDate = searchParams.get('date');
    if (targetDate && calendarDays && calendarDays.length > 0) {
      const matchingDay = calendarDays.find(d => d.dateStr === targetDate);
      if (matchingDay) {
        setSelectedDayDetails(matchingDay);
      }
    }
  }, [searchParams, calendarDays]);

  // Calculate stats
  const totalApprovedDays = timeOffs.filter(t => t.status === 'approved').reduce((acc, curr) => {
    const start = new Date(curr.start_date);
    const end = new Date(curr.end_date);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return acc + diffDays;
  }, 0);
  
  const pendingCount = timeOffs.filter(t => t.status === 'pending').length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-h1 text-2xl md:text-h1 text-primary mb-1">My Schedule Calendar</h1>
            <p className="font-body-md text-sm md:text-base text-on-surface-variant">View your shifts and time-off requests for {monthName}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => {
                setSelectedDateForModal(new Date().toISOString().split('T')[0]);
                setIsModalOpen(true);
              }}
              className="bg-secondary text-on-primary font-bold px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors flex items-center gap-2 shadow-sm text-xs md:text-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Request Time Off
            </button>
            <div className="flex items-center bg-white border border-surface-border rounded-lg p-1 shadow-sm">
              <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Previous Month">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <span className="px-3 font-bold text-xs md:text-sm text-slate-800">{monthName}</span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Next Month">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Summary Bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-surface-border p-4 rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="bg-secondary-container text-on-secondary-container p-2.5 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xl">work</span>
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Shifts</p>
              <p className="font-bold text-lg md:text-xl text-slate-900">{shifts.length}</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-4 rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xl">event_available</span>
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Approved PTO</p>
              <p className="font-bold text-lg md:text-xl text-slate-900">{totalApprovedDays} Days</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-4 rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="bg-amber-100 text-amber-800 p-2.5 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xl">hourglass_empty</span>
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Requests</p>
              <p className="font-bold text-lg md:text-xl text-slate-900">{pendingCount}</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-4 rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="bg-primary text-on-primary p-2.5 rounded-lg shrink-0">
              <span className="material-symbols-outlined text-xl">query_builder</span>
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Hours</p>
              <p className="font-bold text-lg md:text-xl text-slate-900">{shifts.length * 8}h</p>
            </div>
          </div>
        </div>

        {/* 7-Column Monthly Schedule Calendar (Responsive Overflow on Mobile) */}
        <div className="relative bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden w-full mb-8">
          <div className="overflow-x-auto">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 min-w-[700px] md:min-w-0 border-b border-surface-border bg-slate-50">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                <div key={day} className="py-3 text-center text-[11px] md:text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-surface-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs">Loading your schedule calendar...</div>
            ) : (
              <div className="grid grid-cols-7 auto-rows-auto min-w-[700px] md:min-w-0 relative">
                {calendarDays.map((day, i) => {
                  const isSelected = activeDayDetails?.dateStr === day.dateStr;
                  const isToday = new Date().toDateString() === day.date.toDateString();

                  return (
                    <div 
                      key={day.dateStr} 
                      className={`min-h-[120px] p-2.5 border-b border-surface-border relative transition-colors ${i % 7 !== 6 ? 'border-r border-surface-border' : ''} ${!day.isCurrentMonth ? 'bg-slate-50/50 opacity-50' : 'hover:bg-slate-50 cursor-pointer'} ${isSelected ? 'bg-blue-50/50 ring-2 ring-blue-500 ring-inset z-1' : ''}`}
                      onClick={() => day.isCurrentMonth && setActiveDateMenu(activeDateMenu === day.dateStr ? null : day.dateStr)}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                            isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'
                          }`}>
                            {day.date.getDate()}
                          </span>
                          {isToday && (
                            <span className="text-[9px] font-extrabold text-blue-600 uppercase">Today</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Interactive Date Menu Popover */}
                      {activeDateMenu === day.dateStr && (
                        <div className="absolute top-8 left-2 right-2 bg-white rounded-lg shadow-xl border border-slate-200 z-30 overflow-hidden flex flex-col animate-fade-in">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayDetails(day);
                              setActiveDateMenu(null);
                            }}
                            className="text-left px-3 py-2 text-xs text-slate-800 font-bold hover:bg-slate-100 hover:text-blue-600 transition-colors border-b border-slate-100 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[15px] text-blue-600">info</span>
                            View Shift & Day Details
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateForModal(day.dateStr);
                              setIsModalOpen(true);
                              setActiveDateMenu(null);
                            }}
                            className="text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors border-b border-slate-100 flex items-center gap-2 font-medium"
                          >
                            <span className="material-symbols-outlined text-[15px]">event_busy</span>
                            Request Time Off
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateForModal(day.dateStr);
                              setIsAvailabilityModalOpen(true);
                              setActiveDateMenu(null);
                            }}
                            className="text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-emerald-600 transition-colors flex items-center gap-2 font-medium"
                          >
                            <span className="material-symbols-outlined text-[15px]">event_available</span>
                            Provide Availability
                          </button>
                        </div>
                      )}

                      {/* Day Shifts & Time Off Badges */}
                      {(() => {
                        const hasApprovedPTO = day.timeOffs.some(to => to.status === 'approved');

                        return (
                          <div className="space-y-1">
                            {!hasApprovedPTO && day.shifts.map((assignment, idx) => {
                              const published = isShiftPublished(assignment);
                              return (
                                <div 
                                  key={`shift-${idx}`} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDayDetails(day);
                                  }}
                                  className={`p-1.5 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                                    published 
                                      ? 'bg-emerald-700 text-white border-emerald-600 hover:bg-emerald-800 shadow-2xs' 
                                      : 'bg-slate-700 text-white border-slate-600 hover:bg-slate-800 shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="font-bold truncate text-white text-[11px]">{assignment.shifts?.location?.name || 'Clinic Shift'}</p>
                                    {published && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Published Shift"></span>
                                    )}
                                  </div>
                                  <p className={published ? "text-emerald-100 text-[10px]" : "text-slate-300 text-[10px]"}>
                                    {assignment.shifts?.start_time && assignment.shifts?.end_time
                                      ? `${formatTime(assignment.shifts.start_time)} - ${formatTime(assignment.shifts.end_time)}`
                                      : `${assignment.shifts?.time_block || 'Regular'} Shift`}
                                  </p>
                                </div>
                              );
                            })}

                            {day.timeOffs.map((to, idx) => {
                              const isApproved = to.status === 'approved';
                              const isPending = to.status === 'pending';
                              
                              return (
                                <div 
                                  key={`to-${idx}`} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDayDetails(day);
                                  }}
                                  className={`p-1.5 rounded-md text-xs font-bold flex items-center justify-between cursor-pointer border ${
                                    isApproved 
                                      ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700' 
                                      : isPending 
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' 
                                      : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                                  }`}
                                >
                                  <div className="truncate pr-1">
                                    <p className="font-extrabold text-[11px] truncate">{to.time_off_type_code || 'VAC'}</p>
                                    <p className="text-[9px] uppercase tracking-wider font-extrabold opacity-80">{to.status}</p>
                                  </div>
                                  <span className="material-symbols-outlined text-[13px] shrink-0">
                                    {isApproved ? 'check_circle' : isPending ? 'hourglass_top' : 'cancel'}
                                  </span>
                                </div>
                              );
                            })}

                            {day.shifts.length === 0 && day.timeOffs.length === 0 && (day.availabilities || []).map((avail, idx) => (
                              <div 
                                key={`avail-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayDetails(day);
                                }}
                                className="p-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white border border-blue-500 hover:bg-blue-700 shadow-2xs cursor-pointer flex flex-col justify-between"
                                title={`Submitted Availability: ${avail.shift_time || 'Any'}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px]">event_available</span>
                                    <span className="font-black text-[11px] uppercase tracking-tight">Available</span>
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300"></span>
                                </div>
                                <p className="text-blue-100 text-[10px] font-mono mt-0.5">{avail.shift_time || 'Any Time'}</p>
                              </div>
                            ))}

                            {day.isCurrentMonth && !hasApprovedPTO && day.shifts.length === 0 && day.timeOffs.length === 0 && (day.availabilities || []).length === 0 && day.date.getDay() !== 0 && day.date.getDay() !== 6 && (
                              <div className="mt-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                Off
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Floating Overlay Drawer for Shift & Day Details */}
          {activeDayDetails && (
            <div className="absolute top-0 right-0 bottom-0 w-80 md:w-96 bg-white/95 backdrop-blur-md border-l border-slate-200 shadow-2xl z-30 flex flex-col p-6 space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                    <span className="material-symbols-outlined text-[22px]">info</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {activeDayDetails.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Date Info & Audit Details</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDayDetails(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors shrink-0"
                  title="Close Floating Info Panel"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* 1. Shift Assignments Section */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-600">work</span>
                    Shift Schedule Info
                  </h4>
                  {activeDayDetails.shifts && activeDayDetails.shifts.length > 0 ? (
                    activeDayDetails.shifts.map((assignment, idx) => {
                      const pubInfo = getShiftPublicationInfo(assignment);
                      return (
                        <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3 mb-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">
                              {assignment.shifts?.location?.name || 'Clinic Shift'}
                            </span>
                            {pubInfo.published ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Published Schedule
                              </span>
                            ) : (
                              <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                Draft Schedule
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50 text-xs">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinic / Subdept</p>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {assignment.shifts?.location?.name || 'Geary Clinic'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift Hours</p>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {assignment.shifts?.start_time && assignment.shifts?.end_time
                                  ? `${formatTime(assignment.shifts.start_time)} - ${formatTime(assignment.shifts.end_time)}`
                                  : `${assignment.shifts?.time_block || 'Regular'} Shift`}
                              </p>
                            </div>
                          </div>

                          {/* Audit / Published Info */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1 mt-2">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <span className="material-symbols-outlined text-sm text-slate-400">history</span>
                              <span>
                                <strong>Status:</strong> {pubInfo.published ? `Published by ${pubInfo.publishedBy}` : 'Draft (Unpublished)'}
                              </span>
                            </div>
                            {pubInfo.publishedAt && (
                              <p className="text-[10px] text-slate-500 pl-5">
                                Published: {formatDateTime(pubInfo.publishedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-center text-slate-500 text-xs py-3">
                      <span className="material-symbols-outlined text-xl text-slate-400 block mb-1">event_busy</span>
                      No working shift scheduled (Scheduled Off).
                    </div>
                  )}
                </div>

                {/* 2. Time Off Requests & Manager Approval Audit Info */}
                {activeDayDetails.timeOffs && activeDayDetails.timeOffs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-amber-600">beach_access</span>
                      Time Off Request & Approval Info
                    </h4>
                    <div className="space-y-2">
                      {activeDayDetails.timeOffs.map((to, idx) => {
                        const reviewerName = to.reviewed_by ? (usersMap[to.reviewed_by] || 'Manager') : 'Manager';
                        return (
                          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base text-slate-500">event_note</span>
                                {to.time_off_type_code || 'PTO Request'}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                                to.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                to.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}>
                                {to.status === 'approved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                {to.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                {to.status === 'denied' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                                {to.status}
                              </span>
                            </div>

                            {to.reason && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                                "Reason: {to.reason}"
                              </p>
                            )}

                            {/* Audit / Manager Approval Log */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs space-y-1">
                              {to.status === 'approved' && (
                                <>
                                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                                    <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                                    Approved by {reviewerName}
                                  </div>
                                  {to.reviewed_at && (
                                    <p className="text-[10px] text-slate-500 pl-5">
                                      Approved on: {formatDateTime(to.reviewed_at)}
                                    </p>
                                  )}
                                </>
                              )}

                              {to.status === 'pending' && (
                                <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                                  <span className="material-symbols-outlined text-sm text-amber-600">hourglass_top</span>
                                  Pending Manager Review (Submitted on {formatDateTime(to.created_at || activeDayDetails.dateStr)})
                                </div>
                              )}

                              {to.status === 'denied' && (
                                <>
                                  <div className="flex items-center gap-1.5 text-rose-800 font-semibold">
                                    <span className="material-symbols-outlined text-sm text-rose-600">cancel</span>
                                    Denied by {reviewerName}
                                  </div>
                                  {to.reviewed_at && (
                                    <p className="text-[10px] text-slate-500 pl-5">
                                      Denied on: {formatDateTime(to.reviewed_at)}
                                    </p>
                                  )}
                                  {to.manager_note && (
                                    <p className="text-xs text-rose-700 font-medium bg-rose-50 p-2 rounded-md border border-rose-200 mt-1">
                                      <strong>Manager Note:</strong> {to.manager_note}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Date Activity / Audit Log Section */}
                {dayAuditLogs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-purple-600">history</span>
                      Date Activity Log
                    </h4>
                    <div className="space-y-1.5">
                      {dayAuditLogs.map((log, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                          <p className="font-semibold text-slate-800">{log.metadata?.message || log.action_type}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{formatDateTime(log.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Opens Modal Popups */}
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateForModal(activeDayDetails.dateStr);
                    setIsModalOpen(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Request Time Off for {activeDayDetails.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateForModal(activeDayDetails.dateStr);
                    setIsAvailabilityModalOpen(true);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-300"
                >
                  <span className="material-symbols-outlined text-[16px]">event_available</span>
                  Provide Availability for {activeDayDetails.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend Section */}
        <div className="mt-6">
          <div className="bg-white p-6 rounded-xl border border-surface-border w-full">
            <h3 className="font-h3 text-h3 mb-4">Calendar Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-slate-700 border border-slate-600"></div>
                <span className="text-body-md">Draft Shift</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-emerald-700 border border-emerald-600"></div>
                <span className="text-body-md">Published Shift</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-emerald-600 border border-emerald-500"></div>
                <span className="text-body-md">Approved PTO</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-amber-50 border border-amber-300"></div>
                <span className="text-body-md">Pending Request</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
                <span className="text-body-md">Scheduled Off</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {user && (
        <>
          <TimeOffRequestModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={fetchTimeOffs}
            userId={user.id}
            initialDate={selectedDateForModal}
          />
          <ProvideAvailabilityModal 
            isOpen={isAvailabilityModalOpen}
            onClose={() => setIsAvailabilityModalOpen(false)}
            onSuccess={() => { /* Could fetch availability here if needed */ }}
            userId={user.id}
            initialDate={selectedDateForModal}
          />
        </>
      )}
    </Layout>
  );
}
