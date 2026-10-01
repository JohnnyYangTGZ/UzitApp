import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTimeOffs() {
  console.log("=== TIME OFF REQUESTS ===");
  const { data: requests, error } = await supabase
    .from('time_off_requests')
    .select('*, users!time_off_requests_user_id_fkey(name, email)');

  if (error) console.error("Error fetching time off requests:", error);
  console.log(JSON.stringify(requests, null, 2));
}

checkTimeOffs();
