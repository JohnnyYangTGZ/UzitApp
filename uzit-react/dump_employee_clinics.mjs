import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('employee_clinics')
    .select('*, locations(name)');
    
  if (error) {
    console.error('Error fetching employee_clinics:', error);
  } else {
    const ucDept = data.filter(r => r.locations?.name === 'Urgent Care');
    console.log('Number of mappings to Urgent Care:', ucDept.length);
    console.log(JSON.stringify(ucDept, null, 2));
  }
}

main();
