import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('uzit_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      const storedActiveRole = localStorage.getItem('uzit_active_role');
      setActiveRole(storedActiveRole || parsedUser.role);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();
      
      if (error) throw error;
      if (data) {
        setUser(data);
        setActiveRole(data.role);
        localStorage.setItem('uzit_user', JSON.stringify(data));
        localStorage.setItem('uzit_active_role', data.role);
        return data;
      }
    } catch (err) {
      console.error('Login error:', err.message);
      // Fallback for prototype if user doesn't exist in DB: auto-create or mock
      if (err.code === 'PGRST116') { // no rows returned
        // Provide a clearer error message since password might be wrong
        throw new Error('Invalid email or password');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setActiveRole(null);
    localStorage.removeItem('uzit_user');
    localStorage.removeItem('uzit_active_role');
  };

  const switchRole = (newRole) => {
    setActiveRole(newRole);
    localStorage.setItem('uzit_active_role', newRole);
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, switchRole, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
