import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetPassword() {
  console.log('Fetching users to find johnnyyang...');
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('List error:', listError);
    return;
  }
  
  const johnny = users.users.find(u => u.email === 'johnnyyang@tgzstudios.com');
  if (!johnny) {
    console.log('Johnny not found in Auth!');
    return;
  }
  
  console.log('Found Johnny with ID:', johnny.id);
  console.log('Resetting password to Stb76194382465!');
  
  const { error } = await supabase.auth.admin.updateUserById(johnny.id, { password: 'Stb76194382465!' });
  if (error) {
    console.error('Error updating password:', error.message);
  } else {
    console.log('Password reset successful!');
  }
}

resetPassword();
