const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Elsewedy SEDCO <onboarding@resend.dev>';
  const replyTo = Deno.env.get('RESEND_REPLY_TO') || 'amasser050@gmail.com';

  if (!resendApiKey) {
    return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500);
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return jsonResponse({ error: 'Missing required fields: to, subject, html' }, 400);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html,
        reply_to: replyTo
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return jsonResponse({ error: 'Resend failed to send email', details: result }, response.status);
    }

    return jsonResponse({ ok: true, result });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
