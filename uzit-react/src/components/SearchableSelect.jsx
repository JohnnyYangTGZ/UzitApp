import React, { useState, useRef, useEffect } from 'react';

export default function SearchableSelect({ options = [], value, onChange, placeholder, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const safeOptions = options || [];
  const selectedOption = safeOptions.find(o => o?.value === value);

  const filteredOptions = safeOptions.filter(o => 
    (o?.label || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const displayPlaceholder = safeOptions.length === 0 
    ? 'No employees available' 
    : (placeholder || 'Select an option...');

  return (
    <div className="relative" ref={ref}>
      {/* Hidden input to handle 'required' validation if needed by a parent form */}
      {required && (
        <input 
          tabIndex={-1}
          type="text" 
          required 
          value={value || ''} 
          onChange={() => {}} 
          style={{ opacity: 0, width: 1, height: 1, position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }} 
        />
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-lg p-2.5 text-xs cursor-pointer bg-white flex justify-between items-center transition-colors ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-slate-300 hover:border-slate-400'}`}
      >
        <span className={selectedOption ? "text-slate-800 font-medium" : "text-slate-400 font-normal"}>
          {selectedOption ? selectedOption.label : displayPlaceholder}
        </span>
        <span className={`material-symbols-outlined text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>
      
      {isOpen && (
        <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <input 
              autoFocus
              type="text"
              className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Type to search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map(option => (
              <div 
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${value === option.value ? 'bg-primary/5 text-primary font-semibold' : 'text-slate-700'}`}
              >
                {option.label}
              </div>
            )) : (
              <div className="px-4 py-4 text-center text-xs text-slate-400 italic">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
