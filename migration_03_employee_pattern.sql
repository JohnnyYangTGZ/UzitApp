-- Add 2-week schedule pattern to employee_profiles
-- It will use the exact same boolean array structure (length 14) as coverage_requirements.
ALTER TABLE employee_profiles
ADD COLUMN schedule_pattern boolean[] DEFAULT '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'::boolean[];
