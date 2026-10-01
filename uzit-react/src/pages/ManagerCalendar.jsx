import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useLocationContext } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import SearchableSelect from '../components/SearchableSelect';

export default function ManagerCalendar() {
  const { clinics, selectedClinicId, setSelectedClinicId } = useLocationContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Default to ALL clinics when entering the calendar page
  useEffect(() => {
    setSelectedClinicId('ALL');
  }, [setSelectedClinicId]);
  
  const [profiles, setProfiles] = useState([]);
  const [departmentProfiles, setDepartmentProfiles] = useState([]);
  const [timeOffs, setTimeOffs] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [assignedShifts, setAssignedShifts] = useState([]);
  const [timeOffTypes, setTimeOffTypes] = useState([]);
  const [staffTypeFilter, setStaffTypeFilter] = useState('All Staff');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Menu State
  const [activeDateMenu, setActiveDateMenu] = useState(null);
  const [expandedAvailDate, setExpandedAvailDate] = useState(null);
  const [activeConfMenu, setActiveConfMenu] = useState(null);
  const [activeWhosHereDate, setActiveWhosHereDate] = useState(null);
  const [activeTimeOffPopover, setActiveTimeOffPopover] = useState(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveTimeOffPopover(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTimeOffType, setSelectedTimeOffType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [shiftTime, setShiftTime] = useState('Any');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTimeOffForDetails, setSelectedTimeOffForDetails] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!selectedClinicId) return;

    async function fetchData() {
      setLoading(true);

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const minDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const maxDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Get selected clinic details to find department_id
      const targetClinicId = selectedClinicId === 'ALL' && clinics.length > 0 ? clinics[0].id : selectedClinicId;
      const { data: clinicData } = await supabase
        .from('locations')
        .select('parent_location_id')
        .eq('id', targetClinicId)
        .single();
      
      const departmentId = clinicData?.parent_location_id;
      let deptProfs = [];

      if (departmentId) {
        const { data: fetchedDeptProfs } = await supabase
          .from('employee_profiles')
          .select(`*, users:user_id ( id, name )`)
          .eq('department_id', departmentId)
          .eq('is_active', true)
          .order('users(name)');
        deptProfs = fetchedDeptProfs || [];
        setDepartmentProfiles(deptProfs);
      } else {
        setDepartmentProfiles([]);
      }

      // 2. Fetch users for this clinic (or all if ALL is selected)
      let userIds = [];
      if (selectedClinicId === 'ALL') {
        userIds = deptProfs.map(dp => dp.user_id);
      } else {
        const { data: clinicUsers } = await supabase
          .from('employee_clinics')
          .select('user_id')
          .eq('clinic_id', selectedClinicId);
        userIds = (clinicUsers || []).map(cu => cu.user_id);
      }

      // 3. Fetch profiles
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('employee_profiles')
          .select(`*, users:user_id ( id, name )`)
          .in('user_id', userIds)
        const schedulableProfs = (profs || []).filter(p => {
          const role = (p.staffing_role || p.job_title || '').toUpperCase();
          return !role.includes('ADMIN') && !role.includes('MANAGER') && !role.includes('SYSTEM ADMINISTRATOR');
        });
        setProfiles(schedulableProfs);

        // 4. Fetch Time Off
        const { data: offData } = await supabase
          .from('time_off_requests')
          .select('*, reviewer:users!reviewed_by(name)')
          .neq('status', 'cancelled')
          .in('user_id', userIds)
          .lte('start_date', maxDateStr)
          .gte('end_date', minDateStr);
        setTimeOffs(offData || []);

        // Fetch Availability
        const { data: availData } = await supabase
          .from('employee_availability')
          .select('*')
          .in('user_id', userIds)
          .lte('date', maxDateStr)
          .gte('date', minDateStr);
        setAvailabilities(availData || []);

        const { data: shiftsData } = await supabase
          .from('shifts')
          .select(`
            id, date, start_time, end_time, time_block, location_id, locations ( name ),
            shift_assignments!inner ( user_id )
          `)
          .in('shift_assignments.user_id', userIds)
          .lte('date', maxDateStr)
          .gte('date', minDateStr);
        setAssignedShifts(shiftsData || []);
      } else {
        setProfiles([]);
        setTimeOffs([]);
        setAvailabilities([]);
        setAssignedShifts([]);
      }

      // 5. Fetch Time Off Types
      const { data: typesData } = await supabase
        .from('time_off_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setTimeOffTypes(typesData || []);

      setLoading(false);
    }
    fetchData();
  }, [selectedClinicId, currentMonth, refreshTrigger]);

  useEffect(() => {
    if (startDate !== endDate) {
      setStartTime('');
      setEndTime('');
    }
  }, [startDate, endDate]);

  const handleDateClick = (date) => {
    if (!date) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setActiveDateMenu(activeDateMenu === dateStr ? null : dateStr);
    setActiveConfMenu(null);
  };

  const openTimeOffModal = (dateStr) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setStartTime('');
    setEndTime('');
    setSelectedEmployee('');
    setSelectedTimeOffType('');
    setReason('');
    setIsModalOpen(true);
    setActiveDateMenu(null);
  };

  const openAvailabilityModal = (dateStr) => {
    setStartDate(dateStr); // Reuse startDate for availability date
    setSelectedEmployee('');
    setShiftTime('Any');
    setReason(''); // Reuse reason for notes
    setIsAvailabilityModalOpen(true);
    setActiveDateMenu(null);
  };

  const triggerTimeOffNotification = async ({ userId, status, timeOffType, startDate, endDate, managerNote, userName }) => {
    const statusUpper = (status || '').toUpperCase();
    const dateStr = startDate || '';
    const empName = userName || selectedTimeOffForDetails?.name || 'Employee';

    const msg = `Time Off Request ${statusUpper}: Your ${timeOffType || 'time off'} request for ${dateStr}${endDate && endDate !== dateStr ? ` to ${endDate}` : ''} has been ${statusUpper}.${managerNote ? ` Note: "${managerNote}"` : ''}`;

    console.log(`[NOTIFICATION DISPATCH] ${msg} for user ${userId}`);

    try {
      await supabase.from('audit_logs').insert([{
        action_type: 'SCHEDULE_CHANGE',
        target_type: 'time_off_request',
        metadata: {
          userId,
          userName: empName,
          action: `TIME_OFF_${statusUpper}`,
          status,
          dateStr,
          endDate,
          message: msg,
          managerNote,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (err) {
      console.warn('Failed to insert audit log notification:', err);
    }

    try {
      const storageKey = `notifs_${userId}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newNotif = {
        id: Date.now(),
        userId,
        action: `TIME_OFF_${statusUpper}`,
        dateStr,
        message: msg,
        timestamp: new Date().toISOString()
      };
      existing.unshift(newNotif);
      localStorage.setItem(storageKey, JSON.stringify(existing.slice(0, 20)));
    } catch(e) {}
  };

  const updateTimeOffRequestStatus = async (requestId, updates) => {
    // 1. Try standard update first
    const { error: updateErr } = await supabase
      .from('time_off_requests')
      .update(updates)
      .eq('id', requestId);

    if (!updateErr) return;

    // 2. If standard update fails (e.g. broken net.http_post DB trigger), fallback to delete + re-insert
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

  const handleQuickActionUpdate = async (staffItem, newStatus) => {
    setIsUpdatingStatus(true);
    try {
      await updateTimeOffRequestStatus(staffItem.id, {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id
      });

      await triggerTimeOffNotification({
        userId: staffItem.user_id,
        userName: staffItem.name,
        status: newStatus,
        timeOffType: staffItem.type,
        startDate: staffItem.start_date,
        endDate: staffItem.end_date,
        managerNote: null
      });

      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenDetails = (staff) => {
    setSelectedTimeOffForDetails(staff);
    setEditStatus(staff.status);
    setEditNote(staff.manager_note || '');
  };

  const handleUpdateDetails = async () => {
    if (!selectedTimeOffForDetails) return;
    setIsUpdatingStatus(true);
    try {
      await updateTimeOffRequestStatus(selectedTimeOffForDetails.id, {
        status: editStatus,
        manager_note: editNote.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id
      });

      await triggerTimeOffNotification({
        userId: selectedTimeOffForDetails.user_id,
        userName: selectedTimeOffForDetails.name,
        status: editStatus,
        timeOffType: selectedTimeOffForDetails.type,
        startDate: selectedTimeOffForDetails.start_date,
        endDate: selectedTimeOffForDetails.end_date,
        managerNote: editNote.trim() || null
      });

      setSelectedTimeOffForDetails(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to update time off request details:', err);
      alert('Failed to update time off request: ' + (err.message || err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSubmitTimeOff = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedTimeOffType || !startDate || !endDate) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('time_off_requests').insert({
      user_id: selectedEmployee,
      time_off_type_code: selectedTimeOffType,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || null,
      end_time: endTime || null,
      reason: reason,
      status: 'approved', // Auto-approve since manager is adding it
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id
    });
    
    setIsSubmitting(false);
    if (error) {
      alert("Failed to add time off.");
      console.error(error);
    } else {
      setIsModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleSubmitAvailability = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !startDate || !shiftTime) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('employee_availability').upsert({
      user_id: selectedEmployee,
      date: startDate,
      shift_time: shiftTime,
      notes: reason
    }, { onConflict: 'user_id,date' });
    
    setIsSubmitting(false);
    if (error) {
      alert("Failed to add availability.");
      console.error(error);
    } else {
      setIsAvailabilityModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  // Calendar math
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(new Date(year, month, i));
  }
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const ANCHOR_DATE = new Date(2025, 11, 14);

  const getStaffOffOnDate = (date) => {
    if (!date) return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Calculate 14-day cycle index for this date
    const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const utcAnchor = Date.UTC(ANCHOR_DATE.getFullYear(), ANCHOR_DATE.getMonth(), ANCHOR_DATE.getDate());
    const diffDays = Math.round((utcDate - utcAnchor) / (1000 * 60 * 60 * 24));
    const cycleIndex = ((diffDays % 14) + 14) % 14;

    return timeOffs
      .filter(to => to.start_date <= dateStr && to.end_date >= dateStr)
      .filter(to => {
        // Filter by Staff Type if selected
        const prof = profiles.find(p => p.user_id === to.user_id);
        if (!prof) return false;
        
        if (staffTypeFilter !== 'All Staff' && prof.staffing_role !== staffTypeFilter) return false;

        // Display time off regardless of their standard schedule pattern.
        // This ensures time off for variable/on-call staff is visible, 
        // and provides a complete picture of an employee's unavailability.
        return true;
      })
      .map(to => {
        const prof = profiles.find(p => p.user_id === to.user_id);
        return {
          id: to.id,
          user_id: to.user_id,
          name: prof?.users?.name || 'Unknown',
          role: prof?.staffing_role || 'Staff',
          type: to.time_off_type_code,
          start_date: to.start_date,
          end_date: to.end_date,
          status: to.status,
          reason: to.reason,
          manager_note: to.manager_note,
          created_at: to.created_at,
          reviewed_at: to.reviewed_at,
          reviewed_by_name: to.reviewer?.name || 'Unknown'
        };
      });
  };

  const getStaffAvailOnDate = (date) => {
    if (!date) return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    return availabilities
      .filter(avail => avail.date === dateStr)
      .filter(avail => {
        // Filter by Staff Type if selected
        const prof = profiles.find(p => p.user_id === avail.user_id);
        if (!prof) return false;
        if (staffTypeFilter !== 'All Staff' && prof.staffing_role !== staffTypeFilter) return false;
        return true;
      })
      .map(avail => {
        const prof = profiles.find(p => p.user_id === avail.user_id);
        
        const confirmedShift = assignedShifts.find(shift => 
          shift.date === dateStr && shift.shift_assignments?.some(sa => sa.user_id === avail.user_id)
        );

        if (selectedClinicId !== 'ALL' && confirmedShift && confirmedShift.location_id !== selectedClinicId) {
          return null;
        }

        const isConfirmed = !!confirmedShift;
        let displayTime = avail.shift_time || 'Any';

        if (confirmedShift) {
          if (confirmedShift.start_time && confirmedShift.end_time) {
            displayTime = `${confirmedShift.start_time.slice(0,5)} - ${confirmedShift.end_time.slice(0,5)}`;
          } else if (confirmedShift.time_block) {
            displayTime = confirmedShift.time_block;
          }
        }

        return {
          id: avail.id,
          user_id: avail.user_id,
          name: prof ? prof.users?.name : 'Unknown Staff',
          role: prof ? prof.staffing_role : 'N/A',
          shift_time: displayTime,
          notes: avail.notes,
          date: dateStr,
          isConfirmed,
          clinic: confirmedShift?.locations?.name || 'Unknown Clinic'
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

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
          if (t === 'true' || t === 't') return true;
          if (t === 'false' || t === 'f') return false;
          if (t === 'null' || t === 'undefined') return null;
          return t.replace(/^"|"$/g, '');
        });
      }
    }
    if (typeof pattern === 'object' && !Array.isArray(pattern)) {
      return Object.keys(pattern).sort((a,b)=>Number(a)-Number(b)).map(k => pattern[k]);
    }
    return null;
  };

  const getWorkingStaffOnDate = (date) => {
    if (!date) return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 1. Get user IDs of staff on approved time off on this date
    const approvedOffUserIds = new Set(
      timeOffs
        .filter(to => to.status === 'approved' && to.start_date <= dateStr && to.end_date >= dateStr)
        .map(to => to.user_id)
    );

    // 2. Get manual shift assignments for this date
    const manualAssignedMap = {};
    assignedShifts.forEach(shift => {
      if (shift.date === dateStr && shift.shift_assignments) {
        shift.shift_assignments.forEach(sa => {
          manualAssignedMap[sa.user_id] = shift;
        });
      }
    });

    // 3. Calculate 14-day cycle index
    const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const utcAnchor = Date.UTC(ANCHOR_DATE.getFullYear(), ANCHOR_DATE.getMonth(), ANCHOR_DATE.getDate());
    const diffDays = Math.round((utcDate - utcAnchor) / (1000 * 60 * 60 * 24));
    const cycleIndex = ((diffDays % 14) + 14) % 14;

    const working = [];

    profiles.forEach(prof => {
      // Filter by Staff Type if selected
      if (staffTypeFilter !== 'All Staff' && prof.staffing_role !== staffTypeFilter) return;

      // If staff has approved PTO on this date, they are not working
      if (approvedOffUserIds.has(prof.user_id)) return;

      let isWorking = false;
      let shiftTimeStr = prof.shift_time || 'Regular Shift';

      // Check if explicitly assigned to a manual shift
      if (manualAssignedMap[prof.user_id]) {
        isWorking = true;
        const s = manualAssignedMap[prof.user_id];
        if (s.start_time && s.end_time) {
          shiftTimeStr = `${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)}`;
        } else if (s.time_block) {
          shiftTimeStr = s.time_block;
        }
      } else {
        // Check 14-day cycle schedule pattern
        const pattern = parsePattern(prof.schedule_pattern);
        if (pattern && pattern.length === 14) {
          const val = pattern[cycleIndex];
          if (val !== false && val !== null && val !== undefined) {
            isWorking = true;
            if (typeof val === 'string' && val !== 'true') {
              shiftTimeStr = val;
            }
          }
        }
      }

      if (isWorking) {
        working.push({
          user_id: prof.user_id,
          name: prof.users?.name || 'Unknown',
          role: prof.staffing_role || 'Staff',
          shift_time: shiftTimeStr
        });
      }
    });

    working.sort((a, b) => a.name.localeCompare(b.name));
    return working;
  };

  const getTimeOffStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200';
      case 'pending':
        return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
      case 'denied':
        return 'bg-rose-100 text-rose-900 border-rose-300 line-through opacity-75';
      default:
        return 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
    }
  };

  const getRoleColor = (role) => {
    const roleColors = {
      'RN': 'bg-blue-100 text-blue-800 border-blue-200',
      'LVN': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'MA': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'MD': 'bg-purple-100 text-purple-800 border-purple-200',
      'DO': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return roleColors[role] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const clinicName = selectedClinicId === 'ALL' ? 'All Clinics' : clinics.find(c => c.id === selectedClinicId)?.name || 'Loading...';
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-h1 text-h1 text-primary mb-1">Calendar</h1>
            <p className="font-body-md text-on-surface-variant">
              {monthName} • {clinicName}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Pending
              </span>
            </div>

            <select
              value={staffTypeFilter}
              onChange={(e) => setStaffTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold py-2 px-3 rounded-lg outline-none focus:ring-1 focus:ring-primary shadow-sm"
            >
              <option value="All Staff">All Staff</option>
              <option value="RN">RN</option>
              <option value="LVN">LVN</option>
              <option value="MA">MA</option>
              <option value="MD">MD</option>
              <option value="DO">DO</option>
            </select>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={handlePrevMonth}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all flex items-center"
                title="Previous Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button 
                onClick={handleToday}
                className="px-4 py-1.5 text-sm font-semibold rounded transition-all hover:bg-white hover:shadow-sm text-slate-600"
              >
                Today
              </button>
              <button 
                onClick={handleNextMonth}
                className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all flex items-center"
                title="Next Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden mb-12">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-surface-border">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
              <div key={day} className="px-4 py-3 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider border-r border-surface-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          {loading ? (
            <div className="h-[600px] flex items-center justify-center">
              <span className="text-slate-400">Loading calendar data...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-auto">
              {calendarCells.map((date, idx) => {
                const staffOff = getStaffOffOnDate(date);
                const staffAvail = getStaffAvailOnDate(date);
                const workingStaff = getWorkingStaffOnDate(date);
                const isToday = date && date.toDateString() === today.toDateString();
                const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleDateClick(date)}
                    className={`min-h-[140px] border-b border-r border-surface-border p-2 relative last:border-r-0 transition-all ${!date ? 'bg-slate-50/50' : 'hover:bg-slate-50 cursor-pointer hover:border-primary/30 shadow-sm hover:shadow'}`}
                    style={{ borderRightWidth: (idx + 1) % 7 === 0 ? '0' : '1px' }}
                  >
                    {date && (
                      <>
                        {activeDateMenu === dateStr && (
                          <div className="absolute top-8 left-2 right-2 bg-white rounded-lg shadow-xl border border-slate-200 z-20 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openTimeOffModal(dateStr);
                              }}
                              className="text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors border-b border-slate-100 flex items-center gap-2 font-semibold"
                            >
                              <span className="material-symbols-outlined text-[18px]">event_busy</span>
                              Add Time Off
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openAvailabilityModal(dateStr);
                              }}
                              className="text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors flex items-center gap-2 font-semibold"
                            >
                              <span className="material-symbols-outlined text-[18px]">event_available</span>
                              Add Availability
                            </button>
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5 relative">
                            <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                              isToday ? 'bg-primary text-white' : 'text-slate-800'
                            }`}>
                              {date.getDate()}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-0.5">
                            {staffAvail.filter(a => !a.isConfirmed).length > 0 && (
                              <span 
                                className="text-[10px] font-bold text-green-600 uppercase tracking-wider mr-1 cursor-pointer hover:text-green-800 transition-colors bg-green-50 px-1.5 py-0.5 rounded border border-green-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAvailDate(expandedAvailDate === dateStr ? null : dateStr);
                                }}
                              >
                                {staffAvail.filter(a => !a.isConfirmed).length} Avail
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5 pr-1">
                          {(() => {
                            const unassignedConfirmed = [...staffAvail.filter(a => a.isConfirmed)];
                            const items = [];
                            
                            staffOff.forEach((staff, i) => {
                              const statusColorClass = getTimeOffStatusColor(staff.status);
                              const isApproved = staff.status === 'approved';
                              const isPending = staff.status === 'pending';

                              items.push(
                                <div 
                                  key={`off-${staff.id}-${i}`} 
                                  className={`px-2 py-1 text-xs rounded border flex items-center justify-between cursor-pointer transition-all shadow-2xs relative ${statusColorClass}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTimeOffPopover(activeTimeOffPopover === staff.id ? null : staff.id);
                                  }}
                                  title={`${staff.name} - ${staff.type} (${staff.status?.toUpperCase() || 'PENDING'})`}
                                >
                                  <span className="font-semibold truncate mr-2">{staff.name}</span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[9px] font-bold opacity-75 bg-black/10 px-1 rounded uppercase">
                                      {staff.type || 'VAC'}
                                    </span>
                                    {isApproved && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Approved"></span>
                                    )}
                                    {isPending && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" title="Pending"></span>
                                    )}
                                  </div>

                                  {/* Compact Quick Action Popover */}
                                  {activeTimeOffPopover === staff.id && (
                                    <div 
                                      className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 z-[80] p-3 space-y-2 text-left animate-in fade-in zoom-in-95 duration-100 cursor-default"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                        <div className="truncate pr-1">
                                          <p className="font-bold text-xs text-slate-900 truncate">{staff.name}</p>
                                          <p className="text-[10px] text-slate-500 font-medium truncate">{staff.type || 'Time Off'}</p>
                                        </div>
                                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                          staff.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                          staff.status === 'denied' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                          'bg-amber-100 text-amber-800 border border-amber-200'
                                        }`}>
                                          {staff.status || 'pending'}
                                        </span>
                                      </div>

                                      <div className="space-y-1 pt-1">
                                        {/* Open Request Action */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveTimeOffPopover(null);
                                            handleOpenDetails(staff);
                                          }}
                                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-between transition-colors"
                                        >
                                          <span className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-sm text-blue-600">open_in_new</span>
                                            Open Request
                                          </span>
                                          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
                                        </button>

                                        {/* Quick Approve Action */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveTimeOffPopover(null);
                                            handleQuickActionUpdate(staff, 'approved');
                                          }}
                                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-bold text-emerald-700 flex items-center gap-1.5 transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                                          Approve
                                        </button>

                                        {/* Quick Deny Action */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveTimeOffPopover(null);
                                            handleOpenDetails(staff);
                                            setEditStatus('denied');
                                          }}
                                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-bold text-rose-700 flex items-center gap-1.5 transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm text-rose-600">cancel</span>
                                          Deny Request
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                              
                              const matchIndex = unassignedConfirmed.findIndex(a => a.role === staff.role);
                              if (matchIndex !== -1) {
                                const coveringStaff = unassignedConfirmed.splice(matchIndex, 1)[0];
                                items.push(
                                  <div 
                                    key={`conf-${coveringStaff.id}-${i}`} 
                                    className={`px-2 py-1 text-xs rounded border flex items-center justify-between cursor-pointer opacity-90 hover:opacity-100 transition-opacity relative ${getRoleColor(coveringStaff.role)}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveConfMenu(activeConfMenu === coveringStaff.id ? null : coveringStaff.id);
                                    }}
                                  >
                                    <span className="font-semibold truncate mr-2">- {coveringStaff.name}</span>
                                    <span className="text-[9px] font-bold opacity-70 bg-black/10 px-1 rounded flex-shrink-0 uppercase">CONF</span>
                                    {activeConfMenu === coveringStaff.id && (
                                      <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-[70] p-2 animate-in fade-in zoom-in-95 duration-100 cursor-default" onClick={e => e.stopPropagation()}>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Working At</p>
                                        <p className="font-semibold text-slate-800 text-xs mb-2">{coveringStaff.clinic}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shift Time</p>
                                        <p className="font-semibold text-slate-800 text-xs">{coveringStaff.shift_time}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            });
                            
                            unassignedConfirmed.forEach((coveringStaff, i) => {
                                items.push(
                                  <div 
                                    key={`conf-unmatched-${coveringStaff.id}-${i}`} 
                                    className={`px-2 py-1 text-xs rounded border flex items-center justify-between cursor-pointer opacity-90 hover:opacity-100 transition-opacity relative ${getRoleColor(coveringStaff.role)}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveConfMenu(activeConfMenu === coveringStaff.id ? null : coveringStaff.id);
                                    }}
                                  >
                                    <span className="font-semibold truncate mr-2">- {coveringStaff.name}</span>
                                    <span className="text-[9px] font-bold opacity-70 bg-black/10 px-1 rounded flex-shrink-0 uppercase">CONF</span>
                                    {activeConfMenu === coveringStaff.id && (
                                      <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-[70] p-2 animate-in fade-in zoom-in-95 duration-100 cursor-default" onClick={e => e.stopPropagation()}>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Working At</p>
                                        <p className="font-semibold text-slate-800 text-xs mb-2">{coveringStaff.clinic}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shift Time</p>
                                        <p className="font-semibold text-slate-800 text-xs">{coveringStaff.shift_time}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                            });
                            
                            return items;
                          })()}
                        </div>
                        {expandedAvailDate === dateStr && (
                          <div className="absolute top-8 right-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-30 overflow-y-auto max-h-[200px] flex flex-col animate-in fade-in zoom-in-95 duration-100 p-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1 border-b border-slate-100 flex justify-between items-center">
                              Available Staff
                              <button onClick={(e) => { e.stopPropagation(); setExpandedAvailDate(null); }} className="hover:text-slate-600">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>
                            {staffAvail.filter(a => !a.isConfirmed).map((avail, i) => (
                              <div 
                                key={`avail-${avail.id}-${i}`} 
                                className="px-2 py-1.5 text-xs rounded flex flex-col transition-colors cursor-pointer hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  
                                  let startTime = '09:00';
                                  let endTime = '17:00';
                                  if (avail.shift_time && avail.shift_time.includes('-')) {
                                    const parts = avail.shift_time.split('-');
                                    if (parts.length === 2) {
                                      const parsedStart = parts[0].trim();
                                      const parsedEnd = parts[1].trim();
                                      if (/^\d{2}:\d{2}$/.test(parsedStart)) startTime = parsedStart;
                                      if (/^\d{2}:\d{2}$/.test(parsedEnd)) endTime = parsedEnd;
                                    }
                                  }

                                  window.dispatchEvent(new CustomEvent('open-add-shift', {
                                    detail: {
                                      date: avail.date,
                                      userId: avail.user_id,
                                      staffingRole: avail.role,
                                      startTime: startTime,
                                      endTime: endTime
                                    }
                                  }));
                                }}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-slate-800 truncate mr-2">{avail.name}</span>
                                  <span className="text-[9px] font-bold opacity-80 text-green-700 bg-green-100 px-1 rounded flex-shrink-0 uppercase">AVAIL</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {avail.shift_time}
                                </span>
                                {avail.notes && <span className="text-[9px] text-slate-400 italic mt-0.5 truncate">{avail.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Time Off Right Drawer */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200" 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-[440px] max-w-full h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-blue-400 text-2xl">event_busy</span>
                  <div>
                    <h3 className="font-bold text-base text-white">Add Time Off</h3>
                    <p className="text-xs text-slate-400">Schedule staff time off or vacation</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form id="add-time-off-form" onSubmit={handleSubmitTimeOff} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employee</label>
                  <SearchableSelect 
                    options={departmentProfiles.map(p => ({
                      value: p.user_id,
                      label: `${p.users?.name} (${p.staffing_role})`
                    }))}
                    value={selectedEmployee} 
                    onChange={setSelectedEmployee}
                    placeholder="Select an employee..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Leave Type</label>
                  <select 
                    value={selectedTimeOffType} 
                    onChange={e => setSelectedTimeOffType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-800"
                    required
                  >
                    <option value="">Select a type...</option>
                    {timeOffTypes.map(t => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">End Date</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium" 
                      required 
                    />
                  </div>
                </div>
                
                {startDate && endDate && startDate === endDate && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Start Time (Optional)</label>
                      <input 
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">End Time (Optional)</label>
                      <input 
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Reason (Optional)</label>
                  <input 
                    type="text" 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="e.g. Doctor's appointment" 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800" 
                  />
                </div>
              </form>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="add-time-off-form"
                disabled={isSubmitting} 
                className="px-5 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? 'Saving...' : 'Add Time Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Availability Right Drawer */}
      {isAvailabilityModalOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200" 
          onClick={() => setIsAvailabilityModalOpen(false)}
        >
          <div 
            className="w-[440px] max-w-full h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-400 text-2xl">event_available</span>
                  <div>
                    <h3 className="font-bold text-base text-white">Add Availability</h3>
                    <p className="text-xs text-slate-400">Record employee availability windows</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAvailabilityModalOpen(false)} 
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form id="add-availability-form" onSubmit={handleSubmitAvailability} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Employee</label>
                  <SearchableSelect 
                    options={departmentProfiles.map(p => ({
                      value: p.user_id,
                      label: `${p.users?.name} (${p.staffing_role})`
                    }))}
                    value={selectedEmployee} 
                    onChange={setSelectedEmployee}
                    placeholder="Select an employee..."
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Date</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Available Time</label>
                    <select 
                      value={shiftTime}
                      onChange={(e) => setShiftTime(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-800"
                      required
                    >
                      <option value="Any">Any Time</option>
                      <option value="08:00 - 17:00">08:00 - 17:00 (Day)</option>
                      <option value="12:00 - 20:00">12:00 - 20:00 (Swing)</option>
                      <option value="08:00 - 12:00">08:00 - 12:00 (Morning)</option>
                      <option value="13:00 - 17:00">13:00 - 17:00 (Afternoon)</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                  <input 
                    type="text" 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="Any preferences or constraints" 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800" 
                  />
                </div>
              </form>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button" 
                onClick={() => setIsAvailabilityModalOpen(false)} 
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="add-availability-form"
                disabled={isSubmitting} 
                className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? 'Saving...' : 'Add Availability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Off Details Right Drawer */}
      {selectedTimeOffForDetails && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200" 
          onClick={() => setSelectedTimeOffForDetails(null)}
        >
          <div 
            className="w-[440px] max-w-full h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div>
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-base border border-blue-400/30 uppercase">
                    {selectedTimeOffForDetails.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      {selectedTimeOffForDetails.name}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700 uppercase">
                        {selectedTimeOffForDetails.role}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {timeOffTypes.find(t => t.code === selectedTimeOffForDetails.type)?.name || selectedTimeOffForDetails.type || 'Time Off Request'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTimeOffForDetails(null)} 
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-6 space-y-6 text-sm">
                {/* Quick Action Approval Bar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status & Quick Actions</span>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full uppercase border ${
                      editStatus === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      editStatus === 'denied' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {editStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditStatus('approved');
                      }}
                      className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                        editStatus === 'approved' 
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditStatus('denied');
                      }}
                      className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                        editStatus === 'denied' 
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm' 
                          : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                      Deny
                    </button>
                  </div>

                  {/* Status Dropdown selector */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Change Status:</span>
                    <select 
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary capitalize bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="denied">Denied</option>
                      <option value="waitlisted">Waitlisted</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Optional Note Field (Highlighted when Denying) */}
                <div className={`p-4 rounded-xl border transition-all ${
                  editStatus === 'denied' ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200' : 'bg-white border-slate-200'
                }`}>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                    editStatus === 'denied' ? 'text-rose-800' : 'text-slate-600'
                  }`}>
                    Manager Note {editStatus === 'denied' ? '(Optional - Reason for Denial)' : '(Optional)'}
                  </label>
                  <textarea 
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder={editStatus === 'denied' ? 'Add optional note explaining denial...' : 'Add a note for the employee...'}
                    className={`w-full border rounded-lg p-2.5 text-xs outline-none transition-all ${
                      editStatus === 'denied' 
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-white' 
                        : 'border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary'
                    }`}
                    rows={3}
                  />
                </div>

                {/* Details Section */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Date Range</p>
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                      <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">{selectedTimeOffForDetails.start_date}</span>
                      <span className="text-slate-400">to</span>
                      <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">{selectedTimeOffForDetails.end_date}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Requested Date/Time</p>
                      <p className="text-slate-900 font-medium text-xs">
                        {selectedTimeOffForDetails.created_at ? new Date(selectedTimeOffForDetails.created_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Approval/Review Date</p>
                      <p className="text-slate-900 font-medium text-xs">
                        {selectedTimeOffForDetails.reviewed_at ? new Date(selectedTimeOffForDetails.reviewed_at).toLocaleString() : 'Not Reviewed'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Reviewed By</p>
                      <p className="text-slate-900 font-medium text-xs">
                        {selectedTimeOffForDetails.reviewed_by_name !== 'Unknown' ? selectedTimeOffForDetails.reviewed_by_name : (user?.email || 'Manager')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Modified Date/Time</p>
                      <p className="text-slate-400 font-medium text-xs italic">
                        Not Tracked
                      </p>
                    </div>
                  </div>

                  {selectedTimeOffForDetails.reason && (
                    <div>
                      <p className="text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Employee Reason</p>
                      <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 italic text-xs leading-relaxed">
                        "{selectedTimeOffForDetails.reason}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button"
                onClick={() => setSelectedTimeOffForDetails(null)} 
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleUpdateDetails} 
                disabled={isUpdatingStatus}
                className="px-5 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpdatingStatus ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    Save Changes
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
