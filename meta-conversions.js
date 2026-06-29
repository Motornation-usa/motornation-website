// MotorNation — Meta Conversions API Gateway
// Netlify serverless function
// Fires server-side Lead + Purchase events to Meta when a booking is completed
// This closes the 83-event gap reported in Meta Events Manager diagnostics

const PIXEL_ID = '1336679078438412';

// Meta CAPI endpoint
const META_CAPI_URL = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`;

// Simple SHA-256 hash for PII data (required by Meta CAPI)
async function sha256(str) {
  if (!str) return null;
  const normalized = str.trim().toLowerCase();
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract client IP from Netlify request headers
function getClientIp(headers) {
  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['client-ip'] ||
    headers['x-real-ip'] ||
    null
  );
}

exports.handler = async function(event, context) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check for access token
  const META_ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
  if (!META_ACCESS_TOKEN) {
    console.error('MN CAPI: META_CAPI_TOKEN not set in environment variables');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const {
    event_name,       // 'Lead' or 'Purchase'
    event_time,       // Unix timestamp
    event_id,         // Deduplication ID (match client-side event_id)
    email,            // Customer email (will be hashed)
    phone,            // Customer phone (will be hashed)
    value,            // Dollar value of booking
    currency,         // 'USD'
    content_name,     // Package name
    fbc,              // Facebook click ID cookie (_fbc)
    fbp,              // Facebook browser ID cookie (_fbp)
    source_url,       // Page URL where event occurred
  } = body;

  // Hash PII fields
  const hashedEmail = await sha256(email);
  const hashedPhone = await sha256(phone?.replace(/\D/g, '')); // strip non-digits before hashing

  const clientIp = getClientIp(event.headers);
  const userAgent = event.headers['user-agent'] || null;

  // Build user data object
  const userData = {
    ...(hashedEmail && { em: [hashedEmail] }),
    ...(hashedPhone && { ph: [hashedPhone] }),
    ...(clientIp && { client_ip_address: clientIp }),
    ...(userAgent && { client_user_agent: userAgent }),
    ...(fbc && { fbc }),
    ...(fbp && { fbp }),
  };

  // Build event payload
  const capiEvent = {
    event_name: event_name || 'Lead',
    event_time: event_time || Math.floor(Date.now() / 1000),
    event_id: event_id || `mn_${Date.now()}`,
    event_source_url: source_url || 'https://motornationusa.com',
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value: value || 89,
      currency: currency || 'USD',
      content_name: content_name || 'Mobile Oil Change Booking',
      content_category: 'Mobile Oil Change',
      content_type: 'product',
    },
  };

  const payload = {
    data: [capiEvent],
    test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
  };

  // Clean up undefined test_event_code
  if (!payload.test_event_code) delete payload.test_event_code;

  console.log(`MN CAPI: Sending ${event_name} event | value=$${value} | event_id=${capiEvent.event_id}`);

  try {
    const response = await fetch(
      `${META_CAPI_URL}?access_token=${META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('MN CAPI: Meta API error:', JSON.stringify(result));
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Meta API error', details: result }),
      };
    }

    console.log(`MN CAPI: Success — events_received: ${result.events_received || 1}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        events_received: result.events_received,
        event_id: capiEvent.event_id,
      }),
    };

  } catch (err) {
    console.error('MN CAPI: Fetch error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: err.message }),
    };
  }
};
