import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { useLocationContext } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import ScheduleSelector, { DEFAULT_PATTERN } from '../components/ScheduleSelector';

export default function Employees() {
  const { selectedDepartmentId, clinics } = useLocationContext();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState([]);
  
  const { user: currentUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone_number: '',
    staffing_role: '',
    shift_time: '',
    is_on_call: false,
    schedulePattern: DEFAULT_PATTERN,
    clinics: [], // Array of clinic_ids
    secondary_roles: [], // Array of secondary role strings
    systemRole: 'staff',
    newPassword: ''
  });

  async function loadEmployees() {
    if (!selectedDepartmentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
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
          role,
          employee_clinics (
            clinic_id,
            locations ( id, name )
          )
        )
      `)
      .eq('department_id', selectedDepartmentId)
      .order('employee_code');

    if (error) {
      console.error('Error fetching employees:', error);
      setErrorMsg(error.message || JSON.stringify(error));
    } else if (data) {
      const sortedData = [...data].sort((a, b) => {
        const nameA = a.users?.name || '';
        const nameB = b.users?.name || '';
        return nameA.localeCompare(nameB);
      });

      setEmployees(sortedData);
      setErrorMsg('');
      
      if (selectedEmployee) {
        const updatedEmployee = sortedData.find(e => e.user_id === selectedEmployee.user_id);
        if (updatedEmployee) {
          setSelectedEmployee(updatedEmployee);
        } else {
          setSelectedEmployee(sortedData.length > 0 ? sortedData[0] : null);
        }
      } else {
        setSelectedEmployee(sortedData.length > 0 ? sortedData[0] : null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, [selectedDepartmentId]);

  async function loadRoles() {
    if (!selectedDepartmentId) return;
    const { data, error } = await supabase
      .from('staffing_roles')
      .select('name, description')
      .eq('department_id', selectedDepartmentId)
      .eq('is_active', true);
    if (!error && data) {
      setAvailableRoles(data.sort((a,b) => a.name.localeCompare(b.name)));
    }
  }

  const getRoleDescription = (roleName) => {
    const role = availableRoles.find(r => r.name === roleName);
    return role?.description || roleName || 'Role';
  };

  useEffect(() => {
    const handleOpenNewEmployee = () => {
      setSelectedEmployee(null);
      setEditForm({
        firstName: '',
        lastName: '',
        email: '',
        phone_number: '',
        staffing_role: 'RN',
        shift_time: '',
        is_on_call: false,
        schedulePattern: DEFAULT_PATTERN,
        clinics: clinics.length > 0 ? [clinics[0].id] : [],
        secondary_roles: [],
        systemRole: 'staff',
        newPassword: '',
        seniority_date: ''
      });
      setIsCreating(true);
      setIsEditing(true);
    };

    window.addEventListener('open-new-employee', handleOpenNewEmployee);
    return () => window.removeEventListener('open-new-employee', handleOpenNewEmployee);
  }, [clinics]);

  const handleEditClick = () => {
    const nameParts = (selectedEmployee.users?.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Extract clinic IDs
    const clinicIds = (selectedEmployee.users?.employee_clinics || []).map(ec => ec.clinic_id || ec.locations?.id).filter(Boolean);

    setEditForm({
      firstName,
      lastName,
      email: selectedEmployee.users?.email || '',
      phone_number: selectedEmployee.phone_number || '',
      staffing_role: selectedEmployee.staffing_role || '',
      shift_time: selectedEmployee.shift_time || '',
      is_on_call: selectedEmployee.is_on_call || false,
      schedulePattern: selectedEmployee.schedule_pattern || DEFAULT_PATTERN,
      clinics: clinicIds,
      secondary_roles: selectedEmployee.secondary_roles || [],
      systemRole: selectedEmployee.users?.role || 'staff',
      newPassword: '',
      seniority_date: selectedEmployee.seniority_date || ''
    });
    setIsEditing(true);
  };

  const handleDiscard = () => {
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleClinicToggle = (clinicId) => {
    setEditForm(prev => {
      const isSelected = prev.clinics.includes(clinicId);
      if (isSelected) {
        return { ...prev, clinics: prev.clinics.filter(id => id !== clinicId) };
      } else {
        return { ...prev, clinics: [...prev.clinics, clinicId] };
      }
    });
  };

  const handleSecondaryRoleToggle = (roleName) => {
    setEditForm(prev => {
      const isSelected = prev.secondary_roles.includes(roleName);
      if (isSelected) {
        return { ...prev, secondary_roles: prev.secondary_roles.filter(r => r !== roleName) };
      } else {
        return { ...prev, secondary_roles: [...prev.secondary_roles, roleName] };
      }
    });
  };

  const handleSave = async () => {
    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      alert("Please provide at least a First Name, Last Name, and Email.");
      return;
    }

    const fullName = `${editForm.firstName} ${editForm.lastName}`.trim();
    
    if (isCreating) {
      // Create new user
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          name: fullName,
          email: editForm.email,
          role: currentUser?.role === 'admin' ? editForm.systemRole : 'staff',
          password: editForm.newPassword || 'password123' // Use custom or default
        })
        .select()
        .single();
        
      if (userError) {
        console.error('Error creating user:', userError);
        alert('Failed to create user: ' + userError.message);
        return;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('employee_profiles')
        .insert({
          user_id: newUser.id,
          department_id: selectedDepartmentId,
          employee_code: `${editForm.staffing_role}-${Math.floor(Math.random() * 1000)}`,
          job_title: `${getRoleDescription(editForm.staffing_role)}${editForm.is_on_call ? ' (on-call)' : ''}`,
          phone_number: editForm.phone_number,
          staffing_role: editForm.staffing_role,
          shift_time: editForm.shift_time,
          is_on_call: editForm.is_on_call,
          schedule_pattern: editForm.schedulePattern,
          secondary_roles: editForm.secondary_roles,
          seniority_date: editForm.seniority_date
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        alert('Failed to create profile: ' + profileError.message);
        return;
      }

      // Insert clinics
      if (editForm.clinics.length > 0) {
        const clinicInserts = editForm.clinics.map(cid => ({
          user_id: newUser.id,
          clinic_id: cid
        }));
        await supabase.from('employee_clinics').insert(clinicInserts);
      }
    } else {
      // Update users table (name, email, conditionally role/password)
      const userUpdatePayload = { name: fullName, email: editForm.email };
      if (currentUser?.role === 'admin') {
        userUpdatePayload.role = editForm.systemRole;
        if (editForm.newPassword) {
          userUpdatePayload.password = editForm.newPassword;
        }
      }

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdatePayload)
        .eq('id', selectedEmployee.user_id);
        
      if (userError) {
        console.error('Error updating user:', userError);
        alert('Failed to update user: ' + userError.message);
        return;
      }

      // Update employee_profiles table (phone, role, shift, on-call)
      const { error: profileError } = await supabase
        .from('employee_profiles')
        .update({
          phone_number: editForm.phone_number,
          staffing_role: editForm.staffing_role,
          job_title: `${getRoleDescription(editForm.staffing_role)}${editForm.is_on_call ? ' (on-call)' : ''}`,
          shift_time: editForm.shift_time,
          is_on_call: editForm.is_on_call,
          schedule_pattern: editForm.schedulePattern,
          secondary_roles: editForm.secondary_roles
        })
        .eq('user_id', selectedEmployee.user_id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        alert('Failed to update profile: ' + profileError.message);
        return;
      }

      // Update employee_clinics table
      // 1. Delete all existing for this user
      await supabase.from('employee_clinics').delete().eq('user_id', selectedEmployee.user_id);
      
      // 2. Insert new ones if any
      if (editForm.clinics.length > 0) {
        const clinicInserts = editForm.clinics.map(cid => ({
          user_id: selectedEmployee.user_id,
          clinic_id: cid
        }));
        const { error: clinicError } = await supabase.from('employee_clinics').insert(clinicInserts);
        if (clinicError) {
          console.error('Error updating clinics:', clinicError);
          alert('Failed to update clinics: ' + clinicError.message);
        }
      }
    }

    setIsCreating(false);
    setIsEditing(false);
    loadEmployees();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to completely delete ${selectedEmployee.users?.name}? This action cannot be undone.`)) return;

    try {
      // Manual cascade delete
      await supabase.from('employee_clinics').delete().eq('user_id', selectedEmployee.user_id);
      await supabase.from('employee_profiles').delete().eq('user_id', selectedEmployee.user_id);
      
      const { error } = await supabase.from('users').delete().eq('id', selectedEmployee.user_id);
      
      if (error) throw error;

      setSelectedEmployee(null);
      loadEmployees();
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert('Failed to delete employee: ' + err.message);
    }
  };

  const uniqueRoles = ['All', ...availableRoles.map(r => r.name)];
  const filteredEmployees = roleFilter === 'All' 
    ? employees 
    : employees.filter(e => e.staffing_role === roleFilter);

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface">Employees</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">Manage staff across the department</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 border border-surface-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700 uppercase tracking-wider"
              >
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* Table Area (Left) */}
          <div className="flex-1 bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase border-b border-slate-200">Name</th>
                    <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase border-b border-slate-200">Role</th>
                    <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase border-b border-slate-200">Shift</th>
                    <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase border-b border-slate-200">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading employees...</td>
                    </tr>
                  ) : errorMsg ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-red-500 font-medium">Error: {errorMsg}</td>
                    </tr>
                  ) : filteredEmployees.length > 0 ? (
                    filteredEmployees.map(emp => {
                      const isSelected = selectedEmployee?.user_id === emp.user_id;
                      return (
                        <tr 
                          key={emp.user_id} 
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setIsCreating(false);
                            setIsEditing(false);
                          }}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-primary' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                                {emp.users?.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{emp.users?.name}</p>
                                <p className="text-xs text-slate-500">{emp.users?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{emp.job_title}</p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">{emp.staffing_role}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-700">
                              {emp.seniority_date ? new Date(emp.seniority_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                              {emp.shift_time || 'Variable'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {emp.is_on_call ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                On-Call
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Scheduled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No employees found for this filter/department.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Datacard Area (Right) */}
          <div className="w-[450px] flex-shrink-0">
            {selectedEmployee || isCreating ? (
              <div className="bg-white border border-surface-border rounded-xl shadow-md h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Datacard Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-3xl mb-4 border-4 border-white shadow-sm uppercase">
                    {isCreating ? '?' : selectedEmployee?.users?.name?.charAt(0) || '?'}
                  </div>
                  {isEditing ? (
                    <div className="w-full flex gap-2">
                      <input 
                        type="text" 
                        value={editForm.firstName} 
                        onChange={e => setEditForm({...editForm, firstName: e.target.value})}
                        className="w-1/2 px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="First Name"
                      />
                      <input 
                        type="text" 
                        value={editForm.lastName} 
                        onChange={e => setEditForm({...editForm, lastName: e.target.value})}
                        className="w-1/2 px-3 py-2 border border-slate-300 rounded-md text-sm"
                        placeholder="Last Name"
                      />
                    </div>
                  ) : (
                    <h3 className="font-h3 text-h3 text-slate-900">{selectedEmployee?.users?.name}</h3>
                  )}
                  <p className="text-primary font-semibold mt-1">
                    {isEditing 
                      ? `${getRoleDescription(editForm.staffing_role)}${editForm.is_on_call ? ' (on-call)' : ''}` 
                      : (selectedEmployee?.job_title || 'New Employee')}
                  </p>
                  {!isCreating && <p className="text-xs text-slate-500 font-mono mt-1">Employee ID: {selectedEmployee?.employee_code}</p>}
                </div>

                {/* Datacard Body */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                  
                  {/* Contact Info */}
                  <div>
                    <h4 className="font-label-sm text-label-sm text-slate-500 uppercase tracking-wider mb-3">Contact Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                        {isEditing ? (
                          <input 
                            type="email" 
                            value={editForm.email} 
                            onChange={e => setEditForm({...editForm, email: e.target.value})}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                            placeholder="Email address"
                          />
                        ) : (
                          <a href={`mailto:${selectedEmployee?.users?.email}`} className="text-sm text-slate-700 hover:text-primary transition-colors">{selectedEmployee?.users?.email}</a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400 text-sm">phone</span>
                        {isEditing ? (
                          <input 
                            type="tel" 
                            value={editForm.phone_number} 
                            onChange={e => setEditForm({...editForm, phone_number: e.target.value})}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                            placeholder="Phone number"
                          />
                        ) : (
                          <a href={`tel:${selectedEmployee?.phone_number}`} className="text-sm text-slate-700 hover:text-primary transition-colors">{selectedEmployee?.phone_number || 'No phone provided'}</a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* System Access (Admins Only) */}
                  {currentUser?.role === 'admin' && (
                    <div>
                      <h4 className="font-label-sm text-label-sm text-slate-500 uppercase tracking-wider mb-3">System Access</h4>
                      <div className="bg-orange-50 rounded-lg p-4 space-y-4 border border-orange-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-orange-800 font-medium">Access Level</span>
                          {isEditing ? (
                            <select
                              value={editForm.systemRole}
                              onChange={e => setEditForm({...editForm, systemRole: e.target.value})}
                              className="px-2 py-1 border border-orange-300 rounded text-sm bg-white w-32 focus:ring-1 focus:ring-orange-500 outline-none"
                            >
                              <option value="staff">Staff</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                              selectedEmployee?.users?.role === 'admin' ? 'bg-red-100 text-red-700' :
                              selectedEmployee?.users?.role === 'manager' ? 'bg-orange-200 text-orange-800' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {selectedEmployee?.users?.role || 'staff'}
                            </span>
                          )}
                        </div>
                        {isEditing && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-orange-800 font-medium">Reset Password</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newPass = window.prompt(isCreating ? "Enter initial password:" : "Enter new password for this user:", "");
                                if (newPass !== null && newPass.trim() !== '') {
                                  setEditForm({...editForm, newPassword: newPass});
                                }
                              }}
                              className="px-3 py-1 bg-white text-orange-700 hover:bg-orange-100 border border-orange-300 rounded text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              {editForm.newPassword ? (
                                <>
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                  Will Reset
                                </>
                              ) : (
                                "Set Password"
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Operational Details */}
                  <div>
                    <h4 className="font-label-sm text-label-sm text-slate-500 uppercase tracking-wider mb-3">Operational Details</h4>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-4 border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">Seniority Date</span>
                        {isEditing ? (
                          <input 
                            type="date"
                            value={editForm.seniority_date}
                            onChange={e => setEditForm({...editForm, seniority_date: e.target.value})}
                            className="px-2 py-1.5 border border-slate-300 rounded text-xs w-[140px] focus:ring-1 focus:ring-primary outline-none text-slate-700"
                            required
                          />
                        ) : (
                          <span className="text-sm font-semibold text-slate-700">
                            {selectedEmployee?.seniority_date ? new Date(selectedEmployee.seniority_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Not set'}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">Standard Shift</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input 
                              type="time" 
                              value={(editForm.shift_time || '').split('-')[0] || ''} 
                              onChange={e => {
                                const end = (editForm.shift_time || '').split('-')[1] || '';
                                const start = e.target.value;
                                setEditForm({...editForm, shift_time: start || end ? `${start}-${end}` : ''});
                              }}
                              className="px-2 py-1.5 border border-slate-300 rounded text-xs w-[105px] font-mono focus:ring-1 focus:ring-primary outline-none text-slate-700"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input 
                              type="time" 
                              value={(editForm.shift_time || '').split('-')[1] || ''} 
                              onChange={e => {
                                const start = (editForm.shift_time || '').split('-')[0] || '';
                                const end = e.target.value;
                                setEditForm({...editForm, shift_time: start || end ? `${start}-${end}` : ''});
                              }}
                              className="px-2 py-1.5 border border-slate-300 rounded text-xs w-[105px] font-mono focus:ring-1 focus:ring-primary outline-none text-slate-700"
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-slate-900 font-mono">{selectedEmployee?.shift_time || 'Variable'}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">Staffing Role</span>
                        {isEditing ? (
                          <select
                            value={editForm.staffing_role}
                            onChange={e => setEditForm({...editForm, staffing_role: e.target.value})}
                            className="px-2 py-1 border border-slate-300 rounded text-sm uppercase tracking-wider bg-white w-32"
                          >
                            <option value="" disabled>Select Role</option>
                            {availableRoles.map(role => (
                              <option key={role.name} value={role.name}>{role.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded uppercase tracking-wider">{selectedEmployee?.staffing_role}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">On-Call Status</span>
                        {isEditing ? (
                          <select 
                            value={editForm.is_on_call ? 'yes' : 'no'}
                            onChange={e => setEditForm({...editForm, is_on_call: e.target.value === 'yes'})}
                            className="px-2 py-1 border border-slate-300 rounded text-sm bg-white w-24"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <span className="text-sm font-semibold text-slate-900">{selectedEmployee?.is_on_call ? 'Yes' : 'No'}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-slate-500 font-medium">Secondary Roles</span>
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            availableRoles.filter(r => r.name !== editForm.staffing_role).map(role => {
                              const isSelected = editForm.secondary_roles.includes(role.name);
                              return (
                                <button
                                  key={role.name}
                                  onClick={() => handleSecondaryRoleToggle(role.name)}
                                  className={`text-xs px-2 py-1 rounded-full font-medium border transition-colors flex items-center gap-1 ${
                                    isSelected 
                                      ? 'bg-purple-600 text-white border-purple-600' 
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {isSelected && <span className="material-symbols-outlined text-[12px]">check</span>}
                                  {role.name}
                                </button>
                              );
                            })
                          ) : selectedEmployee?.secondary_roles?.length > 0 ? (
                            selectedEmployee.secondary_roles.map((sr, idx) => (
                              <span key={idx} className="bg-purple-50 text-purple-700 border border-purple-100 text-xs px-2 py-1 rounded-full font-medium tracking-wider uppercase">
                                {sr}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500 italic">No secondary roles.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Pattern */}
                  <div>
                    <h4 className="font-label-sm text-label-sm text-slate-500 uppercase tracking-wider mb-3">2-Week Schedule</h4>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <ScheduleSelector 
                        pattern={isEditing ? editForm.schedulePattern : selectedEmployee?.schedule_pattern} 
                        onChange={p => setEditForm({ ...editForm, schedulePattern: p })}
                        readonly={!isEditing}
                      />
                    </div>
                  </div>

                  {/* Clinics Support */}
                  <div>
                    <h4 className="font-label-sm text-label-sm text-slate-500 uppercase tracking-wider mb-3">Supported Clinics</h4>
                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        clinics.map(clinic => {
                          const isSelected = editForm.clinics.includes(clinic.id);
                          return (
                            <button
                              key={clinic.id}
                              onClick={() => handleClinicToggle(clinic.id)}
                              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex items-center gap-1 ${
                                isSelected 
                                  ? 'bg-blue-600 text-white border-blue-600' 
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                              {clinic.name}
                            </button>
                          );
                        })
                      ) : selectedEmployee?.users?.employee_clinics?.length > 0 ? (
                        selectedEmployee.users.employee_clinics.map((ec, idx) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-3 py-1.5 rounded-full font-medium">
                            {ec.locations?.name || 'Unknown Clinic'}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 italic">No clinic assignments.</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Datacard Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                  {isEditing ? (
                    <>
                      <button onClick={handleDiscard} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                        Discard
                      </button>
                      <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleEditClick} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                        Edit Profile
                      </button>
                      <button onClick={handleDelete} className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors flex justify-center items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Delete
                      </button>
                    </>
                  )}
                </div>

              </div>
            ) : (
              <div className="h-full bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <span className="material-symbols-outlined text-4xl mb-3 opacity-50">person_search</span>
                <p className="font-medium text-slate-600">No employee selected</p>
                <p className="text-sm mt-1">Click on any employee in the table to view their full details here.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
