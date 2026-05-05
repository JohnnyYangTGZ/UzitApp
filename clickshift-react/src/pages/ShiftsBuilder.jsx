import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import { useLocation } from 'react-router-dom';
import ScheduleSelector, { DEFAULT_PATTERN } from '../components/ScheduleSelector';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10));
  d.setMinutes(parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export default function ShiftsBuilder() {
  const { selectedClinicId, clinics, selectedDepartmentId } = useLocationContext();
  const location = useLocation();
  const [requirements, setRequirements] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    customId: '',
    startTime: '08:00',
    endTime: '17:00',
    staffingRole: '',
    isRequired: true,
    schedulePattern: DEFAULT_PATTERN
  });

  const [selectedShift, setSelectedShift] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customId: '',
    startTime: '08:00',
    endTime: '17:00',
    staffingRole: 'RN',
    isRequired: true,
    schedulePattern: DEFAULT_PATTERN
  });

  const clinicName = clinics.find(c => c.id === selectedClinicId)?.name || 'the selected clinic';

  useEffect(() => {
    if (selectedClinicId && selectedDepartmentId) {
      loadRequirements();
    } else {
      setRequirements([]);
      setSelectedShift(null);
      setLoading(false);
    }
  }, [selectedClinicId, selectedDepartmentId]);

  useEffect(() => {
    if (selectedShift && !isEditing) {
      setEditForm({
        customId: selectedShift.custom_id || '',
        startTime: selectedShift.start_time ? selectedShift.start_time.substring(0, 5) : '08:00',
        endTime: selectedShift.end_time ? selectedShift.end_time.substring(0, 5) : '17:00',
        staffingRole: selectedShift.staffing_role,
        isRequired: selectedShift.required_count > 0,
        schedulePattern: selectedShift.schedule_pattern || DEFAULT_PATTERN
      });
    }
  }, [selectedShift, isEditing]);

  useEffect(() => {
    const handleOpenNewTemplate = () => {
      setFormData({ 
        customId: '', 
        startTime: '08:00', 
        endTime: '17:00', 
        staffingRole: roleFilter === 'All' ? '' : roleFilter, 
        isRequired: true, 
        schedulePattern: DEFAULT_PATTERN 
      });
      setIsAdding(true);
      setIsEditing(false);
    };
    window.addEventListener('open-new-template', handleOpenNewTemplate);
    return () => window.removeEventListener('open-new-template', handleOpenNewTemplate);
  }, [roleFilter]);

  async function loadRequirements() {
    if (!selectedDepartmentId) return;
    setLoading(true);

    const { data: rolesData } = await supabase
      .from('staffing_roles')
      .select('name')
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true);
    
    setAvailableRoles(rolesData?.map(r => r.name).sort() || []);

    const { data, error } = await supabase
      .from('coverage_requirements')
      .select('*')
      .eq('location_id', selectedClinicId)
      .order('custom_id', { ascending: true });

    if (error) {
      console.error('Error fetching requirements:', error);
      setErrorMsg(error.message);
    } else {
      setRequirements(data || []);
      setErrorMsg('');
      if (data && data.length > 0) {
        if (location.state?.shiftId) {
          const target = data.find(r => r.id === location.state.shiftId);
          if (target) {
            setSelectedShift(target);
            // Clear state so it doesn't get stuck if user navigates back
            window.history.replaceState({}, document.title);
          } else {
            setSelectedShift(data[0]);
          }
        } else {
          setSelectedShift(prev => {
            if (!prev) return data[0];
            const exists = data.find(r => r.id === prev.id);
            return exists ? prev : data[0];
          });
        }
      } else {
        setSelectedShift(null);
      }
    }
    setLoading(false);
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customId) {
      alert('Please provide a unique Shift ID.');
      return;
    }
    if (!formData.startTime || !formData.endTime || !formData.staffingRole) return;

    const { error } = await supabase
      .from('coverage_requirements')
      .insert({
        custom_id: formData.customId,
        location_id: selectedClinicId,
        start_time: formData.startTime,
        end_time: formData.endTime,
        time_block: `${formData.startTime} - ${formData.endTime}`, 
        day_type: 'WEEKDAY',
        staffing_role: formData.staffingRole,
        required_count: formData.isRequired ? 1 : 0,
        schedule_pattern: formData.schedulePattern
      });

    if (error) {
      if (error.code === '23505') {
        alert('Failed: That Shift ID is already in use. Please enter a unique ID.');
      } else {
        alert('Failed to add requirement: ' + error.message);
      }
    } else {
      setFormData({ customId: '', startTime: '08:00', endTime: '17:00', staffingRole: '', isRequired: true, schedulePattern: DEFAULT_PATTERN });
      setIsAdding(false);
      loadRequirements();
    }
  };

  const handleEditSubmit = async () => {
    if (!editForm.customId) {
      alert('Please provide a unique Shift ID.');
      return;
    }
    if (!editForm.startTime || !editForm.endTime || !editForm.staffingRole) return;
    
    const { error } = await supabase
      .from('coverage_requirements')
      .update({
        custom_id: editForm.customId,
        start_time: editForm.startTime,
        end_time: editForm.endTime,
        time_block: `${editForm.startTime} - ${editForm.endTime}`,
        staffing_role: editForm.staffingRole,
        required_count: editForm.isRequired ? 1 : 0,
        schedule_pattern: editForm.schedulePattern
      })
      .eq('id', selectedShift.id);

    if (error) {
      if (error.code === '23505') {
        alert('Failed: That Shift ID is already in use. Please enter a unique ID.');
      } else {
        alert('Failed to update requirement: ' + error.message);
      }
    } else {
      setIsEditing(false);
      loadRequirements();
      setSelectedShift(prev => ({
        ...prev,
        custom_id: editForm.customId,
        start_time: editForm.startTime,
        end_time: editForm.endTime,
        time_block: `${editForm.startTime} - ${editForm.endTime}`,
        staffing_role: editForm.staffingRole,
        required_count: editForm.isRequired ? 1 : 0,
        schedule_pattern: editForm.schedulePattern
      }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shift requirement?')) return;
    
    const { error } = await supabase
      .from('coverage_requirements')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Failed to delete requirement: ' + error.message);
    } else {
      loadRequirements();
    }
  };

  const handleDuplicate = () => {
    setFormData({
      customId: selectedShift.custom_id ? `${selectedShift.custom_id}_COPY` : '',
      startTime: selectedShift.start_time ? selectedShift.start_time.substring(0, 5) : '08:00',
      endTime: selectedShift.end_time ? selectedShift.end_time.substring(0, 5) : '17:00',
      staffingRole: selectedShift.staffing_role,
      isRequired: selectedShift.required_count > 0,
      schedulePattern: selectedShift.schedule_pattern || DEFAULT_PATTERN
    });
    setIsAdding(true);
    setIsEditing(false);
  };

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-end justify-between shrink-0">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface mb-2">Shifts Configuration</h1>
            <p className="text-body-md text-on-surface-variant max-w-2xl">
              Build and manage the required and extra shift slots for {clinicName}. These act as daily templates for staffing requirements.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 border border-surface-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700 uppercase tracking-wider"
              >
                <option value="All">All</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg font-medium text-sm shrink-0">
            Error: {errorMsg}
          </div>
        )}

        {/* Content Split: Table & Datacard */}
        <div className="flex gap-6 flex-1 min-h-0">
          
          {/* Left: Table */}
          <div className="flex-1 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-1/4">Shift ID</th>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-1/4">Shift Time</th>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider w-1/4">Requirements</th>
                    <th className="p-4 font-label-sm text-label-sm text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-500">Loading shifts...</td>
                    </tr>
                  ) : requirements.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                          <span className="material-symbols-outlined text-3xl text-slate-400">calendar_month</span>
                        </div>
                        <h3 className="font-h3 text-slate-900 mb-1">No Shift Templates</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                          There are no shift templates configured for {clinicName}. Create a template to define daily staffing requirements.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    requirements
                      .filter(req => roleFilter === 'All' || req.staffing_role === roleFilter)
                      .map(req => {
                      const isSelected = selectedShift?.id === req.id;
                      return (
                        <tr 
                          key={req.id} 
                          onClick={() => {
                            setSelectedShift(req);
                            setIsEditing(false);
                            setIsAdding(false);
                          }}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                        >
                          <td className="p-4 font-mono font-semibold text-slate-700">{req.custom_id || req.id.split('-')[0]}</td>
                          <td className="p-4 text-slate-900 text-sm">
                            {req.start_time && req.end_time 
                              ? `${formatTime(req.start_time)} - ${formatTime(req.end_time)}`
                              : req.time_block}
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                              {req.staffing_role}
                            </span>
                          </td>
                          <td className="p-4">
                            {req.required_count > 0 ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                Extra (Open)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Datacard */}
          <div className="w-[440px] shrink-0 bg-white rounded-xl border border-surface-border shadow-sm flex flex-col overflow-hidden">
            {isAdding ? (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4">
                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-h3 text-h3 text-slate-900">New Template</h3>
                    <div className="font-mono text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1.5 rounded uppercase">
                      CREATE
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-auto space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Shift ID</label>
                    <input
                      type="text"
                      placeholder="e.g. SHIFT-RN-AM"
                      value={formData.customId}
                      onChange={e => setFormData({ ...formData, customId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
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
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Requirement</label>
                      <select
                        value={formData.staffingRole}
                        onChange={e => setFormData({ ...formData, staffingRole: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm uppercase tracking-wider"
                      >
                        <option value="" disabled>Select Role</option>
                        {availableRoles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                      <select
                        value={formData.isRequired ? 'required' : 'extra'}
                        onChange={e => setFormData({ ...formData, isRequired: e.target.value === 'required' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-semibold"
                      >
                        <option value="required">Required</option>
                        <option value="extra">Extra (Open)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Schedule Pattern</label>
                    <ScheduleSelector 
                      pattern={formData.schedulePattern} 
                      onChange={p => setFormData({ ...formData, schedulePattern: p })}
                      readonly={false}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddSubmit}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedShift ? (
              <div className="flex flex-col h-full animate-in fade-in">
                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-h3 text-h3 text-slate-900">Shift Details</h3>
                    <div className="font-mono text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1.5 rounded uppercase">
                      {selectedShift.custom_id || 'UNKNOWN-ID'}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-auto space-y-6">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Shift ID</label>
                        <input
                          type="text"
                          value={editForm.customId}
                          onChange={e => setEditForm({ ...editForm, customId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={editForm.startTime}
                            onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">End Time</label>
                          <input
                            type="time"
                            value={editForm.endTime}
                            onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Requirement</label>
                          <select
                            value={editForm.staffingRole}
                            onChange={e => setEditForm({ ...editForm, staffingRole: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm uppercase tracking-wider"
                          >
                            <option value="" disabled>Select Role</option>
                            {availableRoles.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                          <select
                            value={editForm.isRequired ? 'required' : 'extra'}
                            onChange={e => setEditForm({ ...editForm, isRequired: e.target.value === 'required' })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-semibold"
                          >
                            <option value="required">Required</option>
                            <option value="extra">Extra (Open)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Schedule Pattern (14 Days)</label>
                        <ScheduleSelector 
                          pattern={editForm.schedulePattern} 
                          onChange={p => setEditForm({ ...editForm, schedulePattern: p })}
                          readonly={false}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-8">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Shift Time</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedShift.start_time && selectedShift.end_time 
                                ? `${formatTime(selectedShift.start_time)} - ${formatTime(selectedShift.end_time)}`
                                : selectedShift.time_block}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Requirement</p>
                          <span className="bg-slate-200 text-slate-700 text-sm px-3 py-1.5 rounded font-bold uppercase tracking-wider">
                            {selectedShift.staffing_role}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
                        {selectedShift.required_count > 0 ? (
                          <div className="inline-flex items-center gap-2 font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            Required
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-green-600"></span>
                            Extra (Open)
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Schedule Pattern</p>
                        <ScheduleSelector 
                          pattern={selectedShift.schedule_pattern} 
                          onChange={() => {}}
                          readonly={true}
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                         <p>System ID: {selectedShift.id.split('-')[0]}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
                  {isEditing ? (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleEditSubmit}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
                      >
                        Save Pattern
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                          Edit
                        </button>
                        <button 
                          onClick={handleDuplicate}
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                          Duplicate
                        </button>
                      </div>
                      <button 
                        onClick={() => handleDelete(selectedShift.id)}
                        className="w-full mt-3 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-semibold text-sm hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        Delete Template
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 my-auto">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">touch_app</span>
                <p>Select a shift template from the list to view or edit details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
