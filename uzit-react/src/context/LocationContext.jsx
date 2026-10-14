import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const LocationContext = createContext({});

export function LocationProvider({ children }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState('');
  
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(false);

  // Synchronously clear clinics and selectedClinicId when switching departments
  // to prevent stale clinic data from a previous department leaking into views
  const setSelectedDepartmentId = useCallback((newDeptId) => {
    setSelectedDepartmentIdState((prevId) => {
      if (prevId !== newDeptId) {
        setClinics([]);
        setSelectedClinicId('');
        setLoadingClinics(true);
      }
      return newDeptId;
    });
  }, []);

  // Load Departments (Global Admin sees all departments; department staff/managers see only their assigned department)
  useEffect(() => {
    let isCancelled = false;

    async function fetchDepartments() {
      setLoadingDepartments(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .is('parent_location_id', null)
        .order('name');
      
      if (isCancelled) return;

      if (!error && data) {
        let accessibleDepts = data;

        // If logged-in user is NOT a global admin, restrict to their assigned department
        if (user && user.role !== 'admin') {
          const { data: profileData } = await supabase
            .from('employee_profiles')
            .select('department_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (isCancelled) return;

          if (profileData?.department_id) {
            accessibleDepts = data.filter(d => d.id === profileData.department_id);
          }
        }

        setDepartments(accessibleDepts);
        if (accessibleDepts.length > 0) {
          setSelectedDepartmentIdState(prev => {
            if (prev && accessibleDepts.some(d => d.id === prev)) {
              return prev;
            }
            // Prefer Urgent Care as initial default if available, otherwise first department
            const defaultDept = accessibleDepts.find(d => d.name === 'Urgent Care') || accessibleDepts[0];
            return defaultDept.id;
          });
        } else {
          setSelectedDepartmentIdState('');
        }
      }
      setLoadingDepartments(false);
    }

    fetchDepartments();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Load Clinics when Department changes
  useEffect(() => {
    if (!selectedDepartmentId) {
      setClinics([]);
      setSelectedClinicId('');
      setLoadingClinics(false);
      return;
    }

    let isCancelled = false;

    async function fetchClinics() {
      setLoadingClinics(true);
      setClinics([]);
      setSelectedClinicId('');

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('parent_location_id', selectedDepartmentId)
        .order('name');
      
      if (isCancelled) return;

      if (!error && data) {
        setClinics(data);
        if (data.length > 0) {
          if (window.location.pathname === '/manager/calendar') {
            setSelectedClinicId('ALL');
          } else {
            setSelectedClinicId(data[0].id);
          }
        } else {
          setSelectedClinicId('');
        }
      }
      setLoadingClinics(false);
    }

    fetchClinics();
    return () => {
      isCancelled = true;
    };
  }, [selectedDepartmentId]);

  return (
    <LocationContext.Provider value={{
      departments,
      selectedDepartmentId,
      setSelectedDepartmentId,
      clinics,
      selectedClinicId,
      setSelectedClinicId,
      loadingDepartments,
      loadingClinics
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  return useContext(LocationContext);
}
