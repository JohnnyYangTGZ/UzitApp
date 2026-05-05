-- Add 2-week schedule pattern to coverage_requirements
-- It will be a boolean array of length 14, where index 0 is Week 1 Monday, and index 13 is Week 2 Sunday.
ALTER TABLE coverage_requirements
ADD COLUMN schedule_pattern boolean[] DEFAULT '{false,false,false,false,false,false,false,false,false,false,false,false,false,false}'::boolean[];
