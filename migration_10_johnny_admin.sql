-- Create User JohnnyYang@tgzstudios.com
INSERT INTO users (id, name, email, password, role) VALUES 
('11111111-1111-1111-1111-111111111199', 'Johnny Yang', 'JohnnyYang@tgzstudios.com', 'Stb76194382465!', 'admin');

-- Create Employee Profile
INSERT INTO employee_profiles (user_id, employee_code, job_title, staffing_role, phone_number, shift_time, is_on_call, department_id, schedule_pattern) VALUES 
('11111111-1111-1111-1111-111111111199', 'EMP-JOHNNY', 'System Administrator', 'admin', NULL, NULL, false, '11111111-1111-1111-1111-111111111100', '[false,false,false,false,false,false,false,false,false,false,false,false,false,false]'::jsonb);

-- Grant access to all clinics
INSERT INTO employee_clinics (user_id, clinic_id) VALUES 
('11111111-1111-1111-1111-111111111199', '11111111-1111-1111-1111-111111111101'), -- Geary
('11111111-1111-1111-1111-111111111199', '11111111-1111-1111-1111-111111111102'); -- Mission Bay

-- Remove old admin/manager profiles
DELETE FROM users WHERE email IN ('admin@example.com', 'manager@example.com');
