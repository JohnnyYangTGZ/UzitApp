import React, { useState, useRef, useEffect } from 'react';

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default empty schedule (all days false)
export const DEFAULT_PATTERN = Array(14).fill(false);

export default function ScheduleSelector({ pattern, onChange, readonly }) {
  const [activePopover, setActivePopover] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const popoverRef = useRef(null);

  const safePattern = pattern || DEFAULT_PATTERN;

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setActivePopover(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDayClick = (idx) => {
    if (readonly) return;
    setActivePopover(idx);
    
    const val = safePattern[idx];
    if (typeof val === 'string') {
      const parts = val.split('-');
      setStartTime(parts[0] || '');
      setEndTime(parts[1] || '');
    } else {
      setStartTime('');
      setEndTime('');
    }
  };

  const setDayValue = (idx, value) => {
    const newPattern = [...safePattern];
    newPattern[idx] = value;
    onChange(newPattern);
    if (value === false || value === true) {
      setActivePopover(null);
    }
  };

  const handleCustomTimeSubmit = (idx) => {
    if (startTime && endTime) {
      setDayValue(idx, `${startTime}-${endTime}`);
      setActivePopover(null);
    }
  };

  const renderDayButton = (idx, dayName) => {
    const val = safePattern[idx];
    const isCustom = typeof val === 'string';
    const isWorking = val !== false && val !== null;
    
    // Format custom time for tiny display (e.g., "08:00-17:00" -> "08-17" or "Cstm")
    let display = dayName[0];
    if (isCustom) {
      display = '★'; // Just a star to indicate custom, since text is too small
    }

    return (
      <div key={`day-${idx}`} className="relative">
        <button
          type="button"
          disabled={readonly}
          onClick={() => handleDayClick(idx)}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            isWorking
              ? isCustom
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 ring-offset-1'
                : 'bg-blue-600 text-white shadow-sm'
              : readonly 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600'
          }`}
          title={isCustom ? `Custom Shift: ${val}` : isWorking ? 'Default Shift' : 'Off'}
        >
          {display}
        </button>

        {activePopover === idx && (
          <div 
            ref={popoverRef}
            className={`absolute z-50 top-12 ${idx % 7 >= 3 ? 'right-0' : 'left-0'} bg-white rounded-lg shadow-xl border border-slate-200 p-3 w-56 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150`}
          >
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
              {dayName} Shift
            </div>
            <button
              type="button"
              onClick={() => setDayValue(idx, true)}
              className="w-full text-left px-3 py-2 text-sm font-semibold rounded hover:bg-blue-50 text-blue-700 transition-colors"
            >
              Default Shift
            </button>
            <button
              type="button"
              onClick={() => setDayValue(idx, false)}
              className="w-full text-left px-3 py-2 text-sm font-semibold rounded hover:bg-slate-100 text-slate-600 transition-colors"
            >
              Off (Not Working)
            </button>
            <div className="h-px bg-slate-200 my-1"></div>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Custom Time</span>
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">Start</label>
                  <input
                    type="time"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">End</label>
                  <input
                    type="time"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!startTime || !endTime}
                onClick={() => handleCustomTimeSubmit(idx)}
                className="mt-1 w-full bg-indigo-600 disabled:bg-indigo-300 hover:bg-indigo-700 text-white rounded py-1.5 text-xs font-semibold flex items-center justify-center transition-colors"
              >
                Apply Custom Time
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Week 1 */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-400 w-6">W1</span>
        <div className="flex gap-2 relative">
          {DAYS.map((day, i) => renderDayButton(i, day))}
        </div>
      </div>
      {/* Week 2 */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-400 w-6">W2</span>
        <div className="flex gap-2 relative">
          {DAYS.map((day, i) => renderDayButton(i + 7, day))}
        </div>
      </div>
    </div>
  );
}
