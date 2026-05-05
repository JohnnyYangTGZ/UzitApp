import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'manager') navigate('/manager');
      else navigate('/staff');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter an email address and password.');
      return;
    }

    try {
      const user = await login(email, password);
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'manager') {
        navigate('/manager');
      } else {
        navigate('/staff');
      }
    } catch (err) {
      setError('Failed to log in: ' + err.message);
    }
  };

  return (
    <div className="bg-surface-background min-h-screen flex items-center justify-center p-6">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-border overflow-hidden">
        {/* Left Side: Hero Branding */}
        <div className="relative hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#00B4FF] to-[#7B5CFF]">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <img alt="Healthcare Environment" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4R82Q17SP6cfKCx96oNkh9nvCgmaxBBLT-Ewkcm5t00GOqh6Lvjbt5RwTil5i5hVposR3121i0haW4PvY4rD-TkRzA8Vd66f_ESmBu6Q_bhDIFCkNHxvja_O0hOJG9IB-h8f_m8ZPHtqi0kTTITqVt38T_x17vcS6NQIjhzjikrbfpwnp55AQxWZY3zvs11E-UeEOLObnuhujSftpLyaWtWEgNvJbxZ9Tx3IOrwApgmqbxTyb3tMfIUFgAumVIQdSech_asNFKV1X"/>
          </div>
          <div className="relative z-10">
            <div className="mb-8">
              <img src="/logo.png" alt="Uzit Logo" className="h-24 w-auto drop-shadow-md" />
            </div>
          </div>
          <div className="relative z-10 mt-auto">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <span className="text-white/90 font-label-sm text-label-sm uppercase">Join the new wave of Healthcare Staffing.</span>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-surface-container-lowest">
          <div className="mb-10 text-center md:text-left">
            <h3 className="text-on-surface font-h3 text-h3 mb-2">Welcome Back</h3>
            <p className="text-on-surface-variant font-body-md text-body-md">Sign in to manage your center's operations.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-on-surface-variant font-label-sm text-label-sm mb-2 uppercase" htmlFor="email">Email Address</label>
                <input 
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none text-on-surface font-body-md" 
                  id="email" 
                  name="email" 
                  placeholder="name@outpatient.center" 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-on-surface-variant font-label-sm text-label-sm uppercase" htmlFor="password">Password</label>
                <input 
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none text-on-surface font-body-md" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••" 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-error font-body-md">{error}</p>}

            <button 
              className="w-full py-4 bg-secondary text-on-primary font-h3 text-body-lg rounded-lg shadow-sm hover:brightness-110 active:scale-98 transition-all disabled:opacity-50" 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-on-surface-variant font-body-md text-body-md">
              Secure access for authorized personnel only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
