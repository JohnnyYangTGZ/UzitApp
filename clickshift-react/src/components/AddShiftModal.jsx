import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';

export default function AddShiftModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const { selectedDepartmentId, selectedClinicId, clinics } = useLocationContext();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  
  const [templates, setTemplates] = useState([]);
  
  const initialClinicId = selectedClinicId === 'ALL' ? (clinics.length > 0 ? clinics[0].id : '') : (selectedClinicId || '');
  
  const [formData, setFormData] = useState({
    staffingRole: '',
    userId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    timeBlock: 'AD-HOC',
    clinicId: initialClinicId
  });

  useEffect(() => {
    if (isOpen && selectedDepartmentId) {
      loadEmployees();
      loadRoles();
      loadTemplates();
      
      const defaultClinicId = selectedClinicId === 'ALL' ? (clinics.length > 0 ? clinics[0].id : '') : (selectedClinicId || '');
      
      if (initialData) {
        setFormData(prev => ({ 
          ...prev, 
          clinicId: defaultClinicId,
          ...initialData
        }));
      } else {
        setFormData({
          staffingRole: '',
          userId: '',
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '17:00',
          timeBlock: 'AD-HOC',
          clinicId: defaultClinicId
        });
      }
    }
  }, [isOpen, selectedDepartmentId, selectedClinicId, initialData, clinics]);

  async function loadTemplates() {
    const targetClinic = selectedClinicId === 'ALL' && clinics.length > 0 ? clinics[0].id : selectedClinicId;
    if (!targetClinic || targetClinic === 'ALL') return;

    const { data } = await supabase
      .from('coverage_requirements')
      .select('custom_id, start_time, end_time, staffing_role')
      .eq('location_id', targetClinic);
    if (data) {
      setTemplates(data);
    }
  }

  async function loadRoles() {
    const { data } = await supabase
      .from('staffing_roles')
      .select('name')
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true)
      .order('name');
    if (data) {
      setAvailableRoles(data.map(r => r.name));
    }
  }

  async function loadEmployees() {
    const { data } = await supabase
      .from('employee_profiles')
      .select(`
        user_id,
        staffing_role,
        users!employee_profiles_user_id_fkey!inner ( name )
      `)
      .eq('department_id', selectedDepartmentId)
      .order('employee_code');
      
    if (data) {
      setEmployees(data);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.staffingRole || !formData.date || !formData.startTime || !formData.endTime || !formData.clinicId) return;

    setLoading(true);

    try {
      // 1. Check if a shift already exists for this date, timeBlock, and clinic
      let shiftId;
      const { data: existingShifts, error: shiftFetchError } = await supabase
        .from('shifts')
        .select('id')
        .eq('date', formData.date)
        .eq('time_block', formData.timeBlock)
        .eq('start_time', formData.startTime)
        .eq('end_time', formData.endTime)
        .eq('location_id', formData.clinicId);

      if (shiftFetchError) throw shiftFetchError;

      if (existingShifts && existingShifts.length > 0) {
        shiftId = existingShifts[0].id;
      } else {
        // Create new shift
        const { data: newShift, error: shiftInsertError } = await supabase
          .from('shifts')
          .insert({
            date: formData.date,
            time_block: formData.timeBlock,
            start_time: formData.startTime,
            end_time: formData.endTime,
            location_id: formData.clinicId,
            staffing_role: formData.staffingRole,
            is_working_day: true
          })
          .select('id')
          .single();

        if (shiftInsertError) throw shiftInsertError;
        shiftId = newShift.id;
      }

      // 2. Assign user to shift (if selected)
      if (formData.userId) {
        const { error: assignError } = await supabase
          .from('shift_assignments')
          .insert({
            shift_id: shiftId,
            user_id: formData.userId,
            status: 'scheduled',
            source_type: 'manual'
          });

        if (assignError) {
          // Handle constraint violations (e.g. user already assigned)
          if (assignError.code === '23505') {
            throw new Error('Employee is already scheduled for this shift.');
          }
          throw assignError;
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding shift:', err);
      alert(err.message || 'Failed to add shift.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-h3 text-h3 text-slate-900">Add Ad-hoc Shift</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Staff Type (Required)</label>
            <select
              value={formData.staffingRole}
              onChange={e => setFormData({ ...formData, staffingRole: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            >
              <option value="" disabled>Select Staff Type</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Employee (Optional)</label>
            <select
              value={formData.userId}
              onChange={e => setFormData({ ...formData, userId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="">Unassigned / Open Shift</option>
              {employees.filter(emp => !formData.staffingRole || emp.staffing_role === formData.staffingRole).map(emp => (
                <option key={emp.user_id} value={emp.user_id}>{emp.users?.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Clinic</label>
            <select
              value={formData.clinicId}
              onChange={e => setFormData({ ...formData, clinicId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            >
              <option value="" disabled>Select Clinic</option>
              {clinics.map(clinic => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Shift Slot</label>
            <select
              value={formData.timeBlock}
              onChange={e => {
                const val = e.target.value;
                if (val === 'AD-HOC') {
                  setFormData({ ...formData, timeBlock: val });
                } else {
                  const t = templates.find(x => x.custom_id === val);
                  if (t) {
                    setFormData({ ...formData, timeBlock: val, startTime: t.start_time, endTime: t.end_time });
                  } else {
                    setFormData({ ...formData, timeBlock: val });
                  }
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            >
              <option value="AD-HOC">New Ad-hoc Shift</option>
              {templates
                .filter(t => !formData.staffingRole || t.staffing_role === formData.staffingRole)
                .map(t => (
                  <option key={t.custom_id} value={t.custom_id}>
                    {t.custom_id} ({t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
