import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    console.log("Webhook payload received:", payload)

    // Expected payload from database webhook
    // { type: 'INSERT' | 'UPDATE', table: 'time_off_requests', record: { ... } }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let userIdToNotify = null;
    let title = '';
    let body = '';

    if (payload.table === 'time_off_requests' && payload.type === 'UPDATE') {
       const oldRecord = payload.old_record;
       const newRecord = payload.record;
       
       if (oldRecord.status !== 'approved' && newRecord.status === 'approved') {
          userIdToNotify = newRecord.user_id;
          title = "Time Off Approved!";
          body = `Your time off request starting ${newRecord.start_date} has been approved.`;
       } else if (oldRecord.status !== 'denied' && newRecord.status === 'denied') {
          userIdToNotify = newRecord.user_id;
          title = "Time Off Denied";
          body = `Your time off request starting ${newRecord.start_date} was denied.`;
       }
    } else if (payload.table === 'time_off_requests' && payload.type === 'INSERT') {
       // Notify managers? We would need to find manager user_ids.
       // For now, let's keep it simple.
    }

    if (!userIdToNotify) {
      return new Response(JSON.stringify({ message: "No notification needed" }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Fetch the user's push tokens
    const { data: tokens, error } = await supabaseAdmin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userIdToNotify)

    if (error || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens found for user" }), { headers: { 'Content-Type': 'application/json' } })
    }

    const messages = tokens.map(t => ({
      to: t.expo_push_token,
      sound: 'default',
      title: title,
      body: body,
      data: { route: 'requests' },
    }));

    // Send to Expo
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoData = await expoRes.json();

    return new Response(
      JSON.stringify({ success: true, expoResponse: expoData }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
