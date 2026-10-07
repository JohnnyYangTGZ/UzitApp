import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import TimeOffRequestModal from '../components/TimeOffRequestModal';

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Staff';

  const [upcomingShift, setUpcomingShift] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [weeklyShifts, setWeeklyShifts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [readNotifsMap, setReadNotifsMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`read_notifs_${user?.id}`) || '{}');
    } catch (e) {
      return {};
    }
  });

  const handleMarkAsRead = (notifId, e) => {
    if (e) e.stopPropagation();
    const nowISO = new Date().toISOString();
    const updated = { ...readNotifsMap, [notifId]: nowISO };
    setReadNotifsMap(updated);
    if (user?.id) {
      localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(updated));
    }
  };

  const handleMarkAllAsRead = () => {
    const nowISO = new Date().toISOString();
    const updated = { ...readNotifsMap };
    notifications.forEach(n => {
      if (!updated[n.id]) {
        updated[n.id] = nowISO;
      }
    });
    setReadNotifsMap(updated);
    if (user?.id) {
      localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(updated));
    }
  };

  const handleNotificationClick = (notif) => {
    handleMarkAsRead(notif.id);
    navigate(`/my-schedule?date=${notif.dateStr}`);
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const formatLocalDateStr = (d = new Date()) => {
        if (!d) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const todayStr = formatLocalDateStr(new Date());
      
      // Fetch shifts
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select(`
          id,
          shifts ( date, time_block, start_time, end_time, locations ( name ) )
        `)
        .eq('user_id', user.id);
      const ANCHOR_DATE = new Date(2025, 11, 14);
      const getCycleDayIndex = (dateObj) => {
        const diffTime = dateObj.getTime() - ANCHOR_DATE.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let cycleDayIndex = diffDays % 14;
        if (cycleDayIndex < 0) cycleDayIndex += 14;
        return cycleDayIndex;
      };

      const { data: profile } = await supabase
        .from('employee_profiles')
        .select('schedule_pattern, shift_time')
        .eq('user_id', user.id)
        .single();
        
      const { data: clinics } = await supabase
        .from('employee_clinics')
        .select('locations(name)')
        .eq('user_id', user.id);
      
      const primaryClinicName = clinics && clinics.length > 0 ? clinics[0].locations?.name : 'Assigned Clinic';

      let pattern = null;
      if (profile && profile.schedule_pattern) {
        if (Array.isArray(profile.schedule_pattern)) {
           pattern = profile.schedule_pattern;
        } else if (typeof profile.schedule_pattern === 'string') {
           try {
             pattern = JSON.parse(profile.schedule_pattern.replace('{', '[').replace('}', ']'));
           } catch(e) {}
        } else if (typeof profile.schedule_pattern === 'object') {
           pattern = Object.keys(profile.schedule_pattern).sort((a,b)=>Number(a)-Number(b)).map(k => profile.schedule_pattern[k]);
        }
      }

      const { data: futureTimeOffs } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .gte('end_date', todayStr);

      const isTimeOffDay = (dateStr) => {
        return futureTimeOffs?.some(t => t.start_date <= dateStr && t.end_date >= dateStr);
      };

      const manualAssignmentsMap = {};
      if (assignments) {
        assignments.forEach(a => {
          if (a.shifts && a.shifts.date) {
             manualAssignmentsMap[a.shifts.date] = {
               shifts: {
                 locations: a.shifts.locations,
                 date: a.shifts.date,
                 start_time: a.shifts.start_time,
                 end_time: a.shifts.end_time
               }
             };
          }
        });
      }

      let foundUpcoming = null;
      const todayDate = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() + i);
        const dateStr = formatLocalDateStr(d);
        
        if (manualAssignmentsMap[dateStr]) {
           foundUpcoming = manualAssignmentsMap[dateStr];
           break;
        }
        
        if (isTimeOffDay(dateStr)) continue;
        
        if (pattern && pattern.length === 14) {
          const cycleIdx = getCycleDayIndex(d);
          const val = pattern[cycleIdx];
          
          if (val !== false && val !== null && val !== undefined) {
             let sTime = '09:00:00';
             let eTime = '17:30:00';
             let shiftTimeString = typeof val === 'string' ? val : (profile?.shift_time || '');
             if (shiftTimeString && shiftTimeString.includes('-')) {
                const parts = shiftTimeString.split('-');
                sTime = parts[0].trim() + (parts[0].trim().length === 5 ? ':00' : '');
                eTime = parts[1].trim() + (parts[1].trim().length === 5 ? ':00' : '');
             }

             foundUpcoming = {
               shifts: {
                 locations: { name: primaryClinicName },
                 date: dateStr,
                 start_time: sTime,
                 end_time: eTime
               }
             };
             break;
          }
        }
      }
      
      setUpcomingShift(foundUpcoming);

      // Compute Weekly Shifts Snapshot (Sun to Sat of current week)
      const now = new Date();
      const sun = new Date(now);
      sun.setDate(now.getDate() - now.getDay());

      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sun);
        d.setDate(sun.getDate() + i);
        const dateStr = formatLocalDateStr(d);
        const isToday = dateStr === todayStr;

        let dayStatus = 'OFF';
        let shiftTimeStr = '';
        let clinicName = primaryClinicName;

        if (isTimeOffDay(dateStr)) {
          dayStatus = 'TIME_OFF';
        } else if (manualAssignmentsMap[dateStr]) {
          const ass = manualAssignmentsMap[dateStr];
          dayStatus = 'WORKING';
          clinicName = ass.shifts?.locations?.name || primaryClinicName;
          if (ass.shifts?.start_time && ass.shifts?.end_time) {
            shiftTimeStr = `${formatTime(ass.shifts.start_time)} - ${formatTime(ass.shifts.end_time)}`;
          }
        } else if (pattern && pattern.length === 14) {
          const cycleIdx = getCycleDayIndex(d);
          const val = pattern[cycleIdx];
          if (val !== false && val !== null && val !== undefined) {
            dayStatus = 'WORKING';
            shiftTimeStr = typeof val === 'string' ? val : (profile?.shift_time || '09:00 - 17:30');
          }
        }

        weekDays.push({
          dateStr,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          dateNum: d.getDate(),
          monthName: d.toLocaleDateString('en-US', { month: 'short' }),
          isToday,
          dayStatus,
          shiftTimeStr,
          clinicName
        });
      }
      setWeeklyShifts(weekDays);

      // Fetch recent time off requests
      const { data: requests } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);
      setRecentRequests(requests || []);

      // Fetch notifications from audit_logs and merge with localStorage
      const notifList = [];
      try {
        const { data: dbLogs } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('action_type', 'SCHEDULE_CHANGE')
          .order('created_at', { ascending: false })
          .limit(25);

        if (dbLogs) {
          dbLogs.forEach(log => {
            if (log.metadata && (log.metadata.userId === user.id || log.metadata.user_id === user.id)) {
              const uniqueId = `db_${log.id}`;
              notifList.push({
                id: uniqueId,
                message: log.metadata.message || `Schedule change for ${log.metadata.dateStr}`,
                dateStr: log.metadata.dateStr,
                action: log.metadata.action,
                shiftCustomId: log.metadata.shiftCustomId,
                timestamp: log.created_at
              });
            }
          });
        }
      } catch(e) {}

      try {
        const localNotifs = JSON.parse(localStorage.getItem(`notifs_${user.id}`) || '[]');
        localNotifs.forEach(ln => {
          const uniqueId = ln.id || `local_${ln.dateStr}_${ln.action}_${ln.timestamp}`;
          if (!notifList.some(n => n.dateStr === ln.dateStr && n.action === ln.action && n.shiftCustomId === ln.shiftCustomId)) {
            notifList.push({
              ...ln,
              id: uniqueId
            });
          }
        });
      } catch(e) {}

      notifList.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(notifList);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // 1. Supabase Realtime Subscription (Instant WebSocket updates when manager changes schedule)
    const channel = supabase
      .channel(`staff_dashboard_realtime_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assigned_shifts' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_publications' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off_requests' }, fetchData)
      .subscribe();

    // 2. Tab Focus listener (auto-refreshes if employee switches back to tab)
    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  // Formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(hour, 10));
    d.setMinutes(parseInt(minute, 10));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-status-approved';
      case 'rejected': return 'bg-red-100 text-status-declined';
      default: return 'bg-yellow-100 text-status-pending';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'hourglass_empty';
    }
  };

  const unreadNotifications = notifications.filter(n => !readNotifsMap[n.id]);

  return (
    <Layout>
      <header className="mb-10">
        <h1 className="font-h1 text-h1 text-on-surface">Staff Dashboard</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Welcome back, {firstName}. Here's your overview for today.</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          <section className="bg-primary text-on-primary rounded-xl p-8 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-label-sm font-label-sm">UPCOMING SHIFT</span>
              </div>
              
              {loading ? (
                <div className="text-primary-fixed-dim animate-pulse">Loading upcoming shift...</div>
              ) : upcomingShift ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-1">
                      <h2 className="font-h2 text-h2 mb-2">{upcomingShift.shifts.locations?.name || 'Assigned Clinic'}</h2>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-primary-fixed-dim font-body-lg flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                          {formatDate(upcomingShift.shifts.date)}
                        </p>
                        <p className="text-primary-fixed-dim font-body-lg flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px]">schedule</span>
                          <span>
                            {upcomingShift.shifts.start_time && upcomingShift.shifts.end_time 
                              ? `${formatTime(upcomingShift.shifts.start_time)} - ${formatTime(upcomingShift.shifts.end_time)}`
                              : 'Time TBD'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col md:items-start justify-between gap-6">
                  <div>
                    <h2 className="font-h2 text-h2 mb-1">No Upcoming Shifts</h2>
                    <p className="text-primary-fixed-dim font-body-lg">You do not have any scheduled shifts in the future.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
          </section>

          {/* Weekly Schedule Snapshot Card */}
          <section className="bg-white border border-surface-border rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">date_range</span>
                <h3 className="font-h3 text-h3 text-slate-900">Weekly Schedule Snapshot</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {weeklyShifts.length > 0 ? `${weeklyShifts[0].monthName} ${weeklyShifts[0].dateNum} – ${weeklyShifts[6].monthName} ${weeklyShifts[6].dateNum}` : 'Current Week'}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weeklyShifts.map((day, idx) => {
                const isWork = day.dayStatus === 'WORKING';
                const isTimeOff = day.dayStatus === 'TIME_OFF';

                return (
                  <div
                    key={idx}
                    onClick={() => navigate(`/my-schedule?date=${day.dateStr}`)}
                    className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer min-h-[95px] ${
                      day.isToday 
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs' 
                        : isWork 
                          ? 'bg-slate-50 border-slate-200 hover:border-blue-300' 
                          : isTimeOff
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50/50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="text-center">
                      <span className={`text-[11px] font-bold block uppercase ${day.isToday ? 'text-blue-700' : 'text-slate-500'}`}>
                        {day.dayName}
                      </span>
                      <span className={`text-base font-extrabold ${day.isToday ? 'text-blue-900' : 'text-slate-800'}`}>
                        {day.dateNum}
                      </span>
                    </div>

                    <div className="w-full text-center mt-1">
                      {isWork ? (
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 uppercase tracking-tight w-full truncate">
                            {day.shiftTimeStr || 'Scheduled'}
                          </span>
                        </div>
                      ) : isTimeOff ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase tracking-tight">
                          Time Off
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">OFF</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Schedule Change Notifications Card */}
          <section className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-surface-border flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">notifications</span>
                <h3 className="font-h3 text-h3 text-slate-900">Schedule Updates & Notifications</h3>
                {unreadNotifications.length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadNotifications.length} NEW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAllNotifsModal(true)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-amber-400 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm text-slate-500">history</span>
                  View All Notifications ({notifications.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-surface-border">
              {loading ? (
                <div className="p-6 text-slate-500 text-center">Loading notifications...</div>
              ) : unreadNotifications.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/50 text-slate-500 rounded-b-xl flex flex-col items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-emerald-500 text-3xl mb-1">task_alt</span>
                  <p className="font-bold text-sm text-slate-800">No unread notifications</p>
                  <p className="text-xs text-slate-400">All live schedule changes have been reviewed. Click "View All Notifications" to view your historical log.</p>
                </div>
              ) : (
                unreadNotifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className="p-5 flex items-center justify-between hover:bg-amber-50/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        notif.action === 'UNASSIGNED' 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {notif.action === 'UNASSIGNED' ? 'event_busy' : 'event_available'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                            {notif.message}
                          </p>
                          <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Unread</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-3">
                          <span>Target Date: <strong className="text-slate-700">{formatDate(notif.dateStr)}</strong></span>
                          <span>&bull;</span>
                          <span className="text-slate-500">Created: <strong className="text-slate-700">{formatDateTime(notif.timestamp)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-lg transition-colors shadow-2xs"
                        title="Mark as read without opening"
                      >
                        Mark Read
                      </button>
                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 transition-colors ml-2">
                        <span className="text-xs font-bold">View Shift</span>
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white border border-surface-border rounded-xl shadow-sm">
            <div className="p-6 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-h3 text-h3">Recent Requests</h3>
              <a className="text-primary font-semibold text-sm hover:underline" href="/my-schedule">View Calendar</a>
            </div>
            
            <div className="divide-y divide-surface-border">
              {loading ? (
                <div className="p-6 text-slate-500 text-center">Loading requests...</div>
              ) : recentRequests.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">No recent time off requests.</div>
              ) : (
                recentRequests.map(req => (
                  <div key={req.id} className="p-6 flex items-center justify-between hover:bg-surface-background transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <span className="material-symbols-outlined">{getStatusIcon(req.status)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-on-surface">{req.time_off_type_code} Leave</div>
                        <div className="text-sm text-on-surface-variant">
                          {formatDate(req.start_date)} {req.start_date !== req.end_date ? ` - ${formatDate(req.end_date)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`${getStatusColor(req.status)} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
            <h3 className="font-h3 text-h3 mb-6">Time Off Balance</h3>
            <div className="space-y-6">
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Annual Leave</span>
                  <span className="text-lg font-bold text-on-surface">18 / 25 <span className="text-xs font-normal text-slate-400">days left</span></span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-700 rounded-full" style={{width: '72%'}}></div>
                </div>
              </div>
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Sick Leave</span>
                  <span className="text-lg font-bold text-on-surface">8 / 10 <span className="text-xs font-normal text-slate-400">days left</span></span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 rounded-full" style={{width: '80%'}}></div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-8 py-3 border border-secondary text-secondary font-bold rounded-lg hover:bg-secondary-container transition-colors"
            >
              Request Time Off
            </button>
          </section>

          <section className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-surface-border">
              <h3 className="font-h3 text-h3">Operational Memo</h3>
            </div>
            <div className="p-0">
              <div className="h-48 relative">
                <img alt="Hospital Hallway" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAV7PhLrZYeRveeTZQ6CfVEjn_Q3JgOXImAQfS4tTwZfEAKHyLVzLOjaA-clTBH3S0Uxan3RFcRcyOu_P3jzh6pkNbo6FylsAzf0PEuu8CvpUrW9NERg1KdiajKZQW0yDvWfcfVCgurYNH6Ls4niqgFvIRTfRtek-GTfK3KV3LgxUCi8Xz8q2X8qXwPyqia0V9OxR10TiZMqit92Q39piAovw8D1caMaSrho6bPloPVk0NibuHpPVXUe7Ef8H8dlnz-VpBlYSwA31_H"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-1">Clinic Updates</div>
                  <div className="text-sm font-medium leading-tight">North Wing construction starting Monday. Please use Service Entrance B.</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {user && (
        <TimeOffRequestModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchData}
          userId={user.id}
        />
      )}

      {/* View All Notifications History & Compliance Log Modal */}
      {showAllNotifsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-400 text-2xl">history_toggle_off</span>
                <div>
                  <h3 className="font-bold text-base text-white">Notifications Log & Compliance Record</h3>
                  <p className="text-xs text-slate-400">Complete audit trail of creation and read timestamps</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                  >
                    Mark All as Read
                  </button>
                )}
                <button
                  onClick={() => setShowAllNotifsModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Notification History List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No notifications on record.</div>
              ) : (
                notifications.map(notif => {
                  const readTime = readNotifsMap[notif.id];
                  const isRead = !!readTime;

                  return (
                    <div key={notif.id} className="py-4.5 px-3 hover:bg-slate-50 rounded-lg transition-colors flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.action === 'UNASSIGNED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">
                            {notif.action === 'UNASSIGNED' ? 'event_busy' : 'event_available'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-xs">{notif.message}</p>
                          <p className="text-slate-500 font-medium">Target Date: <strong className="text-slate-700">{formatDate(notif.dateStr)}</strong></p>
                          
                          {/* Compliance Timestamps */}
                          <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
                            <span className="text-slate-600 flex items-center gap-1">
                              <span className="font-sans font-bold text-slate-400 uppercase text-[9px]">Created:</span> 
                              {formatDateTime(notif.timestamp)}
                            </span>
                            <span className="text-slate-300">|</span>
                            {isRead ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                                <span className="font-sans font-bold text-slate-400 uppercase text-[9px]">Read:</span> 
                                {formatDateTime(readTime)}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <span className="font-sans font-bold text-amber-800 uppercase text-[9px]">Status:</span> UNREAD
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {!isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded font-bold transition-colors"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowAllNotifsModal(false);
                            handleNotificationClick(notif);
                          }}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-bold transition-colors flex items-center gap-1"
                        >
                          View Shift
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowAllNotifsModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
