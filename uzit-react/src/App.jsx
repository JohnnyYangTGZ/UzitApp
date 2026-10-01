import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import Login from './pages/Login';
import StaffDashboard from './pages/StaffDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerCalendar from './pages/ManagerCalendar';
import CreateClinic from './pages/CreateClinic';
import AdminPatternBuilder from './pages/AdminPatternBuilder';
import StaffSchedule from './pages/StaffSchedule';
import WeeklyBoard from './pages/WeeklyBoard';
import AdminDashboard from './pages/AdminDashboard';
import Employees from './pages/Employees';
import ManagerEmployees from './pages/ManagerEmployees';
import ShiftsBuilder from './pages/ShiftsBuilder';
import Scheduler from './pages/Scheduler';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, activeRole, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/" />;
  
  const currentRole = activeRole || user.role;
  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    if (currentRole === 'admin') return <Navigate to="/admin" />;
    if (currentRole === 'manager') return <Navigate to="/manager" />;
    return <Navigate to="/staff" />;
  }

  return children;
};

function AppRoutes() {
  const { user, activeRole } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route 
        path="/staff" 
        element={
          <ProtectedRoute allowedRoles={['staff', 'manager', 'admin']}>
            <StaffDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/my-schedule" 
        element={
          <ProtectedRoute allowedRoles={['staff', 'manager', 'admin']}>
            <StaffSchedule />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manager" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manager/calendar" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <ManagerCalendar />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/shifts" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <ShiftsBuilder />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/patterns" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <AdminPatternBuilder />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/employees" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            {activeRole === 'admin' ? <Employees /> : <ManagerEmployees />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/scheduler" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <Scheduler />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/clinic" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <CreateClinic />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LocationProvider>
    </AuthProvider>
  );
}
