-- Migration: Add partial day support to time_off_requests
-- Adds start_time and end_time columns

ALTER TABLE time_off_requests 
ADD COLUMN start_time time,
ADD COLUMN end_time time;

-- We don't need a NOT NULL constraint since partial day is optional,
-- meaning if they take the full day off, these columns will be NULL.
