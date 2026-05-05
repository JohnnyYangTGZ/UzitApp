-- 1. Create staffing_roles table
create table if not exists staffing_roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  department_id uuid references locations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- 2. Seed default roles for Urgent Care (department_id: 11111111-1111-1111-1111-111111111100)
INSERT INTO staffing_roles (name, description, department_id) VALUES
('RN', 'Registered Nurse', '11111111-1111-1111-1111-111111111100'),
('LVN', 'Licensed Vocational Nurse', '11111111-1111-1111-1111-111111111100'),
('MA', 'Medical Assistant', '11111111-1111-1111-1111-111111111100'),
('MD', 'Physician', '11111111-1111-1111-1111-111111111100'),
('PA', 'Physician Assistant', '11111111-1111-1111-1111-111111111100'),
('NP', 'Nurse Practitioner', '11111111-1111-1111-1111-111111111100'),
('MANAGER', 'Clinic Manager', '11111111-1111-1111-1111-111111111100')
ON CONFLICT DO NOTHING;
