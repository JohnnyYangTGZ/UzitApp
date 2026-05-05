-- SEED DATA SCRIPT
-- Clear existing data to avoid conflict errors
TRUNCATE TABLE shift_assignments, employee_clinics, users, employee_profiles, locations, coverage_requirements CASCADE;

-- 1. Create Locations
INSERT INTO locations (id, name, code, parent_location_id) VALUES 
('11111111-1111-1111-1111-111111111100', 'Urgent Care', 'DEPT-UC', NULL),
('11111111-1111-1111-1111-111111111101', 'Geary Clinic', 'CLN-GRY', '11111111-1111-1111-1111-111111111100'),
('11111111-1111-1111-1111-111111111102', 'Mission Bay Clinic', 'CLN-MB', '11111111-1111-1111-1111-111111111100');

-- 2. Create Users
INSERT INTO users (id, name, email, password, role) VALUES 
('22222222-2222-2222-2222-222222222201', 'System Admin', 'admin@example.com', 'admin123', 'admin'),
('22222222-2222-2222-2222-222222222202', 'Clinic Manager', 'manager@example.com', 'password123', 'manager'),

-- Mission Bay Staff (3)
('33333333-3333-3333-3333-333333333301', 'MB RN Alice', 'mb.rn1@example.com', 'password123', 'staff'),
('33333333-3333-3333-3333-333333333302', 'MB LVN Bob', 'mb.lvn1@example.com', 'password123', 'staff'),
('33333333-3333-3333-3333-333333333303', 'MB MA Charlie', 'mb.ma1@example.com', 'password123', 'staff'),

-- Geary RNs (3)
('44444444-4444-4444-4444-444444444401', 'Geary RN Sarah (M-Th)', 'gry.rn1@example.com', 'password123', 'staff'),
('44444444-4444-4444-4444-444444444402', 'Geary RN John (Tu-F)', 'gry.rn2@example.com', 'password123', 'staff'),
('44444444-4444-4444-4444-444444444403', 'Geary RN Mary (F-M)', 'gry.rn3@example.com', 'password123', 'staff'),

-- Geary LVNs (7)
('55555555-5555-5555-5555-555555555501', 'Geary LVN PT1 (M-Tu)', 'gry.lvn1@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555502', 'Geary LVN PT2 (W-Th)', 'gry.lvn2@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555503', 'Geary LVN PT3 (F-Su)', 'gry.lvn3@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555504', 'Geary LVN OnCall 1', 'gry.lvn4@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555505', 'Geary LVN OnCall 2', 'gry.lvn5@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555506', 'Geary LVN OnCall 3', 'gry.lvn6@example.com', 'password123', 'staff'),
('55555555-5555-5555-5555-555555555507', 'Geary LVN OnCall 4', 'gry.lvn7@example.com', 'password123', 'staff'),

-- Geary MAs (8)
('66666666-6666-6666-6666-666666666601', 'Geary MA FT1 (M-F)', 'gry.ma1@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666602', 'Geary MA FT2 (M-F)', 'gry.ma2@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666603', 'Geary MA FT3 (Sa-W)', 'gry.ma3@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666604', 'Geary MA FT4 (Th-M)', 'gry.ma4@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666605', 'Geary MA PT1 (Tu-Th)', 'gry.ma5@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666606', 'Geary MA PT2 (F-Su)', 'gry.ma6@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666607', 'Geary MA OnCall 1', 'gry.ma7@example.com', 'password123', 'staff'),
('66666666-6666-6666-6666-666666666608', 'Geary MA OnCall 2', 'gry.ma8@example.com', 'password123', 'staff');

-- 3. Create Employee Profiles
-- Department ID is '11111111-1111-1111-1111-111111111100'

INSERT INTO employee_profiles (user_id, employee_code, job_title, staffing_role, phone_number, shift_time, is_on_call, department_id, schedule_pattern) VALUES 
('22222222-2222-2222-2222-222222222201', 'EMP-ADMIN', 'System Administrator', 'admin', NULL, NULL, false, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),
('22222222-2222-2222-2222-222222222202', 'EMP-MGR', 'Clinic Manager', 'manager', '555-0000', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),

-- Mission Bay (M-F)
('33333333-3333-3333-3333-333333333301', 'MB-001', 'Registered Nurse', 'RN', '555-1001', '08:30-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('33333333-3333-3333-3333-333333333302', 'MB-002', 'Licensed Vocational Nurse', 'LVN', '555-1002', '08:30-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('33333333-3333-3333-3333-333333333303', 'MB-003', 'Medical Assistant', 'MA', '555-1003', '08:30-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),

-- Geary RNs
('44444444-4444-4444-4444-444444444401', 'GRY-RN-1', 'Registered Nurse', 'RN', '555-2001', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,false,false,false,true,true,true,true,false,false}'),
('44444444-4444-4444-4444-444444444402', 'GRY-RN-2', 'Registered Nurse', 'RN', '555-2002', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,false,true,true,true,true,false,false,false,true,true,true,true,false}'),
('44444444-4444-4444-4444-444444444403', 'GRY-RN-3', 'Registered Nurse', 'RN', '555-2003', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{true,true,false,false,false,true,true,true,true,false,false,false,true,true}'),

-- Geary LVNs
('55555555-5555-5555-5555-555555555501', 'GRY-LVN-1', 'Licensed Vocational Nurse', 'LVN', '555-3001', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,false,false,false,false,false,true,true,false,false,false,false}'),
('55555555-5555-5555-5555-555555555502', 'GRY-LVN-2', 'Licensed Vocational Nurse', 'LVN', '555-3002', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,false,false,true,true,false,false,false,false,false,true,true,false,false}'),
('55555555-5555-5555-5555-555555555503', 'GRY-LVN-3', 'Licensed Vocational Nurse', 'LVN', '555-3003', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{true,false,false,false,false,true,true,true,false,false,false,false,true,true}'),
('55555555-5555-5555-5555-555555555504', 'GRY-LVN-OC1', 'On-Call LVN', 'LVN', '555-3004', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),
('55555555-5555-5555-5555-555555555505', 'GRY-LVN-OC2', 'On-Call LVN', 'LVN', '555-3005', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),
('55555555-5555-5555-5555-555555555506', 'GRY-LVN-OC3', 'On-Call LVN', 'LVN', '555-3006', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),
('55555555-5555-5555-5555-555555555507', 'GRY-LVN-OC4', 'On-Call LVN', 'LVN', '555-3007', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),

-- Geary MAs
('66666666-6666-6666-6666-666666666601', 'GRY-MA-1', 'Medical Assistant', 'MA', '555-4001', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('66666666-6666-6666-6666-666666666602', 'GRY-MA-2', 'Medical Assistant', 'MA', '555-4002', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('66666666-6666-6666-6666-666666666603', 'GRY-MA-3', 'Medical Assistant', 'MA', '555-4003', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{true,true,true,true,false,false,true,true,true,true,true,false,false,true}'),
('66666666-6666-6666-6666-666666666604', 'GRY-MA-4', 'Medical Assistant', 'MA', '555-4004', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{true,true,false,false,true,true,true,true,true,false,false,true,true,true}'),
('66666666-6666-6666-6666-666666666605', 'GRY-MA-5', 'Medical Assistant', 'MA', '555-4005', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{false,false,true,true,true,false,false,false,false,true,true,true,false,false}'),
('66666666-6666-6666-6666-666666666606', 'GRY-MA-6', 'Medical Assistant', 'MA', '555-4006', '08:00-17:00', false, '11111111-1111-1111-1111-111111111100', '{true,false,false,false,false,true,true,true,false,false,false,false,true,true}'),
('66666666-6666-6666-6666-666666666607', 'GRY-MA-OC1', 'On-Call MA', 'MA', '555-4007', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14])),
('66666666-6666-6666-6666-666666666608', 'GRY-MA-OC2', 'On-Call MA', 'MA', '555-4008', '08:00-17:00', true, '11111111-1111-1111-1111-111111111100', array_fill(false, ARRAY[14]));

-- 4. Assign Employees to Clinics
INSERT INTO employee_clinics (user_id, clinic_id) VALUES 
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101'), -- Admin at Geary
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101'), -- Manager at Geary
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102'), -- Admin at MB
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102'), -- Manager at MB

-- Mission Bay (MB) Authorizations
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102'),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102'),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111102'),

-- Geary Authorizations
('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101'),
('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111101'),
('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111101'),
('55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666605', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666606', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666607', '11111111-1111-1111-1111-111111111101'),
('66666666-6666-6666-6666-666666666608', '11111111-1111-1111-1111-111111111101');

-- 5. Coverage Requirements
-- Mission Bay (M-F)
INSERT INTO coverage_requirements (location_id, custom_id, start_time, end_time, staffing_role, required_count, time_block, schedule_pattern) VALUES 
('11111111-1111-1111-1111-111111111102', 'MB-RN-FT', '08:30', '17:00', 'RN', 1, 'FULL_DAY', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('11111111-1111-1111-1111-111111111102', 'MB-LVN-FT', '08:30', '17:00', 'LVN', 1, 'FULL_DAY', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('11111111-1111-1111-1111-111111111102', 'MB-MA-FT', '08:30', '17:00', 'MA', 1, 'FULL_DAY', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}');

-- Geary Clinic
INSERT INTO coverage_requirements (location_id, custom_id, start_time, end_time, staffing_role, required_count, time_block, schedule_pattern) VALUES 
('11111111-1111-1111-1111-111111111101', 'GRY-RN-WKDAY', '08:00', '17:00', 'RN', 2, 'FULL_DAY', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('11111111-1111-1111-1111-111111111101', 'GRY-RN-WKEND', '08:00', '17:00', 'RN', 1, 'FULL_DAY', '{true,false,false,false,false,false,true,true,false,false,false,false,false,true}'),
('11111111-1111-1111-1111-111111111101', 'GRY-LVN-ALL', '08:00', '17:00', 'LVN', 1, 'FULL_DAY', array_fill(true, ARRAY[14])),
('11111111-1111-1111-1111-111111111101', 'GRY-MA-WKDAY', '08:00', '17:00', 'MA', 4, 'FULL_DAY', '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'),
('11111111-1111-1111-1111-111111111101', 'GRY-MA-WKEND', '08:00', '17:00', 'MA', 3, 'FULL_DAY', '{true,false,false,false,false,false,true,true,false,false,false,false,false,true}');
