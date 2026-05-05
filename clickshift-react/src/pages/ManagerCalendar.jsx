import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useLocationContext } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import SearchableSelect from '../components/SearchableSelect';

export default function ManagerCalendar() {
  const { clinics, selectedClinicId } = useLocationContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  
  const [profiles, setProfiles] = useState([]);
  const [departmentProfiles, setDepartmentProfiles] = useState([]);
  const [timeOffs, setTimeOffs] = useState([]);
  const [timeOffTypes, setTimeOffTypes] = useState([]);
  const [staffTypeFilter, setStaffTypeFilter] = useState('All Staff');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTimeOffType, setSelectedTimeOffType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
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
          .eq('is_active', true);
        setProfiles(profs || []);

        // 4. Fetch Time Off
        const { data: offData } = await supabase
          .from('time_off_requests')
          .select('*, reviewer:users!reviewed_by(name)')
          .neq('status', 'cancelled')
          .in('user_id', userIds)
          .lte('start_date', maxDateStr)
          .gte('end_date', minDateStr);
        setTimeOffs(offData || []);
      } else {
        setProfiles([]);
        setTimeOffs([]);
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
  }, [selectedClinicId, currentMonth]);

  const handleDateClick = (date) => {
    if (!date) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setStartDate(dateStr);
    setEndDate(dateStr);
    setSelectedEmployee('');
    setSelectedTimeOffType('');
    setReason('');
    setIsModalOpen(true);
  };

  const handleOpenDetails = (staff) => {
    setSelectedTimeOffForDetails(staff);
    setEditStatus(staff.status);
    setEditNote(staff.manager_note || '');
  };

  const handleUpdateDetails = async () => {
    setIsUpdatingStatus(true);
    const { error } = await supabase
      .from('time_off_requests')
      .update({
        status: editStatus,
        manager_note: editNote,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id
      })
      .eq('id', selectedTimeOffForDetails.id);
      
    setIsUpdatingStatus(false);
    
    if (error) {
      alert("Failed to update time off request.");
      console.error(error);
    } else {
      setSelectedTimeOffForDetails(null);
      window.location.reload();
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
      // Quick refresh to show new data
      window.location.reload();
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
            <h1 className="font-h1 text-h1 text-primary mb-1">Time Off Calendar</h1>
            <p className="font-body-md text-on-surface-variant">
              {monthName} • {clinicName}
            </p>
          </div>
          <div className="flex items-center gap-6">
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
            <div className="grid grid-cols-7 auto-rows-fr">
              {calendarCells.map((date, idx) => {
                const staffOff = getStaffOffOnDate(date);
                const isToday = date && date.toDateString() === today.toDateString();
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleDateClick(date)}
                    className={`min-h-[140px] border-b border-r border-surface-border p-2 last:border-r-0 transition-all ${!date ? 'bg-slate-50/50' : 'hover:bg-slate-50 cursor-pointer hover:border-primary/30 shadow-sm hover:shadow'}`}
                    style={{ borderRightWidth: (idx + 1) % 7 === 0 ? '0' : '1px' }}
                  >
                    {date && (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-primary text-white' : 'text-slate-700'}`}>
                            {date.getDate()}
                          </span>
                          {staffOff.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 mr-1">
                              {staffOff.length} Off
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 overflow-y-auto max-h-[100px] pr-1">
                          {staffOff.map((staff, i) => (
                            <div 
                              key={`${staff.id}-${i}`} 
                              className={`px-2 py-1 text-xs rounded border flex items-center justify-between cursor-pointer opacity-90 hover:opacity-100 transition-opacity ${getRoleColor(staff.role)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetails(staff);
                              }}
                            >
                              <span className="font-semibold truncate mr-2">{staff.name}</span>
                              <span className="text-[9px] font-bold opacity-70 bg-black/10 px-1 rounded flex-shrink-0 uppercase">{staff.type}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Time Off Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-h3 text-h3 text-slate-800">Add Time Off</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmitTimeOff} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee</label>
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Leave Type</label>
                <select 
                  value={selectedTimeOffType} 
                  onChange={e => setSelectedTimeOffType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason (Optional)</label>
                <input 
                  type="text" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                  placeholder="e.g. Doctor's appointment" 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                />
              </div>
              
              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Time Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time Off Details Modal */}
      {selectedTimeOffForDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedTimeOffForDetails(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center ${getRoleColor(selectedTimeOffForDetails.role)}`}>
              <h3 className="font-bold text-slate-800">Time Off Request</h3>
              <button onClick={() => setSelectedTimeOffForDetails(null)} className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-white/50">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5 text-sm">
              <div>
                <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Employee</p>
                <p className="text-slate-900 font-semibold">{selectedTimeOffForDetails.name} <span className="text-slate-400 font-normal">({selectedTimeOffForDetails.role})</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Type</p>
                  <p className="text-slate-900 font-semibold">
                    {timeOffTypes.find(t => t.code === selectedTimeOffForDetails.type)?.name || selectedTimeOffForDetails.type}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Status</p>
                  <select 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary capitalize"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="waitlisted">Waitlisted</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Date Range</p>
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded">{selectedTimeOffForDetails.start_date}</span>
                  <span className="text-slate-400 text-xs">to</span>
                  <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded">{selectedTimeOffForDetails.end_date}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Requested Date/Time</p>
                  <p className="text-slate-900 font-medium text-xs">
                    {selectedTimeOffForDetails.created_at ? new Date(selectedTimeOffForDetails.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Approval Date/Time</p>
                  <p className="text-slate-900 font-medium text-xs">
                    {selectedTimeOffForDetails.reviewed_at ? new Date(selectedTimeOffForDetails.reviewed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Approved By</p>
                  <p className="text-slate-900 font-medium text-xs">
                    {selectedTimeOffForDetails.reviewed_by_name !== 'Unknown' ? selectedTimeOffForDetails.reviewed_by_name : 'System Auto-Approve'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Modified Date/Time</p>
                  <p className="text-slate-400 font-medium text-xs italic">
                    Not Tracked
                  </p>
                </div>
              </div>

              {selectedTimeOffForDetails.reason && (
                <div>
                  <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Reason</p>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 italic leading-relaxed">{selectedTimeOffForDetails.reason}</p>
                </div>
              )}
              
              <div>
                <p className="text-slate-500 font-bold mb-1.5 uppercase tracking-wider text-[10px]">Manager Note</p>
                <textarea 
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[60px]"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedTimeOffForDetails(null)} 
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold rounded-lg transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateDetails} 
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isUpdatingStatus ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
