-- This migration sets up a Database Webhook to trigger our Edge Function

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_time_off_update()
RETURNS trigger AS $$
BEGIN
  -- Perform an HTTP POST request to our Supabase Edge Function
  -- Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
  PERFORM net.http_post(
      url:='https://onktumxeppoghwoozsit.supabase.co/functions/v1/push-notification',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3R1bXhlcHBvZ2h3b296c2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgwNDA2NCwiZXhwIjoyMDkyMzgwMDY0fQ.1sgxHYXP9Y8i1tjjirO2xsyQfmYcOxi6JekXjZfDCS0"}'::jsonb,
      body:=json_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the time_off_requests table
DROP TRIGGER IF EXISTS on_time_off_request_updated ON public.time_off_requests;
CREATE TRIGGER on_time_off_request_updated
  AFTER UPDATE OF status ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_time_off_update();
