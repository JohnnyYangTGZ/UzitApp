import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import { useScheduleData } from '../hooks/useScheduleData';

export default function ManagerEmployees() {
  const { selectedDepartmentId, clinics } = useLocationContext();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState([]);
  
  // Real data states
  const { fetchMySchedule } = useScheduleData();
  const [shifts, setShifts] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [ytdShiftsCount, setYtdShiftsCount] = useState(0);
  
  // Absence Form State
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceType, setAbsenceType] = useState('Sick Call');
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [absenceNotes, setAbsenceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadEmployees() {
    if (!selectedDepartmentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
        user_id,
        employee_code,
        job_title,
        staffing_role,
        phone_number,
        shift_time,
        schedule_pattern,
        is_on_call,
        users!employee_profiles_user_id_fkey!inner (
          id,
          name,
          email,
          employee_clinics (
            clinic_id,
            locations ( id, name )
          )
        )
      `)
      .eq('department_id', selectedDepartmentId)
      .order('employee_code');

    if (error) {
      console.error('Error fetching employees:', error);
      setErrorMsg(error.message || JSON.stringify(error));
    } else if (data) {
      const sortedData = [...data].sort((a, b) => {
        const nameA = a.users?.name || '';
        const nameB = b.users?.name || '';
        return nameA.localeCompare(nameB);
      });

      setEmployees(sortedData);
      setErrorMsg('');
      
      if (selectedEmployee) {
        const updatedEmployee = sortedData.find(e => e.user_id === selectedEmployee.user_id);
        if (updatedEmployee) {
          setSelectedEmployee(updatedEmployee);
        } else {
          setSelectedEmployee(sortedData.length > 0 ? sortedData[0] : null);
        }
      } else {
        setSelectedEmployee(sortedData.length > 0 ? sortedData[0] : null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, [selectedDepartmentId]);

  // Fetch specific employee data
  useEffect(() => {
    if (!selectedEmployee) {
      setShifts([]);
      setAbsences([]);
      setTimeOffRequests([]);
      setYtdShiftsCount(0);
      return;
    }

    const loadEmployeeData = async () => {
      const today = new Date();
      const startDateStr = today.toISOString().split('T')[0];
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 13);
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Fetch shifts for next 14 days
      const shiftsData = await fetchMySchedule(selectedEmployee.user_id, startDateStr, endDateStr);
      setShifts(shiftsData || []);
      
      // Fetch YTD absences
      const currentYear = today.getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const { data: absenceData } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', selectedEmployee.user_id)
        .gte('date', startOfYear)
        .order('date', { ascending: false });
        
      setAbsences(absenceData || []);

      // Fetch Upcoming Time Off
      const { data: timeOffData } = await supabase
        .from('time_off_requests')
        .select(`
          id,
          start_date,
          end_date,
          status,
          time_off_type_code,
          reason,
          time_off_types ( name )
        `)
        .eq('user_id', selectedEmployee.user_id)
        .gte('end_date', startDateStr)
        .order('start_date', { ascending: true })
        .limit(3);
        
      setTimeOffRequests(timeOffData || []);

      // Fetch YTD shifts for on-time rate calculation
      const pastShiftsData = await fetchMySchedule(selectedEmployee.user_id, startOfYear, startDateStr);
      setYtdShiftsCount(pastShiftsData ? pastShiftsData.length : 0);
    };
    
    loadEmployeeData();
  }, [selectedEmployee, fetchMySchedule]);

  const handleRecordAbsence = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setIsSubmitting(true);
    
    const { error } = await supabase.from('attendance_logs').insert({
      user_id: selectedEmployee.user_id,
      date: absenceDate,
      absence_type: absenceType,
      notes: absenceNotes
    });
    
    if (!error) {
      // Refresh absences
      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const { data: absenceData } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', selectedEmployee.user_id)
        .gte('date', startOfYear)
        .order('date', { ascending: false });
      setAbsences(absenceData || []);
      
      setShowAbsenceForm(false);
      setAbsenceNotes('');
    } else {
      console.error('Error saving absence:', error);
    }
    setIsSubmitting(false);
  };

  async function loadRoles() {
    if (!selectedDepartmentId) return;
    const { data, error } = await supabase
      .from('staffing_roles')
      .select('name, description')
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true);
    if (!error && data) {
      setAvailableRoles(data.sort((a,b) => a.name.localeCompare(b.name)));
    }
  }

  const uniqueRoles = ['All', ...availableRoles.map(r => r.name)];
  const filteredEmployees = roleFilter === 'All' 
    ? employees 
    : employees.filter(e => e.staffing_role === roleFilter);

  // Helper to generate next 14 days
  const getNext14Days = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if scheduled
      const isWorking = shifts.some(s => s.shifts?.date === dateStr);
      // Check if absent on this date
      const absenceRecord = absences.find(a => a.date === dateStr);
      
      days.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        isWorking,
        absence: absenceRecord ? absenceRecord.absence_type : null
      });
    }
    return days;
  };
  
  const ytdSick = absences.filter(a => a.absence_type === 'Sick Call').length;
  const ytdNoShow = absences.filter(a => a.absence_type === 'No Call No Show').length;
  const ytdTardy = absences.filter(a => a.absence_type === 'Tardy').length;
  
  const totalAbsences = ytdSick + ytdNoShow + ytdTardy;
  const onTimeRate = ytdShiftsCount === 0 ? 100 : Math.max(0, Math.round(((ytdShiftsCount - totalAbsences) / ytdShiftsCount) * 100));

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface">Team Roster</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">View staff schedules and operational metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 border border-surface-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700 uppercase tracking-wider"
              >
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* Table Area (Left) */}
          <div className="w-[400px] bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
            <div className="overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">Loading employees...</div>
                ) : errorMsg ? (
                  <div className="p-8 text-center text-red-500 font-medium">Error: {errorMsg}</div>
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map(emp => {
                    const isSelected = selectedEmployee?.user_id === emp.user_id;
                    return (
                      <div 
                        key={emp.user_id} 
                        onClick={() => setSelectedEmployee(emp)}
                        className={`cursor-pointer transition-colors p-4 flex items-center gap-4 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                          {emp.users?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{emp.users?.name}</p>
                          <p className="text-sm text-slate-500 truncate">{emp.job_title}</p>
                        </div>
                        {emp.is_on_call && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="On-Call"></span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-500">No employees found.</div>
                )}
              </div>
            </div>
          </div>

          {/* Datacard Area (Right) */}
          <div className="flex-1 flex-shrink-0">
            {selectedEmployee ? (
              <div className="bg-white border border-surface-border rounded-xl shadow-md h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* Profile Header (Glassmorphism inspired) */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-8 flex items-center gap-6 text-white shrink-0">
                  <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center font-bold text-4xl shadow-lg uppercase">
                    {selectedEmployee?.users?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold tracking-tight">{selectedEmployee?.users?.name}</h2>
                    <p className="text-blue-100 text-lg font-medium mt-1">{selectedEmployee?.job_title}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-blue-200">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">mail</span> {selectedEmployee?.users?.email}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">phone</span> {selectedEmployee?.phone_number || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-right relative">
                    <button 
                      onClick={() => setShowAbsenceForm(!showAbsenceForm)}
                      className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 text-white"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                      <span className="text-sm font-semibold">Record Absence</span>
                    </button>
                    
                    {showAbsenceForm && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-10 text-left overflow-hidden">
                        <form onSubmit={handleRecordAbsence} className="p-4 space-y-4 text-slate-800">
                          <h3 className="font-bold text-slate-800">Record Absence</h3>
                          
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Type</label>
                            <select 
                              value={absenceType} 
                              onChange={(e) => setAbsenceType(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                            >
                              <option value="Sick Call">Sick Call</option>
                              <option value="No Call No Show">No Call No Show</option>
                              <option value="Tardy">Tardy</option>
                            </select>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Date</label>
                            <input 
                              type="date" 
                              value={absenceDate}
                              onChange={(e) => setAbsenceDate(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                              required
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Notes</label>
                            <textarea 
                              value={absenceNotes}
                              onChange={(e) => setAbsenceNotes(e.target.value)}
                              placeholder="Optional notes..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm h-20 resize-none"
                            ></textarea>
                          </div>
                          
                          <div className="pt-2 flex justify-end gap-2">
                            <button 
                              type="button" 
                              onClick={() => setShowAbsenceForm(false)}
                              className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit" 
                              disabled={isSubmitting}
                              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
                            >
                              {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dashboard Sections */}
                <div className="p-8 flex-1 overflow-y-auto bg-slate-50/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Left Column */}
                    <div className="space-y-8">
                      {/* Current Schedule */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600">calendar_month</span>
                            Upcoming 14 Days
                          </h3>
                          <span className="text-xs font-semibold text-slate-500 uppercase">{selectedEmployee.shift_time || 'Variable Shift'}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                          {getNext14Days().map((day, idx) => {
                            let cellBg = day.isWorking ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 opacity-50';
                            let textClass = day.isWorking ? 'text-blue-700' : 'text-slate-400';
                            let dotClass = day.isWorking ? 'bg-blue-500' : 'hidden';
                            
                            if (day.absence) {
                              cellBg = 'bg-red-50 border-red-200';
                              textClass = 'text-red-700';
                              dotClass = 'hidden';
                            }
                            
                            return (
                              <div key={idx} className={`flex flex-col items-center justify-center p-2 rounded-lg border min-h-[70px] ${cellBg}`} title={day.absence || (day.isWorking ? 'Working' : 'Off')}>
                                <span className="text-[10px] font-semibold text-slate-500">{day.name}</span>
                                <span className={`text-base font-bold ${textClass}`}>{day.date}</span>
                                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${dotClass}`}></div>
                                {day.absence && <span className="text-[9px] text-red-600 font-bold uppercase mt-0.5 truncate w-full text-center px-1" title={day.absence}>{day.absence.replace('Call', '').trim()}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Clinics */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined text-indigo-600">location_on</span>
                          Assigned Locations
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedEmployee?.users?.employee_clinics?.length > 0 ? (
                            selectedEmployee.users.employee_clinics.map((ec, idx) => (
                              <span key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">business</span>
                                {ec.locations?.name || 'Unknown Clinic'}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500 italic">No assigned locations.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                      {/* Attendance Report Mockup */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined text-emerald-600">analytics</span>
                          Attendance (YTD)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">On-Time Rate</p>
                            <p className="text-3xl font-bold text-emerald-600">{onTimeRate}%</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sick Days</p>
                            <p className="text-3xl font-bold text-orange-600">{ytdSick}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tardies</p>
                            <p className="text-3xl font-bold text-blue-600">{ytdTardy}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">No Shows</p>
                            <p className="text-3xl font-bold text-slate-800">{ytdNoShow}</p>
                          </div>
                        </div>
                      </div>

                      {/* Upcoming Time Off Mockup */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined text-purple-600">flight_takeoff</span>
                          Upcoming Time Off
                        </h3>
                        <div className="space-y-3">
                          {timeOffRequests.length > 0 ? (
                            timeOffRequests.map(req => {
                              const isApproved = req.status === 'approved';
                              const isPending = req.status === 'pending';
                              const statusColor = isApproved ? 'bg-emerald-100 text-emerald-800' : isPending ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800';
                              const iconColor = isApproved ? 'text-emerald-600' : isPending ? 'text-orange-600' : 'text-slate-500';
                              
                              const startDate = new Date(req.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              const endDate = req.end_date === req.start_date ? '' : ` - ${new Date(req.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                              
                              let icon = 'event';
                              if (req.time_off_type_code === 'PTO') icon = 'beach_access';
                              if (req.time_off_type_code === 'SICK') icon = 'medical_services';
                              
                              return (
                                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    <div className={`bg-white p-2 rounded shadow-sm ${iconColor}`}>
                                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">{req.time_off_types?.name || req.time_off_type_code}</p>
                                      <p className="text-xs font-medium text-slate-500">{startDate}{endDate}</p>
                                    </div>
                                  </div>
                                  <span className={`${statusColor} text-xs font-bold px-2 py-1 rounded uppercase`}>{req.status}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center p-4">
                              <p className="text-sm text-slate-500 italic">No upcoming time off requested.</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full bg-white border border-surface-border rounded-xl flex flex-col items-center justify-center text-slate-400 p-8 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-4xl opacity-50 text-blue-300">badge</span>
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Select an Employee</h3>
                <p className="text-sm max-w-sm">Click on any staff member from the roster on the left to view their detailed operational profile.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
