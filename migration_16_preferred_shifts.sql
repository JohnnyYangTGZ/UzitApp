-- Add preferred_shifts array column to employee_profiles
ALTER TABLE employee_profiles 
ADD COLUMN IF NOT EXISTS preferred_shifts text[] DEFAULT '{}'::text[];
