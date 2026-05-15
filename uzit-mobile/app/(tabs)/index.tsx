import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function MyScheduleScreen() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  usePushNotifications(); // Registers device token on mount

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    // Since this is a simple mobile app, we fetch the next 14 days of shift assignments
    const today = new Date();
    const twoWeeks = new Date();
    twoWeeks.setDate(today.getDate() + 14);

    const { data } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        status,
        shifts:shift_id (
          date,
          start_time,
          end_time,
          time_block,
          location:location_id (name)
        )
      `)
      .eq('user_id', session.user.id)
      .gte('shifts.date', today.toISOString().split('T')[0])
      .lte('shifts.date', twoWeeks.toISOString().split('T')[0]);

    if (data) {
      setShifts(data.filter(d => d.shifts));
    }
    setLoading(false);
  };

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator size="large" /></View>;
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-900 mb-6 mt-10">My Upcoming Shifts</Text>
      
      {shifts.length === 0 ? (
        <View className="bg-white p-6 rounded-xl border border-slate-200">
          <Text className="text-slate-500 text-center">No shifts scheduled for the next 14 days.</Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="bg-white p-4 rounded-xl border border-slate-200 mb-3 shadow-sm">
              <Text className="text-lg font-semibold text-slate-800">
                {new Date(item.shifts.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <Text className="text-slate-600 mt-1">
                {item.shifts.start_time && item.shifts.end_time 
                  ? `${item.shifts.start_time.slice(0,5)} - ${item.shifts.end_time.slice(0,5)}` 
                  : item.shifts.time_block}
              </Text>
              <Text className="text-slate-500 text-sm mt-2">{item.shifts.location?.name || 'Clinic'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
