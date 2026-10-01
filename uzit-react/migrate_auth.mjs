import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://onktumxeppoghwoozsit.supabase.co';
// Using the service_role key found in your other scripts so we have admin rights
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateUsers() {
  console.log('Fetching users from public.users table...');
  const { data: publicUsers, error: fetchError } = await supabase.from('users').select('*');
  
  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  console.log(`Found ${publicUsers.length} users. Migrating to Supabase Auth...`);

  for (const user of publicUsers) {
    if (user.email === 'none') {
      console.log(`Skipping system user with email 'none' (ID: ${user.id})`);
      continue;
    }

    console.log(`Migrating: ${user.email} (ID: ${user.id})`);
    
    // Create the user in Supabase Auth using the Admin API
    // We force the ID to be the same as the public.users table so your FlutterFlow query works!
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: { name: user.name }
    });

    if (error) {
      if (error.message.includes('already exists')) {
         console.log(` -> User ${user.email} already exists in Auth. Skipping.`);
      } else {
         console.error(` -> Failed to migrate ${user.email}:`, error.message);
      }
    } else {
      
      // If Supabase created a NEW id (sometimes it ignores custom IDs if not allowed),
      // we need to update the public.users table to use the new Auth ID so they stay linked.
      if (data.user.id !== user.id) {
         console.log(` -> Auth created a new UUID for ${user.email}. Updating public tables to match...`);
         
         // 1. Update the employee_profiles table first to avoid foreign key constraints
         await supabase.from('employee_profiles').update({ user_id: data.user.id }).eq('user_id', user.id);
         
         // 2. Insert new user record with new ID
         await supabase.from('users').insert({
            id: data.user.id,
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role
         });
         
         // 3. Delete the old user record
         await supabase.from('users').delete().eq('id', user.id);
         console.log(` -> Successfully updated database to link with new Auth ID: ${data.user.id}`);
      } else {
         console.log(` -> Success!`);
      }
    }
  }
  
  console.log('Migration complete!');
}

migrateUsers();
