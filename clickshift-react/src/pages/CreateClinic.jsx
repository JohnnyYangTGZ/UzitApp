import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';

export default function CreateClinic() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchClinics();
  }, []);

  async function fetchClinics() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setClinics(data);
    if (error) console.error(error);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('locations')
      .insert([{ name, code }]);

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Clinic successfully created!');
      setName('');
      setCode('');
      fetchClinics();
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="font-h1 text-h1 text-on-surface">Clinic Administration</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Manage locations and top-level clinic settings.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
            <h2 className="font-h2 text-h2 mb-6 text-primary">Create New Clinic</h2>
            
            {message && (
              <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${message.startsWith('Error') ? 'bg-red-50 text-error' : 'bg-green-50 text-status-approved'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Clinic Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="e.g. Downtown Outpatient Center"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Clinic Code</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="e.g. DOC-01"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Initialize Clinic'}
              </button>
            </form>
          </section>

          <section className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
            <h2 className="font-h2 text-h2 mb-6 text-on-surface">Active Clinics</h2>
            
            {clinics.length === 0 ? (
              <div className="text-center py-10 bg-surface-container-low rounded-lg border border-dashed border-outline-variant text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">domain_disabled</span>
                <p>No clinics found in the database.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {clinics.map(clinic => (
                  <div key={clinic.id} className="py-4 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-fixed rounded-lg flex items-center justify-center text-on-primary-fixed font-bold">
                        {clinic.code ? clinic.code.substring(0,2) : 'CL'}
                      </div>
                      <div>
                        <div className="font-semibold text-on-surface">{clinic.name}</div>
                        <div className="text-sm text-on-surface-variant">{clinic.code || 'No Code'}</div>
                      </div>
                    </div>
                    <span className="bg-green-100 text-status-approved text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                      {clinic.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
