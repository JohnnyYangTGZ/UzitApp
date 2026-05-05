import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useScheduleData } from '../hooks/useScheduleData';

export default function AdminPatternBuilder() {
  const { fetchPatterns, loading } = useScheduleData();
  const [patterns, setPatterns] = useState([]);

  // Demo location ID
  const DEMO_LOCATION_ID = '11111111-1111-1111-1111-111111111111';

  useEffect(() => {
    fetchPatterns(DEMO_LOCATION_ID).then(data => {
      setPatterns(data || []);
    });
  }, [fetchPatterns]);

  const renderShiftBlock = (shift, isWeekend) => {
    if (!shift || shift === 'OFF') {
      return (
        <div className="h-10 w-full rounded border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-400">
          OFF
        </div>
      );
    }
    if (shift === 'AM') {
      return (
        <div className="h-10 w-full rounded bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-[10px] text-primary">
          AM
        </div>
      );
    }
    if (shift === 'PM') {
      return (
        <div className="h-10 w-full rounded bg-blue-800 flex items-center justify-center font-bold text-[10px] text-white">
          PM
        </div>
      );
    }
    if (shift === 'FULL') {
      return (
        <div className="h-10 w-full rounded bg-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
          FULL
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface mb-2">2-Week Pattern Builder</h1>
            <p className="text-body-md text-on-surface-variant max-w-2xl">Configure master rotation patterns for specialized roles. Changes will propagate to the next scheduling cycle starting Oct 28th.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 border border-outline-variant text-primary font-semibold rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">file_download</span>
              Export
            </button>
            <button className="px-6 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-md">
              Save Pattern
            </button>
          </div>
        </div>

        {/* Dashboard Stats / Bento Grid Mini */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-surface-border flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant uppercase">Active Patterns</span>
            <span className="text-h2 font-h2 text-primary">{patterns.length}</span>
            <div className="mt-2 flex items-center gap-1 text-[12px] text-status-approved">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>All staff covered</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-surface-border flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant uppercase">Staff Assigned</span>
            <span className="text-h2 font-h2 text-primary">{patterns.length}</span>
            <span className="mt-2 text-[12px] text-on-surface-variant">100% of total clinical staff</span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-surface-border flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant uppercase">Cycle Overlap</span>
            <span className="text-h2 font-h2 text-status-pending">Low</span>
            <span className="mt-2 text-[12px] text-on-surface-variant">Weekend coverage warning</span>
          </div>
          <div className="bg-white p-5 rounded-xl border border-surface-border flex flex-col gap-1">
            <span className="font-label-sm text-on-surface-variant uppercase">Next Rotation</span>
            <span className="text-h2 font-h2 text-primary">Oct 28</span>
            <span className="mt-2 text-[12px] text-on-surface-variant">Pattern lock in 4 days</span>
          </div>
        </div>

        {/* Pattern Builder Grid Container */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex rounded-lg border border-outline-variant overflow-hidden">
                <button className="px-4 py-1.5 bg-white text-primary font-semibold text-sm">Week 1-2</button>
                <button className="px-4 py-1.5 bg-slate-100 text-slate-500 font-medium text-sm hover:bg-slate-200">Week 3-4</button>
              </div>
              <div className="h-6 w-px bg-slate-300"></div>
              <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filter by Role:
                <select className="border-none bg-transparent text-primary font-semibold focus:ring-0 text-sm py-0 outline-none">
                  <option>All Registered Nurses</option>
                  <option>Physician Assistants</option>
                  <option>Support Staff</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 mr-4 text-[12px] font-semibold text-slate-500">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200"></span> AM</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-800"></span> PM</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-600"></span> FULL</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></span> OFF</div>
              </div>
              <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading patterns...</div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-surface-border">
                    <th className="sticky-col bg-slate-50 px-6 py-4 border-r border-surface-border w-64 z-20">
                      <span className="font-label-sm text-on-surface-variant uppercase">Staff Member / Role</span>
                    </th>
                    <th className="text-center py-2 border-r border-slate-200 bg-blue-50/50 text-[11px] font-bold text-blue-900 tracking-widest uppercase" colSpan="7">Week One</th>
                    <th className="text-center py-2 bg-slate-100/50 text-[11px] font-bold text-slate-700 tracking-widest uppercase" colSpan="7">Week Two</th>
                  </tr>
                  <tr className="bg-white border-b border-surface-border">
                    <th className="sticky-col bg-white px-6 py-3 border-r border-surface-border z-20">
                      <div className="relative">
                        <input className="w-full pl-8 pr-3 py-1.5 border border-outline-variant rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="Search staff..." type="text" />
                        <span className="material-symbols-outlined absolute left-2 top-1.5 text-[18px] text-slate-400">search</span>
                      </div>
                    </th>
                    {/* Days */}
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <th key={i} className={`px-2 py-3 text-center border-r border-slate-100 font-data-tabular text-[12px] ${(i === 5 || i === 6 || i === 12 || i === 13) ? 'bg-slate-50 text-slate-400' : 'text-on-surface-variant'}`}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {patterns.map(pattern => (
                    <tr key={pattern.id} className="hover:bg-slate-50 group">
                      <td className="sticky-col bg-white group-hover:bg-slate-50 px-6 py-3 border-r border-surface-border z-20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xs">
                            {pattern.users?.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-data-tabular text-sm font-semibold text-on-surface">{pattern.users?.name}</div>
                            <div className="text-[11px] text-on-surface-variant">{pattern.users?.role}</div>
                          </div>
                        </div>
                      </td>
                      
                      {pattern.week_1.map((shift, i) => (
                        <td key={`w1-${i}`} className={`p-1 border-r ${i === 5 || i === 6 ? 'border-slate-200 bg-slate-50' : 'border-slate-100'}`}>
                          {renderShiftBlock(shift, i === 5 || i === 6)}
                        </td>
                      ))}
                      
                      {pattern.week_2.map((shift, i) => (
                        <td key={`w2-${i}`} className={`p-1 border-r ${i === 5 || i === 6 ? 'border-slate-200 bg-slate-50' : 'border-slate-100'}`}>
                          {renderShiftBlock(shift, i === 5 || i === 6)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {patterns.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-slate-500">No patterns found for this location.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-4 border-t border-surface-border bg-white flex items-center justify-between">
            <span className="text-sm text-on-surface-variant font-medium">Showing {patterns.length} of {patterns.length} total staff patterns</span>
            <div className="flex items-center gap-2">
              <button className="p-1 border rounded hover:bg-slate-50"><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
              <span className="text-sm font-semibold px-4">Page 1 of 1</span>
              <button className="p-1 border rounded hover:bg-slate-50"><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
            </div>
          </div>
        </div>

        {/* Footer Meta Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-primary/5 rounded-xl border border-primary/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary">gavel</span>
              <h3 className="font-h3 text-h3 text-primary">Applied Rules</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-status-approved text-[18px]">check_circle</span>
                Max 5 consecutive working days for all roles.
              </li>
              <li className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-status-approved text-[18px]">check_circle</span>
                Minimum 11 hours rest between shifts (Full shifts auto-validated).
              </li>
              <li className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-status-pending text-[18px]">warning</span>
                Weekend rotation: Staff must have 1 in every 3 weekends off (2 warnings found).
              </li>
            </ul>
            <button className="mt-6 text-sm font-bold text-primary hover:underline">Edit Clinical Rules →</button>
          </div>

          <div className="bg-white rounded-xl border border-surface-border p-6">
            <h3 className="font-h3 text-h3 mb-4">Recent Pattern Activity</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>
                <div>
                  <p className="text-sm font-semibold">Sarah Miller's pattern updated to Full Shifts</p>
                  <p className="text-[12px] text-on-surface-variant">By Admin Today at 10:15 AM</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5"></div>
                <div>
                  <p className="text-sm font-semibold">October Master Schedule Published</p>
                  <p className="text-[12px] text-on-surface-variant">Yesterday at 04:15 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
