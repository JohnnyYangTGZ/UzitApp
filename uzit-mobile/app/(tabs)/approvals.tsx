import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ApprovalsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [daySnapshot, setDaySnapshot] = useState<any[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('time_off_requests')
      .select('*, users (name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleSelectRequest = async (req: any) => {
    setSelectedRequest(req);
    setLoadingSnapshot(true);
    
    // Fetch who else is working on req.start_date
    const { data: shifts } = await supabase
      .from('shift_assignments')
      .select('users(name), shifts(time_block, start_time, end_time)')
      .eq('shifts.date', req.start_date)
      .not('shifts', 'is', null);

    setDaySnapshot(shifts || []);
    setLoadingSnapshot(false);
  };

  const handleUpdateStatus = async (status: 'approved' | 'denied') => {
    if (!selectedRequest) return;
    const { error } = await supabase
      .from('time_off_requests')
      .update({ status })
      .eq('id', selectedRequest.id);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", `Request ${status}`);
      setSelectedRequest(null);
      fetchRequests();
    }
  };

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator size="large" /></View>;
  }

  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-900 mb-6 mt-10">Manager Inbox</Text>
      
      {requests.length === 0 ? (
        <View className="bg-white p-6 rounded-xl border border-slate-200">
          <Text className="text-slate-500 text-center">No pending time off requests.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="bg-white p-4 rounded-xl border border-slate-200 mb-3 shadow-sm flex-row justify-between items-center"
              onPress={() => handleSelectRequest(item)}
            >
              <View>
                <Text className="text-lg font-semibold text-slate-800">{item.users?.name}</Text>
                <Text className="text-slate-600">{item.start_date} to {item.end_date}</Text>
              </View>
              <View className="bg-amber-100 px-3 py-1 rounded-full">
                <Text className="text-amber-700 text-xs font-bold">Review</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Snapshot Modal */}
      <Modal visible={!!selectedRequest} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white p-6">
          <View className="flex-row justify-between items-center mb-6 mt-4">
            <Text className="text-2xl font-bold text-slate-900">Review Request</Text>
            <TouchableOpacity onPress={() => setSelectedRequest(null)}>
              <Text className="text-slate-500 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>

          {selectedRequest && (
            <>
              <View className="bg-slate-50 p-4 rounded-xl mb-6">
                <Text className="text-lg font-semibold">{selectedRequest.users?.name}</Text>
                <Text className="text-slate-600 mt-1">Requested Dates: {selectedRequest.start_date} to {selectedRequest.end_date}</Text>
                <Text className="text-slate-500 mt-2 italic">"{selectedRequest.notes}"</Text>
              </View>

              <Text className="text-lg font-bold text-slate-800 mb-3">Day Snapshot ({selectedRequest.start_date})</Text>
              
              {loadingSnapshot ? (
                <ActivityIndicator />
              ) : (
                <ScrollView className="max-h-60 border border-slate-200 rounded-xl p-3">
                  {daySnapshot.length === 0 ? (
                    <Text className="text-slate-500 text-center py-4">No ad-hoc shifts found for this day.</Text>
                  ) : (
                    daySnapshot.map((s, idx) => (
                      <View key={idx} className="border-b border-slate-100 py-2">
                        <Text className="font-semibold text-slate-700">{s.users?.name}</Text>
                        <Text className="text-slate-500 text-xs">{s.shifts?.time_block}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}

              <View className="flex-row justify-between mt-auto mb-8 gap-4">
                <TouchableOpacity 
                  className="flex-1 bg-red-100 p-4 rounded-xl items-center"
                  onPress={() => handleUpdateStatus('denied')}
                >
                  <Text className="text-red-700 font-bold text-lg">Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 bg-green-600 p-4 rounded-xl items-center"
                  onPress={() => handleUpdateStatus('approved')}
                >
                  <Text className="text-white font-bold text-lg">Approve</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
