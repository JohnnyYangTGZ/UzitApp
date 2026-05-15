import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useScheduleData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMySchedule = useCallback(async (userId, startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      const ANCHOR_DATE = new Date(2025, 11, 14);
      const getCycleDayIndex = (dateObj) => {
        const diffTime = dateObj.getTime() - ANCHOR_DATE.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let cycleDayIndex = diffDays % 14;
        if (cycleDayIndex < 0) cycleDayIndex += 14;
        return cycleDayIndex;
      };

      const { data: assignments, error } = await supabase
        .from('shift_assignments')
        .select(`
          id,
          status,
          shifts:shift_id (
            id,
            date,
            time_block,
            start_time,
            end_time,
            location:location_id (name, code)
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      
      const { data: profile } = await supabase
        .from('employee_profiles')
        .select('schedule_pattern, shift_time')
        .eq('user_id', userId)
        .single();
        
      const { data: clinics } = await supabase
        .from('employee_clinics')
        .select('locations(name, code)')
        .eq('user_id', userId);
      
      const primaryClinic = clinics && clinics.length > 0 ? clinics[0].locations : { name: 'Assigned Clinic', code: 'UNK' };

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

      const { data: timeOffs } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      const isTimeOffDay = (dateStr) => {
        return timeOffs?.some(t => t.start_date <= dateStr && t.end_date >= dateStr);
      };

      const validAssignments = (assignments || []).filter(a => a.shifts !== null && a.shifts.date >= startDate && a.shifts.date <= endDate);
      const manualAssignmentsMap = {};
      validAssignments.forEach(a => {
         manualAssignmentsMap[a.shifts.date] = a;
      });

      const allShifts = [];
      const startD = new Date(startDate + 'T12:00:00Z');
      const endD = new Date(endDate + 'T12:00:00Z');
      
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        if (manualAssignmentsMap[dateStr]) {
           allShifts.push(manualAssignmentsMap[dateStr]);
           continue;
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

             allShifts.push({
               id: `auto-${dateStr}`,
               status: 'assigned',
               shifts: {
                 id: `auto-shift-${dateStr}`,
                 date: dateStr,
                 time_block: 'Regular',
                 start_time: sTime,
                 end_time: eTime,
                 location: primaryClinic
               }
             });
          }
        }
      }
      
      return allShifts;
    } catch (err) {
      console.error('Error fetching my schedule:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeeklyBoard = useCallback(async (locationId, startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all shifts for the location in the date range
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          id,
          date,
          time_block
        `)
        .eq('location_id', locationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (shiftsError) throw shiftsError;

      // 2. Fetch all shift assignments for those shifts, including user details
      const shiftIds = shiftsData.map(s => s.id);
      
      let assignmentsData = [];
      if (shiftIds.length > 0) {
        const { data: assignData, error: assignError } = await supabase
          .from('shift_assignments')
          .select(`
            id,
            shift_id,
            status,
            user:user_id (id, name, role, employee_profiles (job_title, staffing_role, employee_code))
          `)
          .in('shift_id', shiftIds);
          
        if (assignError) throw assignError;
        assignmentsData = assignData;
      }

      // 3. Format the data into a usable structure for the Weekly Board
      // Group by user, then map their shifts
      const usersMap = {};
      
      assignmentsData.forEach(assignment => {
        const user = assignment.user;
        const profile = user.employee_profiles && user.employee_profiles.length > 0 ? user.employee_profiles[0] : null;
        
        if (!usersMap[user.id]) {
          usersMap[user.id] = {
            id: user.id,
            name: user.name,
            role: profile ? profile.staffing_role : 'unknown',
            shifts: []
          };
        }
        
        const shiftDetails = shiftsData.find(s => s.id === assignment.shift_id);
        if (shiftDetails) {
          usersMap[user.id].shifts.push({
            assignmentId: assignment.id,
            shiftId: shiftDetails.id,
            date: shiftDetails.date,
            timeBlock: shiftDetails.time_block,
            status: assignment.status
          });
        }
      });

      return {
        shifts: shiftsData,
        users: Object.values(usersMap)
      };
      
    } catch (err) {
      console.error('Error fetching weekly board:', err);
      setError(err.message);
      return { shifts: [], users: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('schedule_patterns')
        .select(`
          id,
          name,
          description,
          schedule_pattern_entries (
            id,
            week_number,
            day_of_week,
            time_block,
            shift_label,
            start_time,
            end_time
          )
        `);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching patterns:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchMySchedule,
    fetchWeeklyBoard,
    fetchPatterns
  };
}
