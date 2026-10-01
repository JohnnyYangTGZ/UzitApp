import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: profiles } = await supabase.from('employee_profiles').select('*').limit(1);
  if (profiles && profiles.length > 0) {
    const p = profiles[0];
    let pattern = p.schedule_pattern;
    if (typeof pattern === 'string') {
        pattern = JSON.parse(pattern.replace('{', '[').replace('}', ']'));
    }
    pattern[1] = "09:00-18:00"; // Monday custom shift
    
    await supabase.from('employee_profiles').update({ schedule_pattern: pattern }).eq('id', p.id);
    console.log("Updated profile:", p.id);
  }
}

main();
