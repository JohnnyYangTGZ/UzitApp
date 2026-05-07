import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useScheduleData } from '../hooks/useScheduleData';
import TimeOffRequestModal from '../components/TimeOffRequestModal';
import ProvideAvailabilityModal from '../components/ProvideAvailabilityModal';
import { supabase } from '../lib/supabaseClient';

export default function StaffSchedule() {
  const { user } = useAuth();
  const { fetchMySchedule, loading } = useScheduleData();
  const [shifts, setShifts] = useState([]);
  const [timeOffs, setTimeOffs] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [activeDateMenu, setActiveDateMenu] = useState(null);
  const [selectedDateForModal, setSelectedDateForModal] = useState('');

  // Derive start and end of the current month view
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

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
    const startDateStr = monthStart.toISOString().split('T')[0];
    const endDateStr = monthEnd.toISOString().split('T')[0];
    
    fetchMySchedule(user.id, startDateStr, endDateStr).then(data => {
      setShifts(data || []);
    });
    
    fetchTimeOffs();
  }, [user, currentDate, fetchMySchedule]);

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(hour, 10));
    d.setMinutes(parseInt(minute, 10));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
      const dateStr = d.toISOString().split('T')[0];
      // Find all shift assignments for this day
      const dayShifts = shifts.filter(a => a.shifts?.date === dateStr);
      // Find all time offs for this day
      const dayTimeOffs = timeOffs.filter(to => to.start_date <= dateStr && to.end_date >= dateStr);
      
      days.push({
        date: new Date(d),
        dateStr,
        isCurrentMonth: d.getMonth() === currentDate.getMonth(),
        shifts: dayShifts,
        timeOffs: dayTimeOffs
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [currentDate, shifts, timeOffs]);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

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
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-primary mb-1">My Schedule</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Manage your shifts and time-off requests for {monthName}.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-secondary text-on-primary font-bold px-5 py-2.5 rounded-lg hover:bg-secondary/90 transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Request Time Off
            </button>
            <div className="flex items-center bg-white border border-surface-border rounded-lg p-1 shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="px-4 font-h3 text-h3">{monthName}</span>
              <button onClick={nextMonth} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Summary Bento */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-surface-border p-6 rounded-xl flex items-start gap-4">
            <div className="bg-secondary-container text-on-secondary-container p-3 rounded-lg">
              <span className="material-symbols-outlined">work</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Total Shifts</p>
              <p className="font-h2 text-h2">{shifts.length}</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-6 rounded-xl flex items-start gap-4">
            <div className="bg-green-100 text-status-approved p-3 rounded-lg">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Approved PTO</p>
              <p className="font-h2 text-h2">{totalApprovedDays} Days</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-6 rounded-xl flex items-start gap-4">
            <div className="bg-amber-100 text-status-pending p-3 rounded-lg">
              <span className="material-symbols-outlined">hourglass_empty</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Pending Requests</p>
              <p className="font-h2 text-h2">{pendingCount}</p>
            </div>
          </div>
          <div className="bg-white border border-surface-border p-6 rounded-xl flex items-start gap-4">
            <div className="bg-primary text-on-primary p-3 rounded-lg">
              <span className="material-symbols-outlined">query_builder</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Total Hours</p>
              <p className="font-h2 text-h2">{shifts.length * 8}h</p>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-surface-border bg-surface-container-lowest">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
              <div key={day} className={`py-4 text-center font-label-sm text-on-surface-variant ${day !== 'SAT' ? 'border-r border-surface-border' : ''}`}>{day}</div>
            ))}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading schedule...</div>
          ) : (
            <div className="grid grid-cols-7 relative">
              {calendarDays.map((day, i) => (
                <div 
                  key={day.dateStr} 
                  className={`min-h-[120px] p-3 border-b border-surface-border relative ${i % 7 !== 6 ? 'border-r border-surface-border' : ''} ${!day.isCurrentMonth ? 'bg-surface-container-low opacity-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                  onClick={() => day.isCurrentMonth && setActiveDateMenu(activeDateMenu === day.dateStr ? null : day.dateStr)}
                >
                  <span className="text-sm font-data-tabular">{day.date.getDate()}</span>
                  
                  {activeDateMenu === day.dateStr && (
                    <div className="absolute top-8 left-2 right-2 bg-white rounded-lg shadow-lg border border-slate-200 z-10 overflow-hidden flex flex-col animate-fade-in">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateForModal(day.dateStr);
                          setIsModalOpen(true);
                          setActiveDateMenu(null);
                        }}
                        className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors border-b border-slate-100 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">event_busy</span>
                        Request Time Off
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateForModal(day.dateStr);
                          setIsAvailabilityModalOpen(true);
                          setActiveDateMenu(null);
                        }}
                        className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-green-600 transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[16px]">event_available</span>
                        Provide Availability
                      </button>
                    </div>
                  )}

                  {day.shifts.map((assignment, idx) => (
                    <div key={`shift-${idx}`} className="mt-2 bg-on-secondary-container text-white p-2 rounded text-xs font-medium">
                      <p className="truncate mb-0.5">{assignment.shifts.location?.name}</p>
                      <p className="opacity-80">
                        {assignment.shifts.start_time && assignment.shifts.end_time
                          ? `${formatTime(assignment.shifts.start_time)} - ${formatTime(assignment.shifts.end_time)}`
                          : `${assignment.shifts.time_block} Shift`}
                      </p>
                    </div>
                  ))}

                  {day.timeOffs.map((to, idx) => {
                    const isApproved = to.status === 'approved';
                    const isPending = to.status === 'pending';
                    
                    if (isApproved) {
                      return (
                        <div key={`to-${idx}`} className="mt-2 bg-green-50 border border-green-200 text-status-approved p-2 rounded text-xs font-medium">
                          <p>{to.time_off_type_code}</p>
                          <p className="opacity-80 text-[10px] uppercase">Approved</p>
                        </div>
                      );
                    } else if (isPending) {
                      return (
                        <div key={`to-${idx}`} className="mt-2 bg-amber-50 border border-amber-200 text-status-pending p-2 rounded text-xs font-medium">
                          <p>{to.time_off_type_code}</p>
                          <p className="opacity-80 text-[10px] uppercase">Pending</p>
                        </div>
                      );
                    } else {
                      return null;
                    }
                  })}
                  
                  {day.isCurrentMonth && day.shifts.length === 0 && day.timeOffs.length === 0 && day.date.getDay() !== 0 && day.date.getDay() !== 6 && (
                     <div className="mt-2 bg-slate-100 text-status-off p-2 rounded text-xs font-medium border border-slate-200">
                       <p>Off</p>
                     </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend and Notes Section */}
        <div className="mt-6 flex flex-col md:flex-row gap-6">
          <div className="bg-white p-6 rounded-xl border border-surface-border flex-1">
            <h3 className="font-h3 text-h3 mb-4">Calendar Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-on-secondary-container"></div>
                <span className="text-body-md">Working Shift</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-green-50 border border-green-200"></div>
                <span className="text-body-md">Approved PTO</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div>
                <span className="text-body-md">Pending Request</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
                <span className="text-body-md">Scheduled Off</span>
              </div>
            </div>
          </div>
          <div className="bg-primary-container text-white p-6 rounded-xl md:w-80 flex flex-col justify-between">
            <div>
              <h3 className="font-h3 text-h3 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined">lightbulb</span> 
                Pro-Tip
              </h3>
              <p className="text-body-md opacity-90 leading-snug">Click on any date to swap shifts with colleagues or request a schedule adjustment.</p>
            </div>
            <button className="mt-4 bg-white text-primary px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors">View Swap Board</button>
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
