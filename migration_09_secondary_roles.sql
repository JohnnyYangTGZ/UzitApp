-- Add secondary_roles array column to employee_profiles
ALTER TABLE employee_profiles 
ADD COLUMN IF NOT EXISTS secondary_roles text[] DEFAULT '{}'::text[];
