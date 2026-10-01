import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Starting seed process...');

  try {
    // 1. Create a Location
    console.log('Creating location...');
    const { data: locationData, error: locError } = await supabase
      .from('locations')
      .insert([{ name: 'Downtown Outpatient Center', code: 'DOC-01' }])
      .select()
      .single();

    if (locError) throw locError;
    const locationId = locationData.id;
    console.log(`Location created with ID: ${locationId}`);

    // 2. Create Users
    console.log('Creating users...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .insert([
        { name: 'Dr. Sarah Jenkins', email: 'sarah@example.com', role: 'staff' },
        { name: 'Mark Roberts, RN', email: 'mark@example.com', role: 'staff' },
        { name: 'Admin Manager', email: 'manager@example.com', role: 'manager' }
      ])
      .select();

    if (usersError) throw usersError;

    const sarahId = usersData.find(u => u.name.includes('Sarah')).id;
    const markId = usersData.find(u => u.name.includes('Mark')).id;
    const managerId = usersData.find(u => u.name.includes('Admin')).id;

    console.log('Users created.');

    // 3. Create Employee Profiles
    console.log('Creating employee profiles...');
    const { error: profilesError } = await supabase
      .from('employee_profiles')
      .insert([
        { user_id: sarahId, employee_code: 'EMP-001', job_title: 'Sr. Physician', staffing_role: 'physician', primary_location_id: locationId },
        { user_id: markId, employee_code: 'EMP-002', job_title: 'Head Nurse', staffing_role: 'nurse', primary_location_id: locationId },
        { user_id: managerId, employee_code: 'EMP-000', job_title: 'Clinic Manager', staffing_role: 'manager', primary_location_id: locationId }
      ]);

    if (profilesError) throw profilesError;
    console.log('Employee profiles created.');

    // 4. Create Schedule Patterns
    console.log('Creating schedule patterns...');
    const { data: patternData, error: patternError } = await supabase
      .from('schedule_patterns')
      .insert([
        { name: 'Standard Full Time RN', description: 'Standard M-F 07:00-15:00 with weekend rotation' },
        { name: 'Part Time Physician', description: 'MWF 08:00-16:00' }
      ])
      .select();

    if (patternError) throw patternError;
    const rnPatternId = patternData[0].id;
    const physPatternId = patternData[1].id;

    // 5. Create Pattern Entries
    const entries = [];
    // RN Pattern (Week 1, M-F)
    for(let i=1; i<=5; i++) {
      entries.push({ schedule_pattern_id: rnPatternId, week_number: 1, day_of_week: i, time_block: 'AM', location_id: locationId, shift_label: 'AM SHIFT', start_time: '07:00', end_time: '15:00' });
      entries.push({ schedule_pattern_id: rnPatternId, week_number: 2, day_of_week: i, time_block: 'PM', location_id: locationId, shift_label: 'PM SHIFT', start_time: '15:00', end_time: '23:00' });
    }
    // Phys Pattern (MWF)
    entries.push({ schedule_pattern_id: physPatternId, week_number: 1, day_of_week: 1, time_block: 'AM', location_id: locationId, shift_label: 'AM SHIFT', start_time: '08:00', end_time: '16:00' });
    entries.push({ schedule_pattern_id: physPatternId, week_number: 1, day_of_week: 3, time_block: 'AM', location_id: locationId, shift_label: 'AM SHIFT', start_time: '08:00', end_time: '16:00' });
    entries.push({ schedule_pattern_id: physPatternId, week_number: 1, day_of_week: 5, time_block: 'AM', location_id: locationId, shift_label: 'AM SHIFT', start_time: '08:00', end_time: '16:00' });

    const { error: entriesError } = await supabase.from('schedule_pattern_entries').insert(entries);
    if (entriesError) throw entriesError;
    console.log('Pattern entries created.');

    // 6. Assign Patterns to Users
    const { error: empPatternError } = await supabase
      .from('employee_schedule_patterns')
      .insert([
        { user_id: sarahId, schedule_pattern_id: physPatternId, effective_start_date: '2023-10-01' },
        { user_id: markId, schedule_pattern_id: rnPatternId, effective_start_date: '2023-10-01' }
      ]);
    if (empPatternError) throw empPatternError;

    // 7. Create Actual Shifts and Assignments for the upcoming week
    console.log('Creating upcoming shifts...');
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday
    // Start of week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1));

    const shifts = [];
    for(let i=0; i<7; i++) {
        let date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        let dateStr = date.toISOString().split('T')[0];

        // Shift 1
        shifts.push({ date: dateStr, time_block: 'AM', location_id: locationId });
        // Shift 2
        shifts.push({ date: dateStr, time_block: 'PM', location_id: locationId });
    }

    const { data: shiftsData, error: shiftsError } = await supabase.from('shifts').insert(shifts).select();
    if (shiftsError) throw shiftsError;

    // Assign Sarah to AM shifts on MWF
    // Assign Mark to PM shifts on all days
    const assignments = [];
    for(let i=0; i<7; i++) {
        let date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        let dateStr = date.toISOString().split('T')[0];
        let dayOfWeek = date.getDay();

        let amShift = shiftsData.find(s => s.date === dateStr && s.time_block === 'AM');
        let pmShift = shiftsData.find(s => s.date === dateStr && s.time_block === 'PM');

        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
            assignments.push({ shift_id: amShift.id, user_id: sarahId });
        }
        assignments.push({ shift_id: pmShift.id, user_id: markId });
    }

    const { error: assignError } = await supabase.from('shift_assignments').insert(assignments);
    if (assignError) throw assignError;

    console.log('Seed completed successfully!');

  } catch (error) {
    console.error('Seeding failed:', error);
  }
}

seed();
