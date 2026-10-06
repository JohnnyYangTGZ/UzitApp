import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';

export default function AttendanceCalendarModal({ isOpen, onClose, employee }) {
  const { clinics, selectedClinicId, selectedDepartmentId } = useLocationContext();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Quick Add / Edit record modal state
  const [activeDateModal, setActiveDateModal] = useState(null); // 'YYYY-MM-DD'
  const [recordType, setRecordType] = useState('VAC');
  const [recordHoursMinutes, setRecordHoursMinutes] = useState('8h');
  const [recordNotes, setRecordNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    if (isOpen && employee?.user_id) {
      fetchAttendanceRecords();
    }
  }, [isOpen, employee, selectedYear]);

  const fetchAttendanceRecords = async () => {
    if (!employee?.user_id) return;
    setLoading(true);

    try {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      // 1. Fetch Approved & Pending Time Off Requests
      const { data: timeOffs, error: timeOffErr } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('user_id', employee.user_id)
        .lte('start_date', yearEnd)
        .gte('end_date', yearStart);

      if (timeOffErr) throw timeOffErr;

      // 2. Fetch Absence & Attendance Log Entries from LocalStorage / Supabase Audit Logs
      let auditRecords = [];
      try {
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('action_type', 'ATTENDANCE_RECORD')
          .filter('metadata->>userId', 'eq', employee.user_id);
        
        if (auditData) {
          auditRecords = auditData.map(a => a.metadata);
        }
      } catch (e) {}

      // Fallback local storage records
      let localRecords = [];
      try {
        localRecords = JSON.parse(localStorage.getItem(`attendance_${employee.user_id}_${selectedYear}`) || '[]');
      } catch (e) {}

      // Combine all records into unified map by YYYY-MM-DD
      const mergedMap = {};

      (timeOffs || []).forEach(to => {
        const typeCode = (to.time_off_type_code || 'VAC').toUpperCase();
        let displayStr = '8h';
        
        if (to.start_time && to.end_time) {
          const [sH, sM] = to.start_time.split(':').map(Number);
          const [eH, eM] = to.end_time.split(':').map(Number);
          const diffMins = (eH * 60 + eM) - (sH * 60 + sM);
          if (diffMins > 0) {
            const hrs = (diffMins / 60).toFixed(1).replace(/\.0$/, '');
            displayStr = `${hrs}h`;
          }
        }

        // Expand multi-day date range
        let curr = new Date(to.start_date + 'T00:00:00');
        const end = new Date(to.end_date + 'T00:00:00');
        while (curr <= end) {
          const dateStr = curr.toISOString().split('T')[0];
          if (dateStr.startsWith(String(selectedYear))) {
            mergedMap[dateStr] = {
              type: typeCode,
              label: `${displayStr} ${typeCode}`,
              notes: to.notes || ''
            };
          }
          curr.setDate(curr.getDate() + 1);
        }
      });

      // Merge audit & local records
      [...auditRecords, ...localRecords].forEach(rec => {
        if (rec.date && rec.date.startsWith(String(selectedYear))) {
          mergedMap[rec.date] = {
            type: rec.type || 'TDT',
            label: rec.label || `${rec.hoursMinutes || '15m'} ${rec.type || 'TDT'}`,
            notes: rec.notes || ''
          };
        }
      });

      setRecords(mergedMap);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickRecord = async (e) => {
    e.preventDefault();
    if (!activeDateModal || !employee?.user_id) return;

    setSavingRecord(true);
    try {
      const typeCode = recordType.toUpperCase();
      const label = `${recordHoursMinutes} ${typeCode}`;
      const newRec = {
        userId: employee.user_id,
        date: activeDateModal,
        type: typeCode,
        hoursMinutes: recordHoursMinutes,
        label,
        notes: recordNotes
      };

      // 1. Save to local storage
      const existing = JSON.parse(localStorage.getItem(`attendance_${employee.user_id}_${selectedYear}`) || '[]');
      const updated = existing.filter(r => r.date !== activeDateModal);
      updated.push(newRec);
      localStorage.setItem(`attendance_${employee.user_id}_${selectedYear}`, JSON.stringify(updated));

      // 2. Log audit entry
      try {
        await supabase.from('audit_logs').insert([{
          action_type: 'ATTENDANCE_RECORD',
          target_type: 'attendance',
          metadata: newRec
        }]);
      } catch (e) {}

      // Update state
      setRecords(prev => ({
        ...prev,
        [activeDateModal]: { type: typeCode, label, notes: recordNotes }
      }));

      setActiveDateModal(null);
      setRecordNotes('');
    } catch (err) {
      console.error('Error saving attendance record:', err);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDeleteRecord = (dateStr) => {
    try {
      const existing = JSON.parse(localStorage.getItem(`attendance_${employee.user_id}_${selectedYear}`) || '[]');
      const updated = existing.filter(r => r.date !== dateStr);
      localStorage.setItem(`attendance_${employee.user_id}_${selectedYear}`, JSON.stringify(updated));

      setRecords(prev => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
      setActiveDateModal(null);
    } catch (e) {}
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !employee) return null;

  const clinicName = clinics.find(c => c.id === selectedClinicId)?.name || 'AFM1';
  const employeeName = employee.users?.name || employee.name || 'Employee';
  const employeeCode = employee.employee_code || '#N/A';
  const seniorityDateStr = (employee.company_start_date || employee.seniority_date)
    ? new Date(employee.company_start_date || employee.seniority_date).toLocaleDateString('en-US', { timeZone: 'UTC' })
    : '1/0/1900';

  // Badge Color Helper matching reference PDF
  const getBadgeStyle = (type) => {
    const t = (type || '').toUpperCase();
    if (t.includes('VAC')) return 'bg-emerald-500 text-white font-bold border-emerald-600'; // Vacation (Teal / Green)
    if (t.includes('SCK') || t.includes('SCL') || t.includes('SICK')) return 'bg-rose-600 text-white font-bold border-rose-700'; // Sick / Banked (Red)
    if (t.includes('CES') || t.includes('STU') || t.includes('FMLA') || t.includes('PSL')) return 'bg-amber-400 text-amber-950 font-bold border-amber-500'; // CESLA / FMLA (Yellow/Gold)
    if (t.includes('TDT') || t.includes('TWK') || t.includes('TARDY')) return 'bg-cyan-400 text-cyan-950 font-bold border-cyan-500'; // Tardy (Cyan / Light Blue)
    if (t.includes('HOL') || t.includes('BHL')) return 'bg-blue-600 text-white font-bold border-blue-700'; // Holiday (Dark Blue)
    if (t.includes('PAY')) return 'bg-purple-600 text-white font-bold border-purple-700'; // Pay Day (Purple)
    if (t.includes('LOA')) return 'bg-slate-600 text-white font-bold border-slate-700'; // LOA (Gray)
    if (t.includes('EDU')) return 'bg-indigo-600 text-white font-bold border-indigo-700'; // Education Day (Violet)
    return 'bg-blue-500 text-white font-bold border-blue-600';
  };

  // Render Month Calendar Box
  const renderMonthBox = (monthIndex) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[monthIndex];
    const monthNum = monthIndex + 1;

    const firstDay = new Date(selectedYear, monthIndex, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();

    // Total cells in month grid (5 or 6 weeks x 7 days)
    const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

    return (
      <div key={monthIndex} className="border border-slate-400 rounded-sm bg-white overflow-hidden flex flex-col shadow-2xs">
        {/* Month Header Bar */}
        <div className="bg-slate-100 px-2 py-0.5 border-b border-slate-400 flex items-center justify-between">
          <span className="font-extrabold text-slate-900 text-xs tracking-tight">{monthName}</span>
          <span className="text-[10px] font-black text-slate-500 bg-slate-200 px-1.5 rounded">{monthNum}</span>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center bg-slate-50 border-b border-slate-300 text-[9px] font-black text-slate-700">
          <div className="py-0.5 border-r border-slate-200">Sun</div>
          <div className="py-0.5 border-r border-slate-200">Mon</div>
          <div className="py-0.5 border-r border-slate-200">Tue</div>
          <div className="py-0.5 border-r border-slate-200">Wed</div>
          <div className="py-0.5 border-r border-slate-200">Thur</div>
          <div className="py-0.5 border-r border-slate-200">Fri</div>
          <div className="py-0.5">Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr flex-1 bg-white text-[10px]">
          {Array.from({ length: totalCells }).map((_, cellIdx) => {
            const dayNum = cellIdx - startDayOfWeek + 1;
            const isValidDay = dayNum >= 1 && dayNum <= daysInMonth;
            
            const monthStr = String(monthNum).padStart(2, '0');
            const dayStr = String(dayNum).padStart(2, '0');
            const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
            
            const record = isValidDay ? records[dateStr] : null;

            return (
              <div 
                key={cellIdx}
                onClick={() => {
                  if (isValidDay) {
                    setActiveDateModal(dateStr);
                    if (record) {
                      setRecordType(record.type || 'VAC');
                      setRecordNotes(record.notes || '');
                    } else {
                      setRecordType('VAC');
                      setRecordHoursMinutes('8h');
                      setRecordNotes('');
                    }
                  }
                }}
                className={`min-h-[38px] p-0.5 border-r border-b border-slate-200 flex flex-col justify-start items-stretch cursor-pointer hover:bg-slate-50 transition-colors ${
                  !isValidDay ? 'bg-slate-100/50 cursor-default' : ''
                }`}
              >
                {isValidDay && (
                  <>
                    <span className="font-extrabold text-[10px] text-slate-800 leading-none mb-0.5">
                      {dayNum}
                    </span>
                    {record && (
                      <div 
                        className={`px-0.5 py-0.5 rounded-[2px] text-[8px] leading-tight text-center truncate uppercase shadow-2xs ${getBadgeStyle(record.type)}`}
                        title={`${record.label} ${record.notes ? `(${record.notes})` : ''}`}
                      >
                        {record.label}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      
      {/* Printable Modal Container */}
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[1280px] max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:m-0 print:p-0 print:overflow-visible">
        
        {/* Screen Controls Header (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 text-2xl">calendar_month</span>
            <div>
              <h2 className="font-bold text-base text-white">Employee Attendance Calendar</h2>
              <p className="text-xs text-slate-400">View and print 12-month absentee ledger for {employeeName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              {[2025, 2026, 2027].map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                    selectedYear === yr ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Print or Save as PDF"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print to PDF
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Printable Content Section */}
        <div id="printable-attendance-calendar" className="p-4 md:p-6 bg-white flex flex-col gap-3 font-sans text-slate-900 overflow-y-auto flex-1 print:overflow-visible print:p-2">
          
          {/* Top Banner Header */}
          <div className="flex items-end justify-between border-b-2 border-slate-900 pb-1.5">
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">ABSENTEE CALENDAR</h1>
              <p className="text-[10px] font-semibold text-slate-500">Updated: {new Date().toLocaleDateString('en-US')}</p>
            </div>
            <div className="text-right">
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">AFM DEPARTMENT OF ADULT AND FAMILY MEDICINE</span>
            </div>
          </div>

          {/* Employee & Leave Metadata Grid */}
          <div className="border border-slate-900 rounded-xs overflow-hidden text-xs bg-white font-medium">
            <div className="grid grid-cols-6 border-b border-slate-900 divide-x divide-slate-900 bg-slate-50/50">
              <div className="p-1.5 flex items-center gap-1">
                <span className="font-bold">Year:</span>
                <span className="font-mono font-bold text-blue-900">{selectedYear}</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">Unit:</span>
                <span>{clinicName}</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-3 bg-yellow-100/70">
                <span className="font-bold">Employee Name:</span>
                <span className="font-extrabold text-slate-900 uppercase">{employeeName}</span>
              </div>
            </div>

            <div className="grid grid-cols-6 border-b border-slate-900 divide-x divide-slate-900">
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">Employee #:</span>
                <span className="font-mono">{employeeCode}</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">Seniority Date:</span>
                <span>{seniorityDateStr}</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">CESLA Usage:</span>
                <span className="font-mono">0.00 Hours</span>
              </div>
            </div>

            <div className="grid grid-cols-6 divide-x divide-slate-900 bg-slate-50/50">
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">FMLA On-File:</span>
                <span>No</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">Frequency/Duration:</span>
                <span>N/A</span>
              </div>
              <div className="p-1.5 flex items-center gap-1 col-span-2">
                <span className="font-bold">FMLA Usage:</span>
                <span className="font-mono">0.00 Hours</span>
              </div>
            </div>
          </div>

          {/* 12 Month Grid (3 cols x 4 rows) */}
          <div className="grid grid-cols-3 gap-2.5 my-1">
            {Array.from({ length: 12 }).map((_, idx) => renderMonthBox(idx))}
          </div>

          {/* Bottom Legend Bar */}
          <div className="border border-slate-900 rounded-xs p-1.5 bg-slate-50 flex flex-col gap-1 text-[10px]">
            <span className="font-black text-slate-900 uppercase tracking-wider text-[9px]">LEGEND</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-[2px] bg-emerald-500 text-white font-black uppercase text-[9px] border border-emerald-600">VACATION</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-rose-600 text-white font-black uppercase text-[9px] border border-rose-700">SICK/BANKED</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-amber-400 text-amber-950 font-black uppercase text-[9px] border border-amber-500">CESLA/FMLA/PSL</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-cyan-400 text-cyan-950 font-black uppercase text-[9px] border border-cyan-500">TARDY</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-blue-600 text-white font-black uppercase text-[9px] border border-blue-700">HOLIDAY</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-purple-600 text-white font-black uppercase text-[9px] border border-purple-700">PAY DAY</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-slate-600 text-white font-black uppercase text-[9px] border border-slate-700">LOA</span>
              <span className="px-2 py-0.5 rounded-[2px] bg-indigo-600 text-white font-black uppercase text-[9px] border border-indigo-700">EDUCATION DAY</span>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Add / Edit Attendance Record Modal */}
      {activeDateModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Log Attendance Record for {activeDateModal}</h3>
              <button onClick={() => setActiveDateModal(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveQuickRecord} className="p-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Record Type</label>
                <select
                  value={recordType}
                  onChange={e => setRecordType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VAC">Vacation (VAC)</option>
                  <option value="SCK">Sick / Banked (SCK)</option>
                  <option value="SCL">Sick Leave (SCL)</option>
                  <option value="CES">CESLA / FMLA (CES)</option>
                  <option value="TDT">Tardy (TDT)</option>
                  <option value="TWK">Tardy / Late Work (TWK)</option>
                  <option value="HOL">Holiday (HOL)</option>
                  <option value="LOA">Leave of Absence (LOA)</option>
                  <option value="EDU">Education Day (EDU)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Duration / Label (e.g. 8h, 15m, 2h)</label>
                <input
                  type="text"
                  value={recordHoursMinutes}
                  onChange={e => setRecordHoursMinutes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 8h, 15m, 2.5h"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes (Optional)</label>
                <textarea
                  value={recordNotes}
                  onChange={e => setRecordNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  placeholder="Additional attendance details..."
                ></textarea>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                {records[activeDateModal] ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(activeDateModal)}
                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg font-bold transition-colors"
                  >
                    Delete Record
                  </button>
                ) : <div></div>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDateModal(null)}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRecord}
                    className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    {savingRecord ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Native Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-attendance-calendar, #printable-attendance-calendar * {
            visibility: visible !important;
          }
          #printable-attendance-calendar {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          @page {
            size: portrait;
            margin: 0.3in;
          }
        }
      `}</style>
    </div>
  );
}
