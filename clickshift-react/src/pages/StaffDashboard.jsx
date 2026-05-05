import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import TimeOffRequestModal from '../components/TimeOffRequestModal';

export default function StaffDashboard() {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Staff';

  const [upcomingShift, setUpcomingShift] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Fetch shifts
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select(`
          id,
          shifts ( date, time_block, locations ( name ) )
        `)
        .eq('user_id', user.id);
        
      if (assignments) {
        const upcoming = assignments
          .filter(a => a.shifts && a.shifts.date >= todayStr)
          .sort((a, b) => new Date(a.shifts.date) - new Date(b.shifts.date))[0];
        setUpcomingShift(upcoming);
      }

      // Fetch recent time off requests
      const { data: requests } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);
      setRecentRequests(requests || []);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-status-approved';
      case 'rejected': return 'bg-red-100 text-status-declined';
      default: return 'bg-yellow-100 text-status-pending';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'hourglass_empty';
    }
  };

  return (
    <Layout>
      <header className="mb-10">
        <h1 className="font-h1 text-h1 text-on-surface">Staff Dashboard</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Welcome back, {firstName}. Here's your overview for today.</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          <section className="bg-primary text-on-primary rounded-xl p-8 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-label-sm font-label-sm">UPCOMING SHIFT</span>
              </div>
              
              {loading ? (
                <div className="text-primary-fixed-dim animate-pulse">Loading upcoming shift...</div>
              ) : upcomingShift ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <h2 className="font-h2 text-h2 mb-1">{upcomingShift.shifts.time_block} Shift</h2>
                      <p className="text-primary-fixed-dim font-body-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">calendar_today</span>
                        {formatDate(upcomingShift.shifts.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-primary-fixed-dim font-medium">{upcomingShift.shifts.time_block === 'Morning' ? '07:00 - 15:30' : '15:00 - 23:30'}</div>
                      <div className="text-primary-fixed-dim font-medium">8 Hours Total</div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-white/10 flex gap-6">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-fixed-dim">location_on</span>
                      <span className="text-sm font-bold">{upcomingShift.shifts.locations?.name || 'Assigned Clinic'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col md:items-start justify-between gap-6">
                  <div>
                    <h2 className="font-h2 text-h2 mb-1">No Upcoming Shifts</h2>
                    <p className="text-primary-fixed-dim font-body-lg">You do not have any scheduled shifts in the future.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
          </section>

          <section className="bg-white border border-surface-border rounded-xl shadow-sm">
            <div className="p-6 border-b border-surface-border flex items-center justify-between">
              <h3 className="font-h3 text-h3">Recent Requests</h3>
              <a className="text-primary font-semibold text-sm hover:underline" href="/my-schedule">View Calendar</a>
            </div>
            
            <div className="divide-y divide-surface-border">
              {loading ? (
                <div className="p-6 text-slate-500 text-center">Loading requests...</div>
              ) : recentRequests.length === 0 ? (
                <div className="p-6 text-slate-500 text-center">No recent time off requests.</div>
              ) : (
                recentRequests.map(req => (
                  <div key={req.id} className="p-6 flex items-center justify-between hover:bg-surface-background transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <span className="material-symbols-outlined">{getStatusIcon(req.status)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-on-surface">{req.time_off_type_code} Leave</div>
                        <div className="text-sm text-on-surface-variant">
                          {formatDate(req.start_date)} {req.start_date !== req.end_date ? ` - ${formatDate(req.end_date)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`${getStatusColor(req.status)} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
            <h3 className="font-h3 text-h3 mb-6">Time Off Balance</h3>
            <div className="space-y-6">
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Annual Leave</span>
                  <span className="text-lg font-bold text-on-surface">18 / 25 <span className="text-xs font-normal text-slate-400">days left</span></span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-700 rounded-full" style={{width: '72%'}}></div>
                </div>
              </div>
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-on-surface-variant">Sick Leave</span>
                  <span className="text-lg font-bold text-on-surface">8 / 10 <span className="text-xs font-normal text-slate-400">days left</span></span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 rounded-full" style={{width: '80%'}}></div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-8 py-3 border border-secondary text-secondary font-bold rounded-lg hover:bg-secondary-container transition-colors"
            >
              Request Time Off
            </button>
          </section>

          <section className="bg-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-surface-border">
              <h3 className="font-h3 text-h3">Operational Memo</h3>
            </div>
            <div className="p-0">
              <div className="h-48 relative">
                <img alt="Hospital Hallway" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAV7PhLrZYeRveeTZQ6CfVEjn_Q3JgOXImAQfS4tTwZfEAKHyLVzLOjaA-clTBH3S0Uxan3RFcRcyOu_P3jzh6pkNbo6FylsAzf0PEuu8CvpUrW9NERg1KdiajKZQW0yDvWfcfVCgurYNH6Ls4niqgFvIRTfRtek-GTfK3KV3LgxUCi8Xz8q2X8qXwPyqia0V9OxR10TiZMqit92Q39piAovw8D1caMaSrho6bPloPVk0NibuHpPVXUe7Ef8H8dlnz-VpBlYSwA31_H"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-1">Clinic Updates</div>
                  <div className="text-sm font-medium leading-tight">North Wing construction starting Monday. Please use Service Entrance B.</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {user && (
        <TimeOffRequestModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchData}
          userId={user.id}
        />
      )}
    </Layout>
  );
}
