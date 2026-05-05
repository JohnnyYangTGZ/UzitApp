-- MIGRATION 08: Add Employee Availability Table

CREATE TABLE IF NOT EXISTS employee_availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_time text NOT NULL, -- e.g. "08:00 - 17:00" or "Any"
  notes text,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, date) -- An employee can only submit one availability record per day
);

-- RLS
ALTER TABLE employee_availability ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own, managers to read all
CREATE POLICY "Users can read their own availability" 
ON employee_availability FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Managers can read all availability" 
ON employee_availability FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'admin')
  )
);

-- Allow users to insert/update their own availability
CREATE POLICY "Users can insert their own availability" 
ON employee_availability FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability" 
ON employee_availability FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability" 
ON employee_availability FOR DELETE 
USING (auth.uid() = user_id);
