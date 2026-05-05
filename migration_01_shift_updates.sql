-- Add custom, unique ID for human-readable shift template identifiers
ALTER TABLE coverage_requirements
ADD COLUMN custom_id text UNIQUE;

-- Add explicit start and end times
ALTER TABLE coverage_requirements
ADD COLUMN start_time time,
ADD COLUMN end_time time;
