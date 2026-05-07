create extension if not exists "uuid-ossp";

-- DROP EXISTING TABLES TO ALLOW CLEAN RECREATION
drop table if exists shift_assignments cascade;
drop table if exists shifts cascade;
drop table if exists employee_schedule_patterns cascade;
drop table if exists schedule_pattern_entries cascade;
drop table if exists schedule_patterns cascade;
drop table if exists time_off_requests cascade;
drop table if exists time_off_types cascade;
drop table if exists coverage_requirements cascade;
drop table if exists employee_clinics cascade;
drop table if exists employee_profiles cascade;
drop table if exists audit_logs cascade;
drop table if exists users cascade;
drop table if exists locations cascade;
-- USERS
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null,
  created_at timestamp default now()
);

-- LOCATIONS
create table locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text,
  parent_location_id uuid references locations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- EMPLOYEE PROFILES
create table employee_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  employee_code text,
  job_title text,
  staffing_role text not null,
  phone_number text,
  shift_time text,
  schedule_pattern boolean[] default '{false,true,true,true,true,true,false,false,true,true,true,true,true,false}'::boolean[],
  is_on_call boolean not null default false,
  department_id uuid references locations(id) on delete set null,
  manager_user_id uuid references users(id) on delete set null,
  company_start_date date,
  role_start_date date,
  location_start_date date,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- EMPLOYEE CLINICS
create table employee_clinics (
  user_id uuid not null references users(id) on delete cascade,
  clinic_id uuid not null references locations(id) on delete cascade,
  created_at timestamp default now(),
  primary key (user_id, clinic_id)
);

-- STAFFING ROLES
create table staffing_roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  department_id uuid references locations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- TIME OFF TYPES
create table time_off_types (
  code text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- TIME OFF REQUESTS
create table time_off_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  time_off_type_code text not null references time_off_types(code),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',
  reason text,
  manager_note text,
  reviewed_at timestamp,
  reviewed_by uuid references users(id) on delete set null,
  created_at timestamp default now()
);

-- SCHEDULE PATTERNS
create table schedule_patterns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamp default now()
);

-- SCHEDULE PATTERN ENTRIES
create table schedule_pattern_entries (
  id uuid primary key default uuid_generate_v4(),
  schedule_pattern_id uuid not null references schedule_patterns(id) on delete cascade,
  week_number int not null check (week_number in (1, 2)),
  day_of_week int not null check (day_of_week between 1 and 7),
  time_block text not null,
  location_id uuid references locations(id) on delete set null,
  shift_label text,
  start_time time,
  end_time time,
  is_working_day boolean not null default true,
  created_at timestamp default now()
);

-- EMPLOYEE SCHEDULE PATTERN ASSIGNMENTS
create table employee_schedule_patterns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  schedule_pattern_id uuid not null references schedule_patterns(id) on delete cascade,
  effective_start_date date not null,
  effective_end_date date,
  is_current boolean not null default true,
  assigned_by uuid references users(id) on delete set null,
  created_at timestamp default now()
);

-- SHIFTS (ACTUAL DATED INSTANCES)
create table shifts (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time_block text not null,
  start_time time,
  end_time time,
  staffing_role text,
  is_working_day boolean not null default true,
  location_id uuid not null references locations(id) on delete cascade,
  generated_from_pattern_entry_id uuid references schedule_pattern_entries(id) on delete set null,
  created_at timestamp default now()
);

-- SHIFT ASSIGNMENTS
create table shift_assignments (
  id uuid primary key default uuid_generate_v4(),
  shift_id uuid not null references shifts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'scheduled',
  source_type text not null default 'pattern',
  created_at timestamp default now()
);

-- COVERAGE REQUIREMENTS
create table coverage_requirements (
  id uuid primary key default uuid_generate_v4(),
  custom_id text unique,
  location_id uuid not null references locations(id) on delete cascade,
  start_time time,
  end_time time,
  schedule_pattern boolean[] default array_fill(false, ARRAY[14]),
  time_block text not null,
  day_type text not null default 'WEEKDAY',
  staffing_role text not null,
  required_count int not null,
  priority_weight int not null default 1,
  created_at timestamp default now()
);

-- AUDIT LOGS
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action_type text not null,
  performed_by uuid references users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  metadata jsonb,
  created_at timestamp default now()
);

-- SEED DATA
insert into time_off_types (code, name) values
  ('PTO', 'Paid Time Off'),
  ('SCK', 'Sick'),
  ('VAC', 'Vacation'),
  ('LOA', 'Leave of Absence'),
  ('SUS', 'Suspension'),
  ('ADN', 'Administrative'),
  ('OFF', 'Off');
