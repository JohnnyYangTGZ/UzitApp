import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function RequestsScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please enter start and end dates (YYYY-MM-DD)");
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('time_off_requests').insert({
      user_id: session.user.id,
      start_date: startDate,
      end_date: endDate,
      status: 'pending',
      notes: reason,
      time_off_type_code: 'VAC' // Default for now
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Time off request submitted!");
      setStartDate('');
      setEndDate('');
      setReason('');
    }
  };

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-900 mb-6 mt-10">Request Time Off</Text>
      
      <View className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <Text className="text-sm font-medium text-slate-700 mb-2">Start Date (YYYY-MM-DD)</Text>
        <TextInput 
          className="border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="e.g. 2026-06-01"
        />

        <Text className="text-sm font-medium text-slate-700 mb-2">End Date (YYYY-MM-DD)</Text>
        <TextInput 
          className="border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="e.g. 2026-06-05"
        />

        <Text className="text-sm font-medium text-slate-700 mb-2">Reason</Text>
        <TextInput 
          className="border border-slate-300 rounded-lg p-3 mb-6 bg-slate-50"
          value={reason}
          onChangeText={setReason}
          placeholder="Vacation"
          multiline
        />

        <TouchableOpacity 
          className={`bg-indigo-600 rounded-lg p-4 items-center ${loading ? 'opacity-50' : ''}`}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-lg">{loading ? 'Submitting...' : 'Submit Request'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
