create table attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  absence_type text not null check (absence_type in ('Sick Call', 'No Call No Show', 'Tardy')),
  notes text,
  recorded_by uuid references users(id) on delete set null,
  created_at timestamp default now()
);
