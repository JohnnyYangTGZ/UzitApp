import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('locations')
    .delete()
    .eq('name', 'Urgent Care')
    .not('parent_location_id', 'is', null)
    .select();
    
  if (error) {
    console.error('Error deleting clinic:', error);
  } else {
    console.log('Successfully deleted the Urgent Care clinic:', data);
  }
}

main();
