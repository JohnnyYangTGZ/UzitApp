import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useScheduleData } from '../hooks/useScheduleData';
import { useLocationContext } from '../context/LocationContext';

export default function WeeklyBoard() {
  const { fetchWeeklyBoard, loading } = useScheduleData();
  const { selectedClinicId } = useLocationContext();
  const [boardData, setBoardData] = useState({ shifts: [], users: [] });
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekDays = useMemo(() => {
    const days = [];
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); // Monday
    const startOfWeek = new Date(curr.setDate(first));

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: d.getDate(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return days;
  }, [currentDate]);

  useEffect(() => {
    if (!selectedClinicId) return;
    const startDate = weekDays[0].dateStr;
    const endDate = weekDays[6].dateStr;
    fetchWeeklyBoard(selectedClinicId, startDate, endDate).then(data => {
      setBoardData(data || { shifts: [], users: [] });
    });
  }, [currentDate, weekDays, fetchWeeklyBoard, selectedClinicId]);

  const monthName = weekDays[0].date.toLocaleString('default', { month: 'short' });
  const yearStr = weekDays[0].date.getFullYear();
  const weekLabel = `${monthName} ${weekDays[0].dayNumber} - ${weekDays[6].date.toLocaleString('default', { month: 'short' })} ${weekDays[6].dayNumber}, ${yearStr}`;

  const nextWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
  const prevWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto min-h-screen">
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <nav className="flex items-center gap-2 text-on-surface-variant text-label-sm mb-2">
              <span>Operational Board</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary">Weekly View</span>
            </nav>
            <h1 className="font-h1 text-h1 text-on-surface">Weekly Clinic Staffing Board</h1>
            <p className="text-body-md text-on-surface-variant mt-1">{weekLabel} • Downtown Outpatient Center</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white p-4 rounded-xl border border-surface-border flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-status-approved/10 flex items-center justify-center text-status-approved">
                <span className="material-symbols-outlined">how_to_reg</span>
              </div>
              <div>
                <p className="text-label-sm text-on-surface-variant">Coverage</p>
                <p className="text-h3 font-h3 text-on-surface">100%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduling Grid Container */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-visible flex flex-col mb-8">
          {/* Grid Tools */}
          <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-bright">
            <div className="flex gap-2">
              <div className="flex border border-surface-border rounded-lg overflow-hidden">
                <button onClick={prevWeek} className="p-2 bg-white hover:bg-slate-50 border-r border-surface-border flex items-center justify-center"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1 bg-white hover:bg-slate-50 text-sm font-medium">This Week</button>
                <button onClick={nextWeek} className="p-2 bg-white hover:bg-slate-50 border-l border-surface-border flex items-center justify-center"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <span className="w-3 h-3 rounded bg-blue-700"></span> AM Shift
                <span className="w-3 h-3 rounded bg-blue-400"></span> PM Shift
              </div>
              <button className="flex items-center gap-2 text-sm font-semibold text-white bg-secondary px-4 py-2 rounded-lg hover:opacity-90">
                <span className="material-symbols-outlined text-lg">publish</span> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading staffing board...</div>
            ) : (
              <table className="w-full border-collapse table-fixed min-w-[1000px]">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="sticky-col top-0 w-64 bg-surface-container-low z-30 p-4 text-left border-b border-r border-surface-border">
                      <span className="text-label-sm uppercase text-on-surface-variant">Staff Member</span>
                    </th>
                    {weekDays.map((d, i) => (
                      <th key={i} className={`sticky top-0 p-4 border-b border-r border-slate-200 z-20 ${d.isWeekend ? 'bg-slate-100' : 'bg-surface-container-low'}`}>
                        <p className={`text-label-sm ${d.isWeekend ? 'text-slate-400' : 'text-on-surface-variant'}`}>{d.dayName}</p>
                        <p className={`text-h3 ${d.isWeekend ? 'text-slate-400' : ''}`}>{d.dayNumber}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {boardData.users.map(user => (
                    <tr key={user.id} className="group">
                      <td className="sticky-col bg-white group-hover:bg-slate-50 border-r border-surface-border p-4 z-10">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-primary">
                              {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{user.name}</p>
                            <p className="text-[10px] text-on-surface-variant uppercase font-medium">{user.role}</p>
                          </div>
                        </div>
                      </td>
                      
                      {weekDays.map(day => {
                        const shiftForDay = user.shifts.find(s => s.date === day.dateStr);
                        
                        if (!shiftForDay) {
                          return <td key={day.dateStr} className={`p-2 border-r border-b border-slate-200 ${day.isWeekend ? 'bg-slate-50' : ''}`}></td>;
                        }

                        const isAM = shiftForDay.timeBlock === 'AM';
                        
                        return (
                          <td key={day.dateStr} className={`p-2 border-r border-b border-slate-200 ${isAM ? 'bg-blue-700/5' : 'bg-blue-400/5'}`}>
                            <div className={`${isAM ? 'bg-blue-700' : 'bg-blue-400'} text-white rounded p-2 text-[11px] font-bold shadow-sm text-center`}>
                              <p>{shiftForDay.timeBlock} SHIFT</p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  
                  {boardData.users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">No staff scheduled for this week.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
