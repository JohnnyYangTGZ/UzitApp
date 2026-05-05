-- Fix schedule_pattern column types to allow strings (custom shift times)
-- We use jsonb so that we can store a mix of booleans and strings without implicit casting.

ALTER TABLE employee_profiles 
ALTER COLUMN schedule_pattern DROP DEFAULT,
ALTER COLUMN schedule_pattern TYPE jsonb USING to_jsonb(schedule_pattern),
ALTER COLUMN schedule_pattern SET DEFAULT '[false,true,true,true,true,true,false,false,true,true,true,true,true,false]'::jsonb;

ALTER TABLE coverage_requirements 
ALTER COLUMN schedule_pattern DROP DEFAULT,
ALTER COLUMN schedule_pattern TYPE jsonb USING to_jsonb(schedule_pattern),
ALTER COLUMN schedule_pattern SET DEFAULT '[false,false,false,false,false,false,false,false,false,false,false,false,false,false]'::jsonb;
