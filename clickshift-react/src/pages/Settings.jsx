import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import CreateRoleModal from '../components/CreateRoleModal';

export default function Settings() {
  const { clinics, selectedClinicId, setSelectedClinicId } = useLocationContext();
  
  const [clinicDetails, setClinicDetails] = useState({ name: '', code: '', parent_location_id: null });
  const [loading, setLoading] = useState(true);
  
  const [roles, setRoles] = useState([]);
  const [timeOffTypes, setTimeOffTypes] = useState([]);
  const [newTimeOffName, setNewTimeOffName] = useState('');
  const [newTimeOffCode, setNewTimeOffCode] = useState('');
  
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState(null);

  useEffect(() => {
    if (!selectedClinicId) return;

    async function loadSettings() {
      setLoading(true);
      
      // Load Clinic Details
      const { data: clinicData } = await supabase
        .from('locations')
        .select('*')
        .eq('id', selectedClinicId)
        .single();
        
      if (clinicData) {
        setClinicDetails({ name: clinicData.name, code: clinicData.code || '', parent_location_id: clinicData.parent_location_id });
      }

      // Load Department Roles
      const deptId = clinicData?.parent_location_id || selectedClinicId;
      const { data: rolesData } = await supabase
        .from('staffing_roles')
        .select('*')
        .eq('department_id', deptId)
        .eq('is_active', true);
        
      const availableRoles = rolesData?.map(r => r.name) || ['RN', 'LVN', 'MA'];
      setRoles(rolesData || []);


      // Load Time Off Types
      const { data: timeOffData } = await supabase
        .from('time_off_types')
        .select('*')
        .order('name');
      setTimeOffTypes(timeOffData || []);

      setLoading(false);
    }
    
    loadSettings();
  }, [selectedClinicId]);

  const handleClinicUpdate = async (e) => {
    e.preventDefault();
    await supabase
      .from('locations')
      .update({ name: clinicDetails.name, code: clinicDetails.code })
      .eq('id', selectedClinicId);
    alert('Clinic details updated!');
  };

  const handleDeleteClinic = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete ${clinicDetails.name}? This will remove all associated limits and staff assignments.`)) return;
    
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', selectedClinicId);
      
    if (error) {
      alert("Failed to delete clinic.");
    } else {
      alert("Clinic deleted.");
      window.location.reload();
    }
  };


  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("Are you sure you want to remove this role?")) return;
    
    const { error } = await supabase
      .from('staffing_roles')
      .delete()
      .eq('id', roleId);
      
    if (error) {
      alert("Failed to delete role.");
    } else {
      setRoles(roles.filter(r => r.id !== roleId));
    }
  };

  const handleAddTimeOff = async (e) => {
    e.preventDefault();
    if (!newTimeOffName.trim() || !newTimeOffCode.trim()) return;
    const code = newTimeOffCode.trim().toUpperCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('time_off_types').insert({
      code,
      name: newTimeOffName.trim(),
      is_active: true
    });
    if (!error) {
      setTimeOffTypes([...timeOffTypes, { code, name: newTimeOffName.trim(), is_active: true }]);
      setNewTimeOffName('');
      setNewTimeOffCode('');
    } else {
      alert("Failed to add Time Off type. The code might already exist.");
    }
  };

  const handleDeleteTimeOff = async (code) => {
    if (!window.confirm("Are you sure you want to remove this time off type?")) return;
    const { error } = await supabase.from('time_off_types').delete().eq('code', code);
    if (!error) {
      setTimeOffTypes(timeOffTypes.filter(t => t.code !== code));
    } else {
      alert("Cannot delete this time off type. It may be currently in use by employee requests.");
    }
  };

  if (loading) return <Layout><div className="p-8">Loading settings...</div></Layout>;

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="font-h1 text-h1 text-on-surface">Settings</h2>
          <p className="text-on-surface-variant mt-1">Manage configuration for {clinicDetails.name}</p>
        </div>

        {/* Section A: Clinic Info */}
        <section className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50">
            <h3 className="font-semibold text-on-surface">Clinic Information</h3>
          </div>
          <form onSubmit={handleClinicUpdate} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Clinic Name</label>
                <input 
                  type="text" 
                  value={clinicDetails.name} 
                  onChange={e => setClinicDetails({ ...clinicDetails, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Clinic Code</label>
                <input 
                  type="text" 
                  value={clinicDetails.code} 
                  onChange={e => setClinicDetails({ ...clinicDetails, code: e.target.value })}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                Save Clinic Info
              </button>
              <button 
                type="button" 
                onClick={handleDeleteClinic}
                className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg font-semibold hover:bg-rose-50 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Delete Clinic
              </button>
            </div>
          </form>
        </section>


        {/* Section C: Staffing Roles */}
        <section className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-on-surface">Staffing Roles</h3>
            <button 
              onClick={() => {
                setRoleToEdit(null);
                setIsRoleModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-200"
            >
              Add New Role
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {roles.map(role => (
                <div key={role.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col relative group">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800">{role.name}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setRoleToEdit(role);
                          setIsRoleModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit Role"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove Role"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 mt-1">{role.description || 'No description'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section D: Time Off Legend */}
        <section className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden mb-12">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50">
            <h3 className="font-semibold text-on-surface">Time Off Legend</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-6">Manage the types of leave that employees can request (e.g. PTO, Sick Leave, FMLA).</p>
            
            <form onSubmit={handleAddTimeOff} className="flex gap-3 mb-8">
              <input 
                type="text" 
                placeholder="Code (e.g. ADN)"
                value={newTimeOffCode}
                onChange={e => setNewTimeOffCode(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-32 bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none font-mono"
              />
              <input 
                type="text" 
                placeholder="Description (e.g. Administrative)"
                value={newTimeOffName}
                onChange={e => setNewTimeOffName(e.target.value)}
                className="flex-1 max-w-xs bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none"
              />
              <button 
                type="submit" 
                disabled={!newTimeOffName.trim() || !newTimeOffCode.trim()}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-200 disabled:opacity-50 transition-colors"
              >
                Add Type
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {timeOffTypes.map(type => (
                <div key={type.code} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800">{type.name}</span>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{type.code}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDeleteTimeOff(type.code)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove Time Off Type"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {timeOffTypes.length === 0 && (
                <div className="text-sm text-slate-500 col-span-full">No time off types defined yet.</div>
              )}
            </div>
          </div>
        </section>

      </div>
      
      <CreateRoleModal 
        isOpen={isRoleModalOpen} 
        onClose={() => {
          setIsRoleModalOpen(false);
          setRoleToEdit(null);
          // Quick hack to reload after modal closes to show new roles
          window.location.reload(); 
        }} 
        departmentId={clinicDetails.parent_location_id || selectedClinicId}
        roleToEdit={roleToEdit}
      />
    </Layout>
  );
}
