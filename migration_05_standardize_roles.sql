-- 1. Standardize existing employee roles from the messy spreadsheet import
UPDATE employee_profiles 
SET staffing_role = 'MA' 
WHERE UPPER(staffing_role) IN ('MEDICAL ASSISTANT', 'MEDICAL_ASSISTANT');

UPDATE employee_profiles 
SET staffing_role = 'RN' 
WHERE UPPER(staffing_role) IN ('NURSE', 'REGISTERED NURSE');

UPDATE employee_profiles 
SET staffing_role = 'MD' 
WHERE UPPER(staffing_role) IN ('PHYSICIAN');

UPDATE employee_profiles 
SET staffing_role = 'MANAGER' 
WHERE UPPER(staffing_role) IN ('ADMIN');

-- 2. Fix duplicated RECEPTION roles that might have been accidentally created
DELETE FROM staffing_roles WHERE name = 'RECEPTION';

-- Update anyone who was 'RECEPTION' in the spreadsheet to use your new 'REC' role
UPDATE employee_profiles 
SET staffing_role = 'REC' 
WHERE UPPER(staffing_role) IN ('RECEPTION', 'RECEPTIONIST');

-- 3. Update all existing job_titles to match our new format rule
UPDATE employee_profiles ep
SET job_title = sr.description
FROM staffing_roles sr
WHERE ep.staffing_role = sr.name
  AND ep.is_on_call = false;

UPDATE employee_profiles ep
SET job_title = sr.description || ' (on-call)'
FROM staffing_roles sr
WHERE ep.staffing_role = sr.name
  AND ep.is_on_call = true;
