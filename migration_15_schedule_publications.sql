-- Migration 15: Schedule Publications Table
CREATE TABLE IF NOT EXISTS schedule_publications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, week_start_date)
);
