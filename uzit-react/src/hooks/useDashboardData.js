import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useDashboardData(userId, role) {
  const [data, setData] = useState({
    shifts: [],
    requests: [],
    alerts: [],
    staff: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (role === 'manager') {
          // Fetch pending requests
          const { data: requests } = await supabase
            .from('time_off_requests')
            .select(`*, users (name, role)`)
            .eq('status', 'pending');

          // Fetch all active staff
          const { data: staff } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'staff');

          setData({
            shifts: [],
            requests: requests || [],
            alerts: [],
            staff: staff || []
          });
        } else {
          // Fetch my requests
          const { data: myRequests } = await supabase
            .from('time_off_requests')
            .select('*')
            .eq('user_id', userId);

          setData({
            shifts: [],
            requests: myRequests || [],
            alerts: [],
            staff: []
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchData();
    }
  }, [userId, role]);

  return { data, loading };
}
