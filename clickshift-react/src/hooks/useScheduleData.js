import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useScheduleData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMySchedule = useCallback(async (userId, startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch shift assignments for the user, joined with the actual shift details
      const { data, error } = await supabase
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
        .eq('user_id', userId)
        .gte('shifts.date', startDate)
        .lte('shifts.date', endDate);

      if (error) throw error;
      
      // Filter out null shifts (Supabase inner join syntax behavior)
      return data.filter(assignment => assignment.shifts !== null);
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
