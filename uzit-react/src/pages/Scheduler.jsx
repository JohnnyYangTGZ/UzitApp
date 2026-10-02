import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import { useNavigate, useLocation } from 'react-router-dom';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10));
  d.setMinutes(parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Hardcoded Anchor Date: December 14, 2025 (A Sunday)
// This is Pay Period #1
const ANCHOR_DATE = new Date(2025, 11, 14); // Month is 0-indexed in JS (11 = December)

const getCycleDayIndex = (dateObj) => {
  const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const utcAnchor = Date.UTC(ANCHOR_DATE.getFullYear(), ANCHOR_DATE.getMonth(), ANCHOR_DATE.getDate());
  const diffDays = Math.round((utcDate - utcAnchor) / (1000 * 60 * 60 * 24));
  return ((diffDays % 14) + 14) % 14;
};

const getCycleDayLabel = (index) => {
  const week = index < 7 ? 1 : 2;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[index % 7];
  return `W${week} ${dayName.substring(0, 3)}`;
};

const getWeekDays = (dateStr) => {
  if (!dateStr) return [];
  const [y, m, d] = dateStr.split('-');
  const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  
  const dayOfWeek = targetDate.getDay();
  const startOfWeek = new Date(targetDate);
  startOfWeek.setDate(targetDate.getDate() - dayOfWeek);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    week.push(d);
  }
  return week;
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
        if(t==='true'||t==='t') return true;
        if(t==='false'||t==='f') return false;
        if(t==='null'||t==='undefined') return null;
        return t.replace(/^"|"$/g, '');
      });
    }
  }
  if (typeof pattern === 'object' && !Array.isArray(pattern)) {
     return Object.keys(pattern).sort((a,b)=>Number(a)-Number(b)).map(k => pattern[k]);
  }
  return null;
};

const normalizeTimeString = (tStr) => {
  if (!tStr) return '';
  let str = String(tStr).trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  str = str.replace(/AM|PM/g, '').trim();
  const parts = str.split(':');
  let h = parseInt(parts[0], 10);
  let m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return '';
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  if (!isAM && !isPM && h >= 1 && h <= 6) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const normalizeTimeRange = (rangeStr) => {
  if (!rangeStr) return '';
  let str = String(rangeStr).trim();
  str = str.replace(/[–—]/g, '-').replace(/\s+to\s+/gi, '-');
  if (str.includes('-')) {
    const parts = str.split('-');
    const s = normalizeTimeString(parts[0]);
    const e = normalizeTimeString(parts[1]);
    if (s && e) return `${s}-${e}`;
  }
  return str;
};

const isTruthyVal = (val) => {
  if (!val) return false;
  if (val === true || val === 1 || val === '1' || val === 't' || val === 'true') return true;
  if (typeof val === 'string' && val.trim().length > 0 && val !== 'false') return true;
  return false;
};

const formatLocalDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const checkShiftTimeCompatibility = (empVal, empShiftTime, shiftVal, shift) => {
  if (!shift) return true;

  let empTime = '';
  if (typeof empVal === 'string' && empVal.includes('-')) {
    empTime = normalizeTimeRange(empVal);
  } else if (isTruthyVal(empVal) && empShiftTime && String(empShiftTime).toLowerCase() !== 'variable') {
    empTime = normalizeTimeRange(empShiftTime);
  }

  // If employee has no standard shift time set (e.g. Variable/Flexible), they can work any shift
  if (!empTime) return true;

  // Determine target shift time: prioritize explicit start_time & end_time
  let shiftTime = '';
  if (shift.start_time && shift.end_time) {
    shiftTime = normalizeTimeRange(`${shift.start_time}-${shift.end_time}`);
  } else if (shift.time_block && shift.time_block.includes('-')) {
    shiftTime = normalizeTimeRange(shift.time_block);
  } else if (typeof shiftVal === 'string' && shiftVal.includes('-')) {
    shiftTime = normalizeTimeRange(shiftVal);
  } else {
    // Check schedule pattern array for time strings
    let shiftPattern = parsePattern(shift.schedule_pattern);
    if (Array.isArray(shiftPattern)) {
      const times = shiftPattern.filter(x => typeof x === 'string' && x.includes('-')).map(normalizeTimeRange);
      if (times.length > 0) {
        return times.includes(empTime);
      }
    }
  }

  // If shift has a specific target time, employee time MUST match
  if (shiftTime) {
    return empTime === shiftTime;
  }

  return true;
};

const CoverageCell = ({ 
  reqCount, 
  employees, 
  isActive, 
  shiftTime, 
  shiftRole, 
  shiftCustomId, 
  dateObj, 
  draggedItem, 
  availableCandidates, 
  onAssign, 
  onRemoveAssign, 
  onRoleMismatch,
  onDragAssignedStart 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [candidateToConfirm, setCandidateToConfirm] = useState(null);
  const dropdownRef = useRef(null);

  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setCandidateToConfirm(null);
        setShowTimeEdit(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10));
    d.setMinutes(parseInt(m, 10));
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formattedShiftTime = shiftTime 
    ? shiftTime.split('-').map(t => formatTime(t)).join(' - ') 
    : null;

  const isRoleCompatible = (item, requiredRole) => {
    if (!item || !requiredRole) return true;
    const primary = (item.staffingRole || item.staffing_role || '').toUpperCase().trim();
    const target = (requiredRole || '').toUpperCase().trim();
    if (primary === target) return true;
    if (Array.isArray(item.secondaryRoles || item.secondary_roles)) {
      const sec = item.secondaryRoles || item.secondary_roles;
      return sec.some(r => (r || '').toUpperCase().trim() === target);
    }
    return false;
  };

  const compatible = draggedItem ? isRoleCompatible(draggedItem, shiftRole) : true;

  const handleDragOver = (e) => {
    e.preventDefault();
    if (isActive) {
      e.dataTransfer.dropEffect = compatible ? 'copy' : 'none';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isActive) return;

    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.userId) {
          // Verify role compatibility
          const allowed = isRoleCompatible(data, shiftRole);
          if (!allowed) {
            if (onRoleMismatch) {
              onRoleMismatch(data.userName, data.staffingRole, shiftRole);
            }
            return;
          }

          let customS = null;
          let customE = null;
          if (shiftTime && shiftTime.includes('-')) {
            const [s, eTime] = shiftTime.split('-');
            customS = s.trim().slice(0, 5);
            customE = eTime.trim().slice(0, 5);
          }
          onAssign({ user_id: data.userId, users: { name: data.userName } }, customS, customE);
        }
      }
    } catch (err) {
      console.error('Failed to parse drag drop data:', err);
    }
  };

  if (!isActive) {
    return (
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="h-full min-h-[80px] flex items-center justify-center bg-slate-50/50 rounded"
      >
        <span className="text-xs font-bold text-slate-400 tracking-wider">OFF</span>
      </div>
    );
  }

  const handleSelectCandidate = (cand) => {
    setCandidateToConfirm(cand);
    setShowTimeEdit(false);
    if (shiftTime && shiftTime.includes('-')) {
      const [s, e] = shiftTime.split('-');
      setCustomStart(s.slice(0, 5));
      setCustomEnd(e.slice(0, 5));
    } else {
      setCustomStart('09:00');
      setCustomEnd('17:00');
    }
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  };

  const formatMinutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const d = new Date();
    d.setHours(h, m, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const uncoveredIntervals = [];
  if (shiftTime && shiftTime.includes('-')) {
    const [shiftStartStr, shiftEndStr] = shiftTime.split('-');
    const shiftStart = timeToMinutes(shiftStartStr);
    const shiftEnd = timeToMinutes(shiftEndStr);
    
    const coverage = new Array(Math.max(0, shiftEnd - shiftStart)).fill(0);
    
    (employees || []).forEach(emp => {
      let empStart = shiftStart;
      let empEnd = shiftEnd;
      
      if (emp.custom_start_time) empStart = Math.max(shiftStart, timeToMinutes(emp.custom_start_time));
      if (emp.custom_end_time) empEnd = Math.min(shiftEnd, timeToMinutes(emp.custom_end_time));
      
      for (let i = empStart; i < empEnd; i++) {
        if (i >= shiftStart && i < shiftEnd) {
          coverage[i - shiftStart]++;
        }
      }
      
      if (emp.partialTimeOffs) {
        emp.partialTimeOffs.forEach(pt => {
          const ptStart = Math.max(shiftStart, timeToMinutes(pt.start_time));
          const ptEnd = Math.min(shiftEnd, timeToMinutes(pt.end_time));
          for (let i = ptStart; i < ptEnd; i++) {
            if (i >= shiftStart && i < shiftEnd && i >= empStart && i < empEnd) {
                 coverage[i - shiftStart]--;
            }
          }
        });
      }
    });
    
    for (let depth = 1; depth <= (reqCount || 1); depth++) {
       let gapStart = null;
       for (let i = 0; i < coverage.length; i++) {
         if (coverage[i] < depth) {
           if (gapStart === null) gapStart = i;
         } else {
           if (gapStart !== null) {
             uncoveredIntervals.push({ start: shiftStart + gapStart, end: shiftStart + i });
             gapStart = null;
           }
         }
       }
       if (gapStart !== null) {
         uncoveredIntervals.push({ start: shiftStart + gapStart, end: shiftEnd });
       }
    }
  } else {
    const filledCount = employees?.length || 0;
    const missingCount = Math.max(0, reqCount - filledCount);
    for (let i = 0; i < missingCount; i++) {
      uncoveredIntervals.push({ start: null, end: null, isFull: true });
    }
  }
  const hasCandidates = availableCandidates && availableCandidates.length > 0;

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col gap-2 h-full min-h-[80px] relative p-1 rounded-lg transition-all ${
        isDragOver 
          ? compatible
            ? 'bg-blue-50/95 border-2 border-dashed border-blue-500 ring-4 ring-blue-100/60 scale-[0.99] shadow-inner'
            : 'bg-rose-50/95 border-2 border-dashed border-rose-500 ring-4 ring-rose-100/60 scale-[0.99] shadow-inner'
          : 'border border-transparent'
      }`}
    >
      {isDragOver && (
        <div className={`absolute inset-0 text-white rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 z-30 shadow-xl backdrop-blur-sm pointer-events-none select-none ${
          compatible ? 'bg-blue-600/90' : 'bg-rose-600/90'
        }`}>
          <span className="material-symbols-outlined text-2xl animate-bounce pointer-events-none">
            {compatible ? 'person_add' : 'block'}
          </span>
          <span className="text-center px-1 pointer-events-none">
            {compatible ? 'Drop to Assign' : `Role Mismatch (Requires ${shiftRole})`}
          </span>
        </div>
      )}
      {hasCandidates && (
        <div ref={dropdownRef} className="absolute top-0 right-0 z-20">
          {showDropdown && (
            <div className="absolute right-0 top-6 w-56 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-30">
              <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">person_add</span>
                <span className="font-bold text-xs text-emerald-800">Available Staff</span>
              </div>
              
              {candidateToConfirm ? (
                (() => {
                  const isAdditional = candidateToConfirm.alreadyAssignedShifts && candidateToConfirm.alreadyAssignedShifts.length > 0;
                  const isDefaultOverride = !isAdditional && candidateToConfirm.isTimeMismatch;

                  let overrideTitle = 'Confirm Assignment';
                  let overrideBadgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                  let overrideIcon = 'person_add';
                  let overrideMsg = `Assign ${candidateToConfirm.users?.name} to ${shiftCustomId}?`;
                  let confirmBtnText = 'Confirm';

                  if (isAdditional) {
                    overrideTitle = 'Additional Shift Override';
                    overrideBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                    overrideIcon = 'warning';
                    const shiftsList = candidateToConfirm.alreadyAssignedShifts.join(', ');
                    overrideMsg = `${candidateToConfirm.users?.name} is already assigned to ${shiftsList} today. Assign to additional shift (${shiftCustomId})?`;
                    confirmBtnText = 'Confirm Additional Shift';
                  } else if (isDefaultOverride) {
                    overrideTitle = 'Default Shift Override';
                    overrideBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                    overrideIcon = 'edit_calendar';
                    const empShift = candidateToConfirm.shift_time || 'flexible';
                    overrideMsg = `${candidateToConfirm.users?.name}'s standard shift (${empShift}) differs from ${shiftCustomId}. Override default shift and assign?`;
                    confirmBtnText = 'Confirm Shift Override';
                  }

                  return (
                    <div className="p-3 bg-slate-50 flex flex-col gap-2">
                      <div className={`px-2 py-1 rounded border text-[11px] font-bold flex items-center gap-1.5 ${overrideBadgeClass}`}>
                        <span className="material-symbols-outlined text-[13px]">{overrideIcon}</span>
                        {overrideTitle}
                      </div>

                      <p className="text-xs text-slate-700 leading-tight">
                        {overrideMsg}
                      </p>

                      <button 
                        onClick={() => setShowTimeEdit(!showTimeEdit)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 w-fit mt-1"
                      >
                        <span className="material-symbols-outlined text-[12px]">{showTimeEdit ? 'expand_less' : 'edit'}</span>
                        {showTimeEdit ? 'Hide Time Options' : 'Edit Time (Partial Shift)'}
                      </button>

                      {showTimeEdit && (
                        <div className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 mt-1">
                          <input 
                            type="time" 
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full text-xs p-1 border border-slate-300 rounded focus:border-blue-500 outline-none" 
                          />
                          <span className="text-xs text-slate-400">-</span>
                          <input 
                            type="time" 
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full text-xs p-1 border border-slate-300 rounded focus:border-blue-500 outline-none" 
                          />
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => {
                            setCandidateToConfirm(null);
                            setShowTimeEdit(false);
                          }}
                          className="flex-1 px-2 py-1.5 bg-white border border-slate-300 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            if (onAssign) onAssign(candidateToConfirm, customStart, customEnd);
                            setShowDropdown(false);
                            setCandidateToConfirm(null);
                            setShowTimeEdit(false);
                          }}
                          className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors shadow-sm text-center leading-tight"
                        >
                          {confirmBtnText}
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="max-h-48 overflow-y-auto py-1">
                  {availableCandidates.map((cand, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setCandidateToConfirm(cand)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between group border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {cand.users?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                            {cand.users?.name}
                          </span>
                          {cand.alreadyAssignedShifts && cand.alreadyAssignedShifts.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-600 truncate">
                              Assigned to {cand.alreadyAssignedShifts[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      {cand.alreadyAssignedShifts && cand.alreadyAssignedShifts.length > 0 ? (
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                          +Shift
                        </span>
                      ) : cand.isTimeMismatch ? (
                        <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                          Override
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {shiftTime && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded w-fit border border-amber-200 shadow-sm" title="Shift Time">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {formattedShiftTime}
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        {/* Filled Slots */}
        {employees && employees.map((emp, empIdx) => {
          const isPartial = emp.partialTimeOffs && emp.partialTimeOffs.length > 0;
          return (
            <div 
              key={empIdx} 
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', JSON.stringify({
                  type: 'ASSIGNED_EMPLOYEE',
                  userId: emp.user_id,
                  userName: emp.users?.name,
                  shiftCustomId,
                  dateObjStr: dateObj ? (typeof dateObj === 'string' ? dateObj : dateObj.toISOString()) : ''
                }));
                e.dataTransfer.effectAllowed = 'move';
                if (onDragAssignedStart) onDragAssignedStart(emp, shiftCustomId, dateObj);
              }}
              onDragEnd={() => {
                if (onDragAssignedStart) onDragAssignedStart(null, null, null);
              }}
              className={`flex flex-col gap-1 p-1.5 rounded shadow-sm border transition-all cursor-grab active:cursor-grabbing group ${
                isPartial ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
              }`}
              title="Drag out to Staff Pool or click × to remove assignment"
            >
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${isPartial ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {emp.users?.name?.charAt(0) || '?'}
                </div>
                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                  <span className={`font-semibold text-xs truncate ${isPartial ? 'text-amber-800' : 'text-slate-700'}`} title={emp.users?.name}>
                    {emp.users?.name}
                  </span>
                  {(emp.custom_start_time || emp.custom_end_time) && (
                    <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                      {formatTime(emp.custom_start_time)} - {formatTime(emp.custom_end_time)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveAssign) onRemoveAssign(emp.user_id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded"
                  title="Remove shift assignment"
                >
                  <span className="material-symbols-outlined text-[13px] block">close</span>
                </button>
              </div>
              {isPartial && emp.partialTimeOffs.map((pt, i) => (
                <div key={i} className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 w-fit flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">beach_access</span>
                  Off: {formatTime(pt.start_time)} - {formatTime(pt.end_time)}
                </div>
              ))}
            </div>
          );
        })}

        {/* Unfilled Slots */}
        {uncoveredIntervals.map((interval, missingIdx) => {
          const isFull = interval.isFull || (shiftTime && shiftTime.includes('-') && interval.start === timeToMinutes(shiftTime.split('-')[0]) && interval.end === timeToMinutes(shiftTime.split('-')[1]));
          return (
            <div 
              key={`missing-${missingIdx}`} 
              onClick={() => {
                setShowDropdown(!showDropdown);
                setCandidateToConfirm(null);
                setShowTimeEdit(false);
              }}
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 border-dashed p-1.5 rounded cursor-pointer hover:bg-rose-100/70 hover:border-rose-300 transition-all group/slot"
              title="Click to select staff for this unfilled slot"
            >
              <span className="material-symbols-outlined text-[14px] text-rose-500 group-hover/slot:scale-110 transition-transform">add_circle</span>
              <span className="font-semibold text-rose-700 text-xs italic">
                {isFull ? 'Unfilled Slot' : `Unfilled: ${formatMinutesToTime(interval.start)} - ${formatMinutesToTime(interval.end)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Scheduler() {
  const { selectedClinicId, clinics, selectedDepartmentId } = useLocationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('view') === 'employees' ? 'employees' : 'shifts';
  
  const setActiveTab = (tab) => {
    navigate(`/scheduler?view=${tab}`, { replace: true });
  };
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Default to today's date
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const shiftWeek = (days) => {
    const [y, m, d] = selectedDate.split('-');
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    current.setDate(current.getDate() + days);
    setSelectedDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  };

  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  // assignments is now a map: shift.id -> array of 7 days
  const [weeklyAssignments, setWeeklyAssignments] = useState({});
  const [employeeAssignments, setEmployeeAssignments] = useState({});
  const [weekDates, setWeekDates] = useState([]);
  const [weeklyTimeOffData, setWeeklyTimeOffData] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [mobileDayIdx, setMobileDayIdx] = useState(0);

  useEffect(() => {
    if (selectedDate && weekDates.length === 7) {
      const [y, m, d] = selectedDate.split('-');
      const target = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const dayOfWeek = target.getDay();
      setMobileDayIdx(dayOfWeek);
    }
  }, [selectedDate, weekDates]);

  // Drag & Drop / Sidebar States
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchPool, setSearchPool] = useState('');
  const [rolePoolFilter, setRolePoolFilter] = useState('All');
  const [toast, setToast] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [isPoolDragOver, setIsPoolDragOver] = useState(false);

  // Schedule Publishing & Notification Framework States
  const [publishStatus, setPublishStatus] = useState('draft'); // 'draft' | 'published'
  const [publishedMeta, setPublishedMeta] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [publishedConfirmModal, setPublishedConfirmModal] = useState({
    isOpen: false,
    actionType: null,
    actionPayload: null,
    employeeName: '',
    shiftName: '',
    dateStr: ''
  });

  const executeConfirmedPublishedAction = () => {
    if (!publishedConfirmModal.actionPayload) return;
    const { actionType, actionPayload } = publishedConfirmModal;
    setPublishedConfirmModal(prev => ({ ...prev, isOpen: false }));

    if (actionType === 'UNASSIGN') {
      handleRemoveAssignment(actionPayload.shiftCustomId, actionPayload.dateObj, actionPayload.userId, true);
    } else if (actionType === 'ASSIGN') {
      handleAssign(
        actionPayload.shiftCustomId,
        actionPayload.role,
        actionPayload.defaultStartTime,
        actionPayload.defaultEndTime,
        actionPayload.dateObj,
        actionPayload.userId,
        actionPayload.customStartTime,
        actionPayload.customEndTime,
        true
      );
    } else if (actionType === 'AUTO_GENERATE') {
      handleAutoGenerateSchedule(true);
    }
  };

  const handleAutoGenerateSchedule = async (isConfirmed = false) => {
    if (!selectedClinicId || weekDates.length === 0) return;

    if (publishStatus === 'published' && !isConfirmed) {
      setPublishedConfirmModal({
        isOpen: true,
        actionType: 'AUTO_GENERATE',
        actionPayload: {},
        employeeName: 'All Staff',
        shiftName: 'Auto-Generate Full Week Schedule',
        dateStr: selectedDate
      });
      return;
    }

    setAutoGenerating(true);
    let autoAssignedCount = 0;

    try {
      // 1. Purge incompatible DB assignments for the current week first
      if (weekDates.length > 0) {
        const startDateStr = weekDates[0].toISOString().split('T')[0];
        const endDateStr = weekDates[6].toISOString().split('T')[0];

        const { data: existingWeekShifts } = await supabase
          .from('shifts')
          .select('id, date, time_block, start_time, end_time, shift_assignments(id, user_id)')
          .eq('location_id', selectedClinicId)
          .gte('date', startDateStr)
          .lte('date', endDateStr);

        if (existingWeekShifts && existingWeekShifts.length > 0) {
          for (const s of existingWeekShifts) {
            const targetShiftDef = shifts.find(sh => sh.custom_id === s.time_block) || s;
            if (s.shift_assignments && s.shift_assignments.length > 0) {
              for (const sa of s.shift_assignments) {
                const emp = employees.find(e => e.user_id === sa.user_id);
                if (emp) {
                  const cycleIdx = getCycleDayIndex(new Date(s.date + 'T12:00:00Z'));
                  const empPattern = parsePattern(emp.schedule_pattern);
                  const empVal = empPattern && empPattern.length === 14 ? empPattern[cycleIdx] : false;
                  if (empVal === false || empVal === null || empVal === undefined || !checkShiftTimeCompatibility(empVal, emp.shift_time, null, targetShiftDef)) {
                    await supabase.from('shift_assignments').delete().eq('id', sa.id);
                  }
                }
              }
            }
          }
        }
      }

      for (const dateObj of weekDates) {
        const dateStr = dateObj.toISOString().split('T')[0];
        const cycleDayIndex = getCycleDayIndex(dateObj);
        const assignedUserIds = new Set();

        for (const shift of shifts) {
          // Check shift pattern
          let pattern = parsePattern(shift.schedule_pattern);
          const shiftVal = pattern && pattern.length === 14 ? pattern[cycleDayIndex] : false;
          const isActive = shiftVal !== false && shiftVal !== null && shiftVal !== undefined;

          if (!isActive) continue;

          // Find eligible employees
          const eligible = employees.filter(emp => {
            let empPattern = parsePattern(emp.schedule_pattern);
            if (!empPattern || empPattern.length !== 14) return false;
            const empVal = empPattern[cycleDayIndex];
            if (empVal === false || empVal === null || empVal === undefined) return false;

            // Must not be on approved time off on this date
            const isOnPTO = weeklyTimeOffData.some(t => t.user_id === emp.user_id && t.start_date <= dateStr && t.end_date >= dateStr);
            if (isOnPTO) return false;

            // Shift time matching
            if (!checkShiftTimeCompatibility(empVal, emp.shift_time, shiftVal, shift)) return false;

            // Role match
            const primaryRole = (emp.staffing_role || '').trim();
            const shiftRole = (shift.staffing_role || '').trim();
            const hasSecondary = Array.isArray(emp.secondary_roles) && emp.secondary_roles.includes(shiftRole);
            if (primaryRole !== shiftRole && !hasSecondary) return false;

            // Authorized clinic
            const authorizedClinics = emp.users?.employee_clinics?.map(ec => ec.locations?.id) || [];
            if (!authorizedClinics.includes(selectedClinicId)) return false;

            // Not already assigned
            if (assignedUserIds.has(emp.user_id)) return false;

            return true;
          });

          if (eligible.length > 0) {
            const needed = shift.required_count || 1;
            const toAssign = eligible.slice(0, needed);

            for (const emp of toAssign) {
              assignedUserIds.add(emp.user_id);

              // Check if a shift already exists in `shifts`
              let query = supabase
                .from('shifts')
                .select('id')
                .eq('location_id', selectedClinicId)
                .eq('date', dateStr)
                .eq('time_block', shift.custom_id);

              if (shift.start_time) query = query.eq('start_time', shift.start_time);
              if (shift.end_time) query = query.eq('end_time', shift.end_time);

              const { data: existingShifts } = await query.limit(1);
              let shiftId;

              if (existingShifts && existingShifts.length > 0) {
                shiftId = existingShifts[0].id;
              } else {
                const { data: newShift, error: shiftError } = await supabase
                  .from('shifts')
                  .insert({
                    location_id: selectedClinicId,
                    date: dateStr,
                    time_block: shift.custom_id,
                    start_time: shift.start_time,
                    end_time: shift.end_time,
                    staffing_role: shift.staffing_role
                  })
                  .select('id')
                  .single();

                if (shiftError) continue;
                shiftId = newShift.id;
              }

              // Insert shift assignment if not already assigned
              const { data: existingAssign } = await supabase
                .from('shift_assignments')
                .select('id')
                .eq('shift_id', shiftId)
                .eq('user_id', emp.user_id);

              if (!existingAssign || existingAssign.length === 0) {
                const { error: assignErr } = await supabase
                  .from('shift_assignments')
                  .insert({
                    shift_id: shiftId,
                    user_id: emp.user_id
                  });

                if (!assignErr) {
                  autoAssignedCount++;
                }
              }
            }
          }
        }
      }

      showToastNotification(`Successfully auto-generated ${autoAssignedCount} shift assignment(s) for the week!`, 'success');
      loadData();
    } catch (err) {
      console.error('Auto-generate error:', err);
      showToastNotification(`Auto-generation error: ${err.message}`, 'error');
    } finally {
      setAutoGenerating(false);
    }
  };

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setIsPoolDragOver(false);
      setDraggedItem(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('mouseup', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('mouseup', handleGlobalDragEnd);
    };
  }, []);

  const showToastNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  const triggerScheduleChangeNotification = async ({ userId, action, shiftCustomId, dateStr }) => {
    const emp = employees.find(e => e.user_id === userId);
    const empName = emp?.users?.name || 'Staff';
    const clinicNameStr = clinics.find(c => c.id === selectedClinicId)?.name || 'Clinic';

    const msg = action === 'ASSIGNED' 
      ? `Schedule Update: Assigned to ${shiftCustomId} on ${dateStr}`
      : `Schedule Update: Unassigned from ${shiftCustomId} on ${dateStr}`;

    console.log(`[NOTIFICATION DISPATCH] ${msg} for user ${userId}`);

    try {
      await supabase.from('audit_logs').insert([{
        action_type: 'SCHEDULE_CHANGE',
        target_type: 'shift_assignment',
        metadata: {
          userId,
          userName: empName,
          action,
          shiftCustomId,
          dateStr,
          message: msg,
          clinicName: clinicNameStr,
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
        action,
        shiftCustomId,
        dateStr,
        message: msg,
        timestamp: new Date().toISOString()
      };
      existing.unshift(newNotif);
      localStorage.setItem(storageKey, JSON.stringify(existing.slice(0, 20)));
    } catch(e) {}
  };

  const getWeekStartStr = (dateStr) => {
    const weekDays = getWeekDays(dateStr);
    if (weekDays && weekDays.length > 0) {
      return weekDays[0].toISOString().split('T')[0];
    }
    return dateStr;
  };

  const handleUnpublishSchedule = async () => {
    try {
      setLoading(true);
      // Clear all schedule publication entries from localStorage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('schedule_pub_')) {
          localStorage.removeItem(key);
        }
      }

      try {
        await supabase
          .from('schedule_publications')
          .delete()
          .neq('status', 'nonexistent_status_to_delete_all');
      } catch (e) {}

      setPublishStatus('draft');
      setPublishedMeta(null);
      showToastNotification('Schedules have been unpublished and reset to Draft status!', 'info');
    } catch (err) {
      console.error('Unpublish error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicationStatus = async (clinicId, dateStr) => {
    if (!clinicId || !dateStr) return;
    const weekStart = getWeekStartStr(dateStr);
    const localKey = `schedule_pub_${clinicId}_${weekStart}`;
    
    try {
      localStorage.removeItem(localKey);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('schedule_pub_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}

    setPublishStatus('draft');
    setPublishedMeta(null);
  };

  const handleExecutePublish = async () => {
    if (!selectedClinicId) return;
    const weekStart = getWeekStartStr(selectedDate);
    const localKey = `schedule_pub_${selectedClinicId}_${weekStart}`;
    
    setPublishing(true);
    try {
      const payload = {
        location_id: selectedClinicId,
        week_start_date: weekStart,
        status: 'published',
        published_at: new Date().toISOString(),
      };

      localStorage.setItem(localKey, JSON.stringify(payload));
      setPublishStatus('published');
      setPublishedMeta(payload);

      const { data, error } = await supabase
        .from('schedule_publications')
        .upsert(payload, { onConflict: 'location_id,week_start_date' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Supabase table schedule_publications missing, fallback active:', error.message);
      } else if (data) {
        setPublishedMeta(data);
      }

      showToastNotification(`Schedule for week of ${weekStart} is now Published! All scheduled staff have been notified.`, 'success');
      console.log('[NOTIFICATION FRAMEWORK] Triggering mass publish notification for week:', weekStart);
    } catch (err) {
      setPublishStatus('published');
      showToastNotification(`Schedule for week of ${weekStart} is now Published!`, 'success');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (selectedClinicId && selectedDate) {
      fetchPublicationStatus(selectedClinicId, selectedDate);
    }
  }, [selectedClinicId, selectedDate]);

  const clinicName = clinics.find(c => c.id === selectedClinicId)?.name || 'the selected clinic';

  const getExpectedWeeklyShiftsCount = (emp) => {
    if (!emp || !weekDates || weekDates.length === 0) return 0;
    const pattern = parsePattern(emp.schedule_pattern);
    if (!pattern || pattern.length !== 14) return 0;
    let count = 0;
    weekDates.forEach(dateObj => {
      const dateStr = formatLocalDate(dateObj);
      const isOnPTO = weeklyTimeOffData.some(t => t.user_id === emp.user_id && t.start_date <= dateStr && t.end_date >= dateStr);
      if (!isOnPTO) {
        const idx = getCycleDayIndex(dateObj);
        const val = pattern[idx];
        if (val !== false && val !== null && val !== undefined) {
          count++;
        }
      }
    });
    return count;
  };

  const getAssignedWeeklyShiftsCount = (emp) => {
    if (!emp) return 0;
    let count = 0;
    Object.values(weeklyAssignments).forEach(daysArr => {
      if (Array.isArray(daysArr)) {
        daysArr.forEach(day => {
          if (day && day.employees && Array.isArray(day.employees)) {
            if (day.employees.some(e => e.user_id === emp.user_id || e.id === emp.id || e.id === emp.user_id)) {
              count++;
            }
          }
        });
      }
    });
    return count;
  };

  const getShiftsRemainingCount = (emp) => {
    const expected = getExpectedWeeklyShiftsCount(emp);
    const assigned = getAssignedWeeklyShiftsCount(emp);
    return Math.max(0, expected - assigned);
  };

  const currentCycleDayIndex = selectedDate ? getCycleDayIndex(new Date(selectedDate + 'T12:00:00Z')) : 0;

  const isEmpScheduledToday = (emp) => {
    const pattern = parsePattern(emp.schedule_pattern);
    if (!pattern || pattern.length !== 14) return false;
    if (selectedDate) {
      const isOnPTO = weeklyTimeOffData.some(t => t.user_id === emp.user_id && t.start_date <= selectedDate && t.end_date >= selectedDate);
      if (isOnPTO) return false;
    }
    const dayVal = pattern[currentCycleDayIndex];
    return dayVal !== false && dayVal !== null && dayVal !== undefined;
  };

  const filteredPoolEmps = employees.filter(emp => {
    const expected = getExpectedWeeklyShiftsCount(emp);
    const assigned = getAssignedWeeklyShiftsCount(emp);

    if (expected > 0 && assigned >= expected) {
      return false;
    }
    if (expected === 0 && assigned > 0) {
      return false;
    }

    const nameMatch = (emp.users?.name || '').toLowerCase().includes(searchPool.toLowerCase());
    const roleMatch = rolePoolFilter === 'All' || emp.staffing_role === rolePoolFilter || (Array.isArray(emp.secondary_roles) && emp.secondary_roles.includes(rolePoolFilter));
    return nameMatch && roleMatch;
  }).sort((a, b) => {
    const aNeeded = isEmpScheduledToday(a);
    const bNeeded = isEmpScheduledToday(b);
    if (aNeeded && !bNeeded) return -1;
    if (!aNeeded && bNeeded) return 1;
    const aRem = getShiftsRemainingCount(a);
    const bRem = getShiftsRemainingCount(b);
    if (aRem > 0 && bRem === 0) return -1;
    if (aRem === 0 && bRem > 0) return 1;
    return (a.users?.name || '').localeCompare(b.users?.name || '');
  });

  const handleRemoveAssignment = async (shiftCustomId, dateObj, userId, isConfirmed = false) => {
    try {
      const dateStr = typeof dateObj === 'string' ? dateObj : dateObj.toISOString().split('T')[0];
      const unassignedEmp = employees.find(e => e.user_id === userId);
      const empName = unassignedEmp?.users?.name || 'Staff';

      if (publishStatus === 'published' && !isConfirmed) {
        setPublishedConfirmModal({
          isOpen: true,
          actionType: 'UNASSIGN',
          actionPayload: { shiftCustomId, dateObj, userId },
          employeeName: empName,
          shiftName: shiftCustomId,
          dateStr
        });
        return;
      }

      setLoading(true);

      const { data: shiftsFound } = await supabase
        .from('shifts')
        .select('id')
        .eq('location_id', selectedClinicId)
        .eq('date', dateStr)
        .eq('time_block', shiftCustomId);

      if (shiftsFound && shiftsFound.length > 0) {
        const shiftIds = shiftsFound.map(s => s.id);
        const { error } = await supabase
          .from('shift_assignments')
          .delete()
          .in('shift_id', shiftIds)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Create an explicit shift override record with 0 assignments to override automatic schedule pattern
        const targetShiftDef = shifts.find(s => s.custom_id === shiftCustomId);
        const { error: createError } = await supabase
          .from('shifts')
          .insert({
            location_id: selectedClinicId,
            date: dateStr,
            time_block: shiftCustomId,
            staffing_role: targetShiftDef?.staffing_role || 'STAFF',
            start_time: targetShiftDef?.start_time,
            end_time: targetShiftDef?.end_time
          });

        if (createError) throw createError;
      }

      showToastNotification(`Unassigned ${empName} from ${shiftCustomId}`, 'info');

      if (publishStatus === 'published') {
        triggerScheduleChangeNotification({ userId, action: 'UNASSIGNED', shiftCustomId, dateStr });
        showToastNotification(`Published schedule change: Unassigned ${empName} from ${shiftCustomId}. Employee notified!`, 'success');
      }

      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  const handleAssign = async (shiftCustomId, role, defaultStartTime, defaultEndTime, dateObj, userId, customStartTime, customEndTime, isConfirmed = false) => {
    try {
      const dateStr = typeof dateObj === 'string' ? dateObj : dateObj.toISOString().split('T')[0];
      const assignedEmp = employees.find(e => e.user_id === userId);
      const empName = assignedEmp?.users?.name || 'Staff';

      const isOnPTO = weeklyTimeOffData.some(t => t.user_id === userId && t.start_date <= dateStr && t.end_date >= dateStr);
      if (isOnPTO) {
        showToastNotification(`Cannot assign ${empName}: Employee has approved time off on ${dateStr}.`, 'error');
        return;
      }

      if (publishStatus === 'published' && !isConfirmed) {
        setPublishedConfirmModal({
          isOpen: true,
          actionType: 'ASSIGN',
          actionPayload: { shiftCustomId, role, defaultStartTime, defaultEndTime, dateObj, userId, customStartTime, customEndTime },
          employeeName: empName,
          shiftName: shiftCustomId,
          dateStr
        });
        return;
      }

      setLoading(true);
      const startTime = customStartTime || defaultStartTime;
      const endTime = customEndTime || defaultEndTime;

      // Check if a manual shift exists for this date, time_block AND exact start/end time
      let shiftId;
      
      let query = supabase
        .from('shifts')
        .select('id')
        .eq('location_id', selectedClinicId)
        .eq('date', dateStr)
        .eq('time_block', shiftCustomId);
        
      if (startTime) query = query.eq('start_time', startTime);
      else query = query.is('start_time', null);
      
      if (endTime) query = query.eq('end_time', endTime);
      else query = query.is('end_time', null);

      const { data: existingShifts } = await query.limit(1);
      
      if (existingShifts && existingShifts.length > 0) {
        shiftId = existingShifts[0].id;
      } else {
        const { data: newShift, error: shiftError } = await supabase
          .from('shifts')
          .insert({
            location_id: selectedClinicId,
            date: dateStr,
            time_block: shiftCustomId,
            start_time: startTime,
            end_time: endTime,
            staffing_role: role
          })
          .select('id')
          .single();
        if (shiftError) throw shiftError;
        shiftId = newShift.id;
      }

      const { error: assignError } = await supabase
        .from('shift_assignments')
        .insert({
          shift_id: shiftId,
          user_id: userId
        });

      if (assignError) throw assignError;

      showToastNotification(`Successfully assigned ${empName} to ${shiftCustomId}`);

      if (publishStatus === 'published') {
        triggerScheduleChangeNotification({ userId, action: 'ASSIGNED', shiftCustomId, dateStr });
        showToastNotification(`Published schedule change: Assigned ${empName} to ${shiftCustomId}. Employee notified!`, 'success');
      }

      // Refresh data
      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClinicId && selectedDepartmentId) {
      loadData();
    } else {
      setShifts([]);
      setEmployees([]);
      setWeeklyAssignments({});
      setWeekDates([]);
      setLoading(false);
    }
  }, [selectedClinicId, selectedDepartmentId]);

  useEffect(() => {
    if (shifts.length > 0 || employees.length > 0) {
      fetchAdhocAndCalculate(shifts, employees);
    }
  }, [selectedDate, shifts, employees]);

  async function loadData() {
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch Shifts (Coverage Requirements)
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('coverage_requirements')
        .select('*')
        .eq('location_id', selectedClinicId)
        .order('custom_id', { ascending: true });

      if (shiftsError) throw shiftsError;

      // 2. Fetch Employees in the department
      const { data: empsData, error: empsError } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          user_id,
          employee_code,
          job_title,
          staffing_role,
          phone_number,
          shift_time,
          schedule_pattern,
          is_on_call,
          secondary_roles,
          users!employee_profiles_user_id_fkey!inner (
            id,
            name,
            email,
            employee_clinics (
              locations ( id, name )
            )
          )
        `)
        .eq('department_id', selectedDepartmentId);

      if (empsError) throw empsError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('staffing_roles')
        .select('name')
        .eq('department_id', selectedDepartmentId)
        .eq('is_active', true);

      if (rolesError) throw rolesError;
      setAvailableRoles(rolesData?.map(r => r.name).sort() || []);

      const schedulableEmployees = (empsData || []).filter(emp => {
        const role = (emp.staffing_role || emp.job_title || '').toUpperCase();
        return !role.includes('ADMIN') && !role.includes('MANAGER') && !role.includes('SYSTEM ADMINISTRATOR');
      });

      setShifts(shiftsData || []);
      setEmployees(schedulableEmployees);
      // fetchAdhocAndCalculate will be triggered by useEffect when states update

    } catch (err) {
      console.error('Error fetching data:', err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdhocAndCalculate(currentShifts, currentEmployees) {
    const currentWeekDates = getWeekDays(selectedDate);
    const startDate = currentWeekDates[0].toISOString().split('T')[0];
    const endDate = currentWeekDates[6].toISOString().split('T')[0];

    const { data: manualShiftsData } = await supabase
      .from('shifts')
      .select(`
        id, date, time_block, start_time, end_time, staffing_role,
        shift_assignments ( user_id )
      `)
      .eq('location_id', selectedClinicId)
      .gte('date', startDate)
      .lte('date', endDate);

    const { data: timeOffData } = await supabase
      .from('time_off_requests')
      .select('user_id, start_date, end_date, start_time, end_time')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    setWeeklyTimeOffData(timeOffData || []);

    const { data: availabilityData } = await supabase
      .from('employee_availability')
      .select('user_id, date, shift_time, notes')
      .lte('date', endDate)
      .gte('date', startDate);

    let extendedShifts = [...currentShifts];
    let templateOverrides = {}; 

    if (manualShiftsData && manualShiftsData.length > 0) {
      manualShiftsData.forEach(manual => {
        if (manual.time_block === 'AD-HOC') {
          const d = new Date(manual.date + 'T12:00:00Z');
          const cycleDayIndex = getCycleDayIndex(d);

          let pattern = Array(14).fill(false);
          pattern[cycleDayIndex] = true;

          extendedShifts.push({
            id: manual.id,
            custom_id: `AD-HOC ${manual.staffing_role || 'STAFF'}`,
            location_id: selectedClinicId,
            start_time: manual.start_time,
            end_time: manual.end_time,
            schedule_pattern: pattern,
            time_block: manual.time_block,
            day_type: 'WEEKDAY',
            staffing_role: manual.staffing_role || 'OTHER',
            required_count: 1,
            priority_weight: 0,
            _isAdhoc: true,
            _assignedUserId: manual.shift_assignments?.[0]?.user_id || null
          });
        } else {
          // Template override
          if (!templateOverrides[manual.time_block]) {
            templateOverrides[manual.time_block] = {};
          }
          if (!templateOverrides[manual.time_block][manual.date]) {
            templateOverrides[manual.time_block][manual.date] = [];
          }
          if (manual.shift_assignments && manual.shift_assignments.length > 0) {
            manual.shift_assignments.forEach(sa => {
              templateOverrides[manual.time_block][manual.date].push({
                user_id: sa.user_id,
                start_time: manual.start_time,
                end_time: manual.end_time
              });
            });
          }
        }
      });
    }

    calculateAssignments(extendedShifts, currentEmployees, currentWeekDates, timeOffData || [], templateOverrides, availabilityData || []);
  }

  function calculateAssignments(currentShifts, currentEmployees, currentWeekDates, timeOffData = [], templateOverrides = {}, availabilityData = []) {
    setWeekDates(currentWeekDates);

    const sortedShifts = [...currentShifts].sort((a, b) => {
      const aId = (a.custom_id || '').toUpperCase();
      const bId = (b.custom_id || '').toUpperCase();
      const aIsWkend = aId.includes('WKEND') || aId.includes('WEEKEND');
      const bIsWkend = bId.includes('WKEND') || bId.includes('WEEKEND');
      
      if (aIsWkend && !bIsWkend) return 1;
      if (!aIsWkend && bIsWkend) return -1;
      return aId.localeCompare(bId);
    });
    const newWeeklyAssignments = {};
    const newEmployeeAssignments = {};

    sortedShifts.forEach(shift => {
      newWeeklyAssignments[shift.id] = [];
    });

    currentEmployees.forEach(emp => {
      newEmployeeAssignments[emp.id] = {
        employee: emp,
        days: Array(7).fill().map(() => ({ isActive: false, isTimeOff: false, shifts: [] }))
      };
    });

    // Run engine for each of the 7 days
    currentWeekDates.forEach((dateObj, dayIndex) => {
      const cycleDayIndex = getCycleDayIndex(dateObj);
      const assignedEmployeeIds = new Set();

      // Update employee isActive state for this day
      currentEmployees.forEach(emp => {
        const dateStr = dateObj.toISOString().split('T')[0];
        const fullTimeOffs = timeOffData.filter(t => t.user_id === emp.user_id && t.start_date <= dateStr && t.end_date >= dateStr);
        const hasFullTimeOff = fullTimeOffs.length > 0;

        let pattern = parsePattern(emp.schedule_pattern);
        const val = pattern && pattern.length === 14 ? pattern[cycleDayIndex] : false;
        const isScheduled = val !== false && val !== null && val !== undefined;
        newEmployeeAssignments[emp.id].days[dayIndex].isActive = hasFullTimeOff ? false : isScheduled;
        newEmployeeAssignments[emp.id].days[dayIndex].isTimeOff = hasFullTimeOff;
      });

      sortedShifts.forEach(shift => {
        // Is this shift active on this day?
        let pattern = parsePattern(shift.schedule_pattern);
        const shiftVal = pattern && pattern.length === 14 ? pattern[cycleDayIndex] : false;
        const isActive = shiftVal !== false && shiftVal !== null && shiftVal !== undefined;

        if (!isActive) {
          newWeeklyAssignments[shift.id].push({ isActive: false, employees: [] });
          return;
        }

        const shiftTimeStr = typeof shiftVal === 'string'
          ? shiftVal.trim()
          : (shift.start_time && shift.end_time) 
            ? `${shift.start_time.slice(0,5)}-${shift.end_time.slice(0,5)}` 
            : shift.time_block;

        // Find eligible employees strictly from persisted database assignments or adhoc assignments.
        // Un-generated weeks default to BLANK until Auto-Generate Schedule is run or staff are manually assigned.
        let eligible = [];

        if (!shift._isAdhoc && templateOverrides && templateOverrides[shift.custom_id]) {
          const dateStr = formatLocalDate(dateObj);
          const overridenAssignments = templateOverrides[shift.custom_id][dateStr];
          if (overridenAssignments !== undefined) {
            if (overridenAssignments.length > 0) {
              const overridenUserIds = overridenAssignments.map(o => o.user_id);
              const overridenEmps = currentEmployees.filter(e => overridenUserIds.includes(e.user_id));
              eligible = overridenEmps.filter(e => {
                // Only filter out full-day PTO for forced/persisted assignments
                if (newEmployeeAssignments[e.id].days[dayIndex].isTimeOff) return false;
                return true;
              });
            } else {
              // Explicitly cleared / unassigned shift override!
              eligible = [];
            }
          }
        } else if (shift._isAdhoc && shift._assignedUserId) {
          const assignedAdhocEmp = currentEmployees.find(e => e.user_id === shift._assignedUserId);
          if (assignedAdhocEmp) {
            eligible = [assignedAdhocEmp];
          }
        }

        // Sort alphabetically by name
        eligible.sort((a, b) => (a.users?.name || '').localeCompare(b.users?.name || ''));

        const dateStr = formatLocalDate(dateObj);
        const shiftRole = (shift.staffing_role || '').trim();

        // Build a map of shifts assigned per user_id on this dateStr
        const assignedShiftsMapByEmp = {};
        if (templateOverrides) {
          Object.keys(templateOverrides).forEach(blockKey => {
            const dateDict = templateOverrides[blockKey];
            if (dateDict && dateDict[dateStr] && Array.isArray(dateDict[dateStr])) {
              dateDict[dateStr].forEach(item => {
                if (!assignedShiftsMapByEmp[item.user_id]) assignedShiftsMapByEmp[item.user_id] = [];
                if (!assignedShiftsMapByEmp[item.user_id].includes(blockKey)) {
                  assignedShiftsMapByEmp[item.user_id].push(blockKey);
                }
              });
            }
          });
        }

        let availableCandidates = currentEmployees.filter(emp => {
          // Must match role (primary or secondary)
          const primaryRole = (emp.staffing_role || '').trim();
          const hasSecondary = Array.isArray(emp.secondary_roles) && emp.secondary_roles.includes(shiftRole);
          if (primaryRole !== shiftRole && !hasSecondary) return false;

          // Must be authorized for clinic
          const authorizedClinics = emp.users?.employee_clinics?.map(ec => ec.locations?.id) || [];
          if (!authorizedClinics.includes(selectedClinicId)) return false;

          // Must not be on full-day PTO on this date
          if (newEmployeeAssignments[emp.id].days[dayIndex].isTimeOff) return false;

          // Exclude if ALREADY assigned to THIS exact shift custom_id on this date
          const currentShiftAssigned = assignedShiftsMapByEmp[emp.user_id] || [];
          if (currentShiftAssigned.includes(shift.custom_id)) return false;

          return true;
        }).map(emp => {
          const otherShifts = assignedShiftsMapByEmp[emp.user_id] || [];
          let empPattern = parsePattern(emp.schedule_pattern);
          const empVal = empPattern && empPattern.length === 14 ? empPattern[cycleDayIndex] : false;
          const isTimeMatch = checkShiftTimeCompatibility(empVal, emp.shift_time, shiftVal, shift);

          return {
            ...emp,
            alreadyAssignedShifts: otherShifts,
            isTimeMismatch: !isTimeMatch
          };
        });

        if (eligible.length > 0) {
          const needed = shift.required_count || 1;
          const assignedEmpsRaw = eligible.slice(0, needed);
          
          if (shift._isAdhoc && shift._assignedUserId) {
             const assignedAdhocEmp = eligible.find(e => e.user_id === shift._assignedUserId);
             if (assignedAdhocEmp) {
               assignedEmpsRaw.length = 0;
               assignedEmpsRaw.push(assignedAdhocEmp);
             }
          }

          const assignedEmps = assignedEmpsRaw.map(e => {
            const partials = timeOffData.filter(t => t.user_id === e.user_id && t.start_date <= dateStr && t.end_date >= dateStr && (t.start_time || t.end_time));
            
            let customTimes = {};
            if (!shift._isAdhoc && templateOverrides && templateOverrides[shift.custom_id] && templateOverrides[shift.custom_id][dateStr]) {
              const overrideData = templateOverrides[shift.custom_id][dateStr].find(o => o.user_id === e.user_id);
              if (overrideData) {
                customTimes = { custom_start_time: overrideData.start_time, custom_end_time: overrideData.end_time };
              }
            }

            return {
              ...e,
              ...customTimes,
              partialTimeOffs: partials
            };
          });
          
          const assignedIds = new Set(assignedEmps.map(e => e.id));
          availableCandidates = availableCandidates.filter(c => !assignedIds.has(c.id));

          newWeeklyAssignments[shift.id].push({ 
            isActive: true, 
            employees: assignedEmps,
            customTime: typeof dayVal === 'string' ? dayVal : null,
            availableCandidates
          });
          assignedEmps.forEach(e => {
            assignedEmployeeIds.add(e.id);
            if (newEmployeeAssignments[e.id]) {
              newEmployeeAssignments[e.id].days[dayIndex].shifts.push(shift);
            }
          });
        } else {
          newWeeklyAssignments[shift.id].push({ 
            isActive: true, 
            employees: [],
            customTime: typeof dayVal === 'string' ? dayVal : null,
            availableCandidates
          }); // Unfilled
        }
      });
    });

    setWeeklyAssignments(newWeeklyAssignments);
    setEmployeeAssignments(newEmployeeAssignments);
  }

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-3xl text-blue-600">calendar_month</span>
                <h1 className="font-h1 text-h1 text-on-surface">Schedule</h1>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Daily Schedule for {clinicName}
              </p>
            </div>

            <div className="h-10 w-px bg-slate-200"></div>

            {/* Role Filter */}
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Filter by Role</span>
              <select
                className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none shadow-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Select Date</span>
              <div className="flex items-center">
                <button 
                  onClick={() => shiftWeek(-7)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-l-lg border border-r-0 border-slate-300 transition-colors flex items-center justify-center bg-white"
                  title="Previous Week"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border-y border-slate-300 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-sm h-[34px] bg-white"
                />
                <button 
                  onClick={() => shiftWeek(7)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg border border-l-0 border-slate-300 transition-colors flex items-center justify-center bg-white"
                  title="Next Week"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Schedule Publication Status & Action */}
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Schedule Status</span>
              <div className="flex items-center gap-2">
                {publishStatus !== 'published' && (
                  <button
                    onClick={handleAutoGenerateSchedule}
                    disabled={autoGenerating}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-300 disabled:opacity-50"
                    title="Auto-generate schedule from 14-day templates"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    {autoGenerating ? 'Generating...' : 'Auto-Generate Schedule'}
                  </button>
                )}

                {publishStatus === 'published' ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Published
                  </span>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-300 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                      Draft
                    </span>

                    <button
                      onClick={() => setShowPublishModal(true)}
                      disabled={publishing}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600"
                      title="Publish schedule to staff"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      Publish Schedule
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
              <button 
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'shifts' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('shifts')}
              >
                By Shifts
              </button>
              <button 
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('employees')}
              >
                By Employees
              </button>
            </div>

            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-all ${
                showSidebar 
                  ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-sm' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title={showSidebar ? 'Hide Staff Pool' : 'Show Staff Pool'}
            >
              <span className="material-symbols-outlined text-sm">
                {showSidebar ? 'side_navigation' : 'group'}
              </span>
              {showSidebar ? 'Hide Staff Pool' : 'Staff Pool'}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg font-medium text-sm shrink-0">
            Error: {errorMsg}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
          {/* Left: Schedule Table / Mobile Card View */}
          <div className="flex-1 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
            {/* Mobile Day Selector Bar */}
            <div className="flex md:hidden items-center overflow-x-auto gap-1.5 p-2 bg-slate-100 border-b border-slate-200 sticky top-0 z-10 shrink-0">
              {weekDates.map((dateObj, idx) => {
                const isSelected = mobileDayIdx === idx;
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
                const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                return (
                  <button
                    key={idx}
                    onClick={() => setMobileDayIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center min-w-[58px] shrink-0 border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{dayName}</span>
                    <span className="text-xs">{dateStr}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Single Day View */}
            <div className="block md:hidden overflow-auto flex-1 p-3 space-y-4">
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-4 block">sync</span>
                  <p className="font-semibold">Calculating daily schedule matches...</p>
                </div>
              ) : activeTab === 'shifts' ? (
                shifts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-semibold">No shifts configured for {clinicName}.</p>
                  </div>
                ) : (
                  (() => {
                    const filteredShifts = shifts.filter(s => roleFilter === 'All' || s.staffing_role === roleFilter);
                    const rolesSet = Array.from(new Set(filteredShifts.map(s => s.staffing_role).filter(Boolean))).sort();
                    const targetDateObj = weekDates[mobileDayIdx];

                    if (!targetDateObj) return null;

                    return rolesSet.map(role => {
                      const roleShifts = filteredShifts.filter(s => s.staffing_role === role).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                      
                      const shiftGroups = {};
                      roleShifts.forEach(shift => {
                        const key = shift.id;
                        if (!shiftGroups[key]) {
                          shiftGroups[key] = {
                            custom_id: shift.custom_id,
                            start_time: shift.start_time,
                            end_time: shift.end_time,
                            time_block: shift.time_block,
                            staffing_role: shift.staffing_role,
                            shifts: []
                          };
                        }
                        shiftGroups[key].shifts.push(shift);
                      });

                      return (
                        <div key={role} className="space-y-3">
                          <div className="bg-slate-200/70 px-3 py-1 rounded-md font-bold text-slate-800 text-xs uppercase tracking-wider">
                            {role}
                          </div>
                          {Object.values(shiftGroups).map((group, groupIdx) => {
                            let reqCount = 0;
                            let employees = [];
                            let availableCandidates = [];
                            let isActive = false;
                            let customTime = null;

                            group.shifts.forEach(shift => {
                              const dayData = weeklyAssignments[shift.id]?.[mobileDayIdx];
                              if (dayData && dayData.isActive) {
                                isActive = true;
                                reqCount += (shift.required_count || 1);
                                if (dayData.employees) {
                                  employees = [...employees, ...dayData.employees];
                                }
                                if (dayData.availableCandidates) {
                                  availableCandidates = [...availableCandidates, ...dayData.availableCandidates];
                                }
                                if (dayData.customTime) {
                                  customTime = dayData.customTime;
                                }
                              }
                            });

                            availableCandidates = availableCandidates.filter((cand, index, self) => 
                              index === self.findIndex(c => c.id === cand.id)
                            );

                            const defaultTimeStr = group.start_time && group.end_time 
                              ? `${group.start_time.slice(0,5)}-${group.end_time.slice(0,5)}` 
                              : group.time_block;
                              
                            const effectiveTime = customTime || defaultTimeStr;

                            return (
                              <div key={groupIdx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{group.custom_id || 'Unnamed Shift'}</h4>
                                    <span className="text-xs text-slate-500 font-medium">
                                      {effectiveTime}
                                    </span>
                                  </div>
                                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${isActive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                                    {isActive ? `Req: ${reqCount}` : 'Inactive'}
                                  </span>
                                </div>
                                <div>
                                  <CoverageCell 
                                    isActive={isActive} 
                                    reqCount={reqCount} 
                                    employees={employees} 
                                    shiftTime={effectiveTime}
                                    shiftRole={group.staffing_role}
                                    shiftCustomId={group.custom_id}
                                    dateObj={targetDateObj}
                                    draggedItem={draggedItem}
                                    availableCandidates={availableCandidates}
                                    onAssign={(candidate, customStart, customEnd) => handleAssign(group.custom_id, group.staffing_role, group.start_time, group.end_time, targetDateObj, candidate.user_id, customStart, customEnd)}
                                    onRemoveAssign={(userId) => handleRemoveAssignment(group.custom_id, targetDateObj, userId)}
                                    onRoleMismatch={(userName, role, requiredRole) => showToastNotification(`Cannot assign ${userName}: Role (${role || 'None'}) does not match required ${requiredRole}`, 'error')}
                                    onDragAssignedStart={(emp, shiftCustomId, dateObj) => setDraggedItem({ type: 'ASSIGNED_EMPLOYEE', userId: emp.user_id, userName: emp.users?.name, shiftCustomId, dateObj })}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()
                )
              ) : (
                employees.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-semibold">No employees found.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[...employees]
                      .filter(e => roleFilter === 'All' || e.staffing_role === roleFilter)
                      .sort((a, b) => (a.users?.name || '').localeCompare(b.users?.name || ''))
                      .map((emp) => {
                        const dayData = employeeAssignments[emp.id]?.days?.[mobileDayIdx];
                        return (
                          <div key={emp.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {emp.users?.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm leading-tight">{emp.users?.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {emp.staffing_role}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {emp.shift_time || 'No times'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              {!dayData || !dayData.isActive ? (
                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">Off</span>
                              ) : dayData.shifts && dayData.shifts.length > 0 ? (
                                <div className="flex flex-col items-end gap-1">
                                  {dayData.shifts.map((shift, shiftIdx) => (
                                    <span key={shiftIdx} className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                      {shift.custom_id || shift.id.split('-')[0]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 border-dashed px-2 py-1 rounded-md">Available</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-auto flex-1">
              {activeTab === 'shifts' ? (
                <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-64 bg-slate-50 border-r border-slate-200 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0]">Shift</th>
                      {weekDates.map((dateObj, i) => (
                        <th key={i} className="p-4 border-r border-slate-100 min-w-[180px]">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-bold">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()]} {dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                            <span className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{getCycleDayLabel(getCycleDayIndex(dateObj))}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-500">
                          <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-4 block">sync</span>
                          <p className="font-semibold">Calculating weekly schedule matches...</p>
                        </td>
                      </tr>
                    ) : shifts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                            <span className="material-symbols-outlined text-3xl text-slate-400">calendar_month</span>
                          </div>
                          <h3 className="font-h3 text-slate-900 mb-1">No Shifts Configured</h3>
                          <p className="text-slate-500 text-sm max-w-md mx-auto">
                            There are no shift templates configured for {clinicName}. Check your shift templates in the Settings tab.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const filteredShifts = shifts.filter(s => roleFilter === 'All' || s.staffing_role === roleFilter);
                        const rolesSet = Array.from(new Set(filteredShifts.map(s => s.staffing_role).filter(Boolean))).sort();
                        
                        return rolesSet.map(role => {
                          const roleShifts = filteredShifts.filter(s => s.staffing_role === role).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                          
                          // Group by individual shift template
                          const shiftGroups = {};
                          roleShifts.forEach(shift => {
                            const key = shift.id;
                            if (!shiftGroups[key]) {
                              shiftGroups[key] = {
                                custom_id: shift.custom_id,
                                start_time: shift.start_time,
                                end_time: shift.end_time,
                                time_block: shift.time_block,
                                staffing_role: shift.staffing_role,
                                shifts: []
                              };
                            }
                            shiftGroups[key].shifts.push(shift);
                          });

                          return (
                            <React.Fragment key={role}>
                              <tr className="bg-slate-100 border-y-2 border-slate-200">
                                <td colSpan={8} className="p-3 sticky left-0 z-10">
                                  <span className="font-bold text-slate-800 text-base uppercase tracking-wider">{role}</span>
                                </td>
                              </tr>
                              {Object.values(shiftGroups).map((group, groupIdx) => (
                                <tr key={`${role}-${groupIdx}`} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100">
                                  {/* Sticky Left Column: Shift Info */}
                                  <td className="p-4 bg-white group-hover:bg-slate-50/50 border-r border-slate-200 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] transition-colors align-top">
                                    <p className="text-slate-900 font-bold mb-1">
                                      {group.custom_id || 'Unnamed Shift'}
                                    </p>
                                    <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                      {group.staffing_role}
                                    </span>
                                  </td>

                                  {/* 7 Day Columns */}
                                  {weekDates.map((dateObj, i) => {
                                    // Aggregate data across all shifts in this timeGroup for day `i`
                                    let reqCount = 0;
                                    let employees = [];
                                    let availableCandidates = [];
                                    let isActive = false;
                                    let customTime = null;

                                    group.shifts.forEach(shift => {
                                      const dayData = weeklyAssignments[shift.id]?.[i];
                                      if (dayData && dayData.isActive) {
                                        isActive = true;
                                        reqCount += (shift.required_count || 1);
                                        if (dayData.employees) {
                                          employees = [...employees, ...dayData.employees];
                                        }
                                        if (dayData.availableCandidates) {
                                          availableCandidates = [...availableCandidates, ...dayData.availableCandidates];
                                        }
                                        if (dayData.customTime) {
                                          customTime = dayData.customTime;
                                        }
                                      }
                                    });
                                    
                                    availableCandidates = availableCandidates.filter((cand, index, self) => 
                                      index === self.findIndex(c => c.id === cand.id)
                                    );
                                    
                                    const defaultTimeStr = group.start_time && group.end_time 
                                      ? `${group.start_time.slice(0,5)}-${group.end_time.slice(0,5)}` 
                                      : group.time_block;
                                      
                                    const effectiveTime = customTime || defaultTimeStr;
                                    
                                    return (
                                      <td key={i} className={`p-2 border-r border-slate-100 align-top ${!isActive ? 'bg-slate-50/50' : ''}`}>
                                        <CoverageCell 
                                          isActive={isActive} 
                                          reqCount={reqCount} 
                                          employees={employees} 
                                          shiftTime={effectiveTime}
                                          shiftRole={group.staffing_role}
                                          shiftCustomId={group.custom_id}
                                          dateObj={dateObj}
                                          draggedItem={draggedItem}
                                          availableCandidates={availableCandidates}
                                          onAssign={(candidate, customStart, customEnd) => handleAssign(group.custom_id, group.staffing_role, group.start_time, group.end_time, dateObj, candidate.user_id, customStart, customEnd)}
                                          onRemoveAssign={(userId) => handleRemoveAssignment(group.custom_id, dateObj, userId)}
                                          onRoleMismatch={(userName, role, requiredRole) => showToastNotification(`Cannot assign ${userName}: Role (${role || 'None'}) does not match required ${requiredRole}`, 'error')}
                                          onDragAssignedStart={(emp, shiftCustomId, dateObj) => setDraggedItem({ type: 'ASSIGNED_EMPLOYEE', userId: emp.user_id, userName: emp.users?.name, shiftCustomId, dateObj })}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-64 bg-slate-50 border-r border-slate-200 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0]">Employee</th>
                      {weekDates.map((dateObj, i) => (
                        <th key={i} className="p-4 border-r border-slate-100 min-w-[180px]">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-bold">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()]} {dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                            <span className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{getCycleDayLabel(getCycleDayIndex(dateObj))}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-500">
                          <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-4 block">sync</span>
                          <p className="font-semibold">Calculating weekly schedule matches...</p>
                        </td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-500">
                          No employees found for this department.
                        </td>
                      </tr>
                    ) : (
                      [...employees].filter(e => roleFilter === 'All' || e.staffing_role === roleFilter).sort((a, b) => (a.users?.name || '').localeCompare(b.users?.name || '')).map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Sticky Left Column: Employee Info */}
                          <td className="p-4 bg-white group-hover:bg-slate-50/50 border-r border-slate-200 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {emp.users?.name?.charAt(0) || '?'}
                              </div>
                              <div className="flex flex-col">
                                <p className="font-bold text-slate-900 leading-tight">
                                  {emp.users?.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {emp.staffing_role}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {emp.shift_time || 'No times'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 7 Day Columns */}
                          {employeeAssignments[emp.id]?.days?.map((dayData, i) => (
                            <td key={i} className={`p-2 border-r border-slate-100 align-top ${!dayData.isActive ? 'bg-slate-50/50' : ''}`}>
                              {!dayData.isActive ? (
                                <div className="h-full min-h-[60px] flex items-center justify-center">
                                  <span className="text-xs font-medium text-slate-400">Off</span>
                                </div>
                              ) : dayData.shifts && dayData.shifts.length > 0 ? (
                                <div className="flex flex-col gap-2 h-full min-h-[60px]">
                                  {dayData.shifts.map((shift, shiftIdx) => (
                                    <div key={shiftIdx} className="flex flex-col gap-1 bg-blue-50/70 p-2 rounded-md border border-blue-100/50 hover:border-blue-300 transition-colors cursor-default">
                                      <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-blue-600">event_available</span>
                                        <p className="font-semibold text-slate-900 text-xs leading-tight" title={shift.custom_id}>
                                          {shift.custom_id || shift.id.split('-')[0]}
                                        </p>
                                      </div>
                                      <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                                        {shift.start_time && shift.end_time 
                                          ? `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`
                                          : shift.time_block}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 bg-amber-50/50 p-2 rounded-md border border-amber-200/50 border-dashed cursor-default h-full min-h-[60px] justify-center items-center text-center">
                                  <p className="font-semibold text-amber-700 text-xs">Available</p>
                                  <p className="text-[10px] text-amber-600/70">Not Assigned</p>
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>

          {/* Right: Available Staff Pool (Drag & Drop Panel) */}
          {showSidebar && (
            <div 
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedItem?.type === 'ASSIGNED_EMPLOYEE') {
                  e.dataTransfer.dropEffect = 'move';
                  if (!isPoolDragOver) setIsPoolDragOver(true);
                } else {
                  e.dataTransfer.dropEffect = 'none';
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setIsPoolDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsPoolDragOver(false);
                setDraggedItem(null);
                try {
                  const raw = e.dataTransfer.getData('text/plain');
                  if (raw) {
                    const data = JSON.parse(raw);
                    if (data.type === 'ASSIGNED_EMPLOYEE' && data.userId && data.shiftCustomId) {
                      const dateObj = data.dateObjStr ? new Date(data.dateObjStr) : selectedDate;
                      handleRemoveAssignment(data.shiftCustomId, dateObj, data.userId);
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className={`w-80 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden shrink-0 transition-all ${
                isPoolDragOver ? 'ring-4 ring-rose-400 border-rose-500 bg-rose-50/80' : ''
              }`}
            >
              {isPoolDragOver ? (
                <div className="flex-1 bg-rose-500 text-white flex flex-col items-center justify-center gap-3 p-6 text-center animate-in fade-in pointer-events-none select-none">
                  <span className="material-symbols-outlined text-5xl animate-bounce pointer-events-none">person_remove</span>
                  <div className="pointer-events-none">
                    <p className="font-bold text-base pointer-events-none">Drop Here to Unassign</p>
                    <p className="text-xs opacity-90 mt-1 pointer-events-none">Removes staff assignment from shift</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-lg">group</span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Staff Pool</h3>
                        <p className="text-[11px] text-slate-500 font-medium">Drag to assign or drop here to unassign</p>
                      </div>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {filteredPoolEmps.length}
                    </span>
                  </div>

                  {/* Filters inside panel */}
                  <div className="p-3 border-b border-slate-100 space-y-2 bg-white">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
                      <input 
                        type="text" 
                        placeholder="Search staff..."
                        value={searchPool}
                        onChange={(e) => setSearchPool(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {['All', ...availableRoles].map(role => (
                        <button
                          key={role}
                          onClick={() => setRolePoolFilter(role)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all shrink-0 ${
                            rolePoolFilter === role 
                              ? 'bg-blue-900 text-white shadow-sm' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable employee list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/40">
                    {filteredPoolEmps.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <span className="material-symbols-outlined text-3xl mb-1 block">search_off</span>
                        <p className="text-xs font-semibold">No staff found</p>
                      </div>
                    ) : (
                      filteredPoolEmps.map(emp => {
                        const needsAssignment = isEmpScheduledToday(emp);
                        const remaining = getShiftsRemainingCount(emp);
                        const expected = getExpectedWeeklyShiftsCount(emp);
                        const isPartiallyAssigned = expected > 0 && remaining > 0;
                        const displayCount = remaining > 0 ? remaining : (needsAssignment ? 1 : 0);

                        return (
                          <div 
                            key={emp.id}
                            draggable={true}
                            onDragStart={(e) => {
                              const item = {
                                userId: emp.user_id,
                                userName: emp.users?.name,
                                staffingRole: emp.staffing_role,
                                secondaryRoles: emp.secondary_roles || []
                              };
                              setDraggedItem(item);
                              e.dataTransfer.setData('text/plain', JSON.stringify(item));
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onDragEnd={() => setDraggedItem(null)}
                            className={`group border rounded-xl p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all shadow-sm hover:shadow-md select-none ${
                              needsAssignment
                                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/60 hover:border-amber-400'
                                : isPartiallyAssigned
                                  ? 'bg-blue-50/70 border-blue-200 ring-1 ring-blue-100 hover:border-blue-300'
                                  : 'bg-white hover:bg-blue-50/80 border-slate-200 hover:border-blue-400'
                            }`}
                          >
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 text-lg shrink-0">
                              drag_indicator
                            </span>
                            <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${
                              needsAssignment ? 'bg-amber-600 text-white' : isPartiallyAssigned ? 'bg-blue-700 text-white' : 'bg-blue-900 text-white'
                            }`}>
                              {emp.users?.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-900">
                                  {emp.users?.name}
                                </p>
                                {displayCount > 0 && (
                                  <span 
                                    className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs flex items-center justify-center tracking-tight"
                                    title={`${displayCount} shift(s) remaining to be assigned`}
                                  >
                                    +{displayCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                  {emp.staffing_role}
                                </span>
                                {emp.secondary_roles && emp.secondary_roles.length > 0 && (
                                  <span className="text-[9px] font-semibold text-slate-400 truncate">
                                    +{emp.secondary_roles.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-xs text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              drag_handle
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Publish Confirmation Modal */}
        {showPublishModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-blue-600">campaign</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Publish Weekly Schedule?</h3>
                  <p className="text-xs font-semibold text-slate-500">Week of {getWeekStartStr(selectedDate)}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  Are you sure you wish to publish this schedule?
                </p>
                <p className="leading-relaxed">
                  Publishing will make the schedule visible and immediately notify all assigned employees of their shifts. <strong className="text-slate-900 font-bold">This action cannot be undone.</strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  disabled={publishing}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false);
                    handleExecutePublish();
                  }}
                  disabled={publishing}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all flex items-center gap-1.5"
                >
                  {publishing ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      Publishing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      Confirm & Publish
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Published Schedule Change Confirmation Modal */}
        {publishedConfirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                    <span className="material-symbols-outlined text-[22px]">warning</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">Modify Published Schedule?</h3>
                    <p className="text-xs text-amber-700 font-medium">This schedule is currently published live to staff.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPublishedConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="bg-amber-50/80 rounded-xl p-3.5 border border-amber-200/80 text-xs space-y-2 text-slate-700">
                <p className="font-semibold text-slate-900">
                  You are making a change to a <span className="font-bold text-amber-800">Published Schedule</span>.
                </p>
                <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                  <p><span className="font-bold text-slate-700">Target Staff:</span> {publishedConfirmModal.employeeName}</p>
                  <p><span className="font-bold text-slate-700">Shift / Action:</span> {publishedConfirmModal.shiftName}</p>
                  {publishedConfirmModal.dateStr && <p><span className="font-bold text-slate-700">Date:</span> {publishedConfirmModal.dateStr}</p>}
                </div>
                <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                  An automated live notification will be sent to the employee immediately.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPublishedConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedPublishedAction}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Confirm & Notify
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 border ${
            toast.type === 'error' 
              ? 'bg-rose-900 border-rose-700' 
              : toast.type === 'info' 
              ? 'bg-slate-900 border-slate-700' 
              : 'bg-emerald-900 border-emerald-700'
          }`}>
            <span className="material-symbols-outlined text-lg">
              {toast.type === 'error' ? 'error' : toast.type === 'info' ? 'info' : 'check_circle'}
            </span>
            <span className="font-semibold text-xs">{toast.msg}</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
