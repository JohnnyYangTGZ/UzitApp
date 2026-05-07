import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProvideAvailabilityModal({ isOpen, onClose, onSuccess, userId, initialDate }) {
  const [date, setDate] = useState('');
  const [shiftTime, setShiftTime] = useState('08:00 - 17:00');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setShiftTime('08:00 - 17:00');
      setNotes('');
      setError(null);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !shiftTime) {
      setError('Please provide date and availability window.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('employee_availability')
        .upsert({
          user_id: userId,
          date: date,
          shift_time: shiftTime,
          notes: notes
        }, { onConflict: 'user_id,date' });

      if (upsertError) throw upsertError;
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Provide Availability</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <p className="text-sm text-slate-600 mb-6">
            Let your manager know you are available to pick up a shift on this day.
          </p>

          <form id="availability-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Available Time</label>
              <select 
                value={shiftTime}
                onChange={(e) => setShiftTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white"
                required
              >
                <option value="Any">Any Time</option>
                <option value="08:00 - 17:00">08:00 - 17:00 (Day)</option>
                <option value="12:00 - 20:00">12:00 - 20:00 (Swing)</option>
                <option value="08:00 - 12:00">08:00 - 12:00 (Morning only)</option>
                <option value="13:00 - 17:00">13:00 - 17:00 (Afternoon only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes (Optional)</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., I prefer working at the Geary clinic if possible..."
                className="w-full border border-slate-200 rounded-lg p-3 text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-50 focus:bg-white min-h-[80px] resize-y"
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="availability-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
