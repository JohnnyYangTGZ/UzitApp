import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedAvailability() {
  console.log("Fetching on-call employees...");
  
  const { data: onCallProfiles, error: profileErr } = await supabase
    .from('employee_profiles')
    .select('user_id')
    .eq('is_on_call', true)
    .eq('is_active', true);
    
  if (profileErr) {
    console.error("Error fetching profiles:", profileErr);
    return;
  }
  
  if (!onCallProfiles || onCallProfiles.length === 0) {
    console.log("No on-call employees found.");
    return;
  }
  
  console.log(`Found ${onCallProfiles.length} on-call employees. Generating availability...`);
  
  // Generate availability for today and the next 7 days
  const availabilities = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    // For each day, 50% chance they are available
    for (const prof of onCallProfiles) {
      if (Math.random() > 0.5) {
        availabilities.push({
          user_id: prof.user_id,
          date: dateStr,
          shift_time: Math.random() > 0.5 ? 'Any' : '08:00 - 17:00',
          notes: Math.random() > 0.7 ? 'Available immediately if needed' : null
        });
      }
    }
  }
  
  console.log(`Inserting ${availabilities.length} availability records...`);
  
  // Clear old availability to avoid unique constraint errors during seed
  await supabase.from('employee_availability').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { error: insertErr } = await supabase
    .from('employee_availability')
    .insert(availabilities);
    
  if (insertErr) {
    console.error("Error inserting availability:", insertErr);
  } else {
    console.log("Successfully seeded availability!");
  }
}

seedAvailability();
