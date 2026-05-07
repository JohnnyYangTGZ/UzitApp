import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const LocationContext = createContext({});

export function LocationProvider({ children }) {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(false);

  // Load Departments
  useEffect(() => {
    async function fetchDepartments() {
      setLoadingDepartments(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .is('parent_location_id', null)
        .order('name');
      
      if (!error && data) {
        setDepartments(data);
        if (data.length > 0) {
          setSelectedDepartmentId(data[0].id);
        }
      }
      setLoadingDepartments(false);
    }
    fetchDepartments();
  }, []);

  // Load Clinics when Department changes
  useEffect(() => {
    if (!selectedDepartmentId) return;

    async function fetchClinics() {
      setLoadingClinics(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('parent_location_id', selectedDepartmentId)
        .order('name');
      
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
