import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CreateRoleModal({ isOpen, onClose, departmentId, roleToEdit }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && roleToEdit) {
      setName(roleToEdit.name || '');
      setDescription(roleToEdit.description || '');
    } else if (isOpen && !roleToEdit) {
      setName('');
      setDescription('');
    }
  }, [isOpen, roleToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!departmentId) {
      setError("No department selected. Cannot create role.");
      setLoading(false);
      return;
    }

    try {
      if (roleToEdit) {
        const { error: updateError } = await supabase
          .from('staffing_roles')
          .update({
            name: name.toUpperCase().trim(),
            description: description.trim()
          })
          .eq('id', roleToEdit.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('staffing_roles')
          .insert({
            name: name.toUpperCase().trim(),
            description: description.trim(),
            department_id: departmentId,
            is_active: true
          });
        if (insertError) throw insertError;
      }
      
      onClose();
      setName('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600">badge</span>
            <h2 className="font-bold text-slate-900">{roleToEdit ? 'Edit Staff Type' : 'Create Staff Type'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Role Name (Code)</label>
            <input
              type="text"
              required
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 uppercase"
              placeholder="e.g. RN, LVN, MA"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 min-h-[100px]"
              placeholder="e.g. Registered Nurse"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : null}
              {roleToEdit ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
