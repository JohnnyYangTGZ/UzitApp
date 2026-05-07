-- Add staffing_role to shifts table to support Ad-Hoc open shifts
ALTER TABLE shifts ADD COLUMN staffing_role text;
