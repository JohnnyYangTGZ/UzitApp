-- Add seniority_date to employee_profiles
ALTER TABLE public.employee_profiles
ADD COLUMN IF NOT EXISTS seniority_date DATE;
