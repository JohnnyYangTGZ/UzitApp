-- Add start and end time columns to shifts table for ad-hoc shifts
ALTER TABLE shifts
ADD COLUMN start_time time,
ADD COLUMN end_time time;
