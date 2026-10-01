const xlsx = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase config from seed.js
const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';
const supabase = createClient(supabaseUrl, supabaseKey);

const excelFilePath = path.join('C:\\Users\\jyang\\Downloads', 'Urgent Care staff by role and seniority.xlsx');

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split('T')[0];
}

async function run() {
  console.log('Fetching Urgent Care department ID...');
  const { data: locData, error: locErr } = await supabase
    .from('locations')
    .select('id')
    .ilike('name', '%Urgent Care%')
    .limit(1)
    .single();

  if (locErr || !locData) {
    console.error('Failed to find Urgent Care department:', locErr);
    return;
  }
  const departmentId = locData.id;
  console.log(`Found Urgent Care Department ID: ${departmentId}`);

  console.log('Reading Excel file...');
  const workbook = xlsx.readFile(excelFilePath);
  const sheet = workbook.Sheets['UC Staff Contact List'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let headers = null;
  const staff = [];

  for (const row of data) {
    // If it's the header row
    if (row[0] === 'Last name' && row[1] === 'First name') {
      headers = row;
      continue;
    }

    // Skip section headers or empty rows
    if (row.length < 3 || !row[0] || !row[1] || !row[3]) {
      continue;
    }

    // "KP email" is at index 3, "Job role" at index 2
    const lastName = row[0];
    const firstName = row[1];
    const jobRole = row[2] || '';
    const email = row[3];
    const phone = row[5] || null;
    const senioritySerial = row[6];
    const emplId = row[7] ? String(row[7]) : null;

    let staffingRole = 'staff';
    if (jobRole.includes('CR')) staffingRole = 'reception';
    else if (jobRole.includes('MA')) staffingRole = 'medical_assistant';
    else if (jobRole.includes('RN')) staffingRole = 'nurse';
    else if (jobRole.includes('LVN')) staffingRole = 'nurse';
    else if (jobRole.includes('Provider') || jobRole.includes('NP') || jobRole.includes('Physician')) staffingRole = 'physician';
    else if (jobRole.includes('Manager')) staffingRole = 'manager';

    staff.push({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: email.trim().toLowerCase(),
      jobRole,
      staffingRole,
      phone,
      seniorityDate: excelDateToJSDate(senioritySerial),
      emplId
    });
  }

  console.log(`Parsed ${staff.length} staff records. Starting insert...`);

  let successCount = 0;
  for (const s of staff) {
    // Check if user exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', s.email).maybeSingle();
    let userId = existingUser?.id;

    if (!userId) {
      // Insert User
      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          name: s.fullName,
          email: s.email,
          password: 'password123', // default temp password
          role: 'staff'
        })
        .select()
        .single();
      
      if (userErr) {
        console.error(`Error inserting user ${s.email}:`, userErr);
        continue;
      }
      userId = newUser.id;
    }

    // Insert Employee Profile
    const { error: profileErr } = await supabase
      .from('employee_profiles')
      .upsert({
        user_id: userId,
        employee_code: s.emplId,
        job_title: s.jobRole,
        staffing_role: s.staffingRole,
        phone_number: s.phone,
        department_id: departmentId,
        company_start_date: s.seniorityDate,
        is_active: true
      }, { onConflict: 'user_id' });
    
    if (profileErr) {
      console.error(`Error inserting profile for ${s.email}:`, profileErr);
    } else {
      successCount++;
    }

    // Insert Employee Clinic Mapping
    await supabase.from('employee_clinics').upsert({
      user_id: userId,
      clinic_id: departmentId
    }, { onConflict: 'user_id,clinic_id' });
  }

  console.log(`Successfully processed ${successCount} staff records.`);
}

run().catch(console.error);
