import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addManager() {
  const managerId = '22222222-2222-2222-2222-222222222202';
  
  // 1. Insert into users
  const { error: userError } = await supabase.from('users').upsert({
    id: managerId,
    name: 'Clinic Manager',
    email: 'manager@example.com',
    password: 'password123',
    role: 'manager'
  });
  
  if (userError) {
    console.error('Error inserting user:', userError);
    return;
  }

  // 2. Fetch a department to associate with
  const { data: locations } = await supabase.from('locations').select('id').limit(1);
  const deptId = locations?.[0]?.id;

  // 3. Insert into employee_profiles
  const { error: profileError } = await supabase.from('employee_profiles').upsert({
    user_id: managerId,
    employee_code: 'EMP-MGR',
    job_title: 'Clinic Manager',
    staffing_role: 'manager',
    phone_number: '555-0000',
    shift_time: '08:00-17:00',
    is_on_call: false,
    department_id: deptId,
    schedule_pattern: [false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  });

  if (profileError) {
    console.error('Error inserting profile:', profileError);
  } else {
    console.log('Manager account successfully restored!');
  }
}

addManager();
