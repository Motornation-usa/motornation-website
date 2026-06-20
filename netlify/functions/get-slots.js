// Netlify Function: get-slots.js
// Checks existing form submissions for a given date and returns taken time slots
// This prevents double bookings without any third-party scheduling tool

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Date required' }) };
  }

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = process.env.SITE_ID || '7481ed04-a832-44f6-b759-996bf8d8622a';
  const FORM_NAME = 'motornation-booking';

  if (!NETLIFY_TOKEN) {
    // If no token configured yet, return empty (no slots taken)
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }

  try {
    // Get form ID first
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );
    const forms = await formsRes.json();
    const form = forms.find(f => f.name === FORM_NAME);
    if (!form) return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };

    // Get submissions for this form
    const subsRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );
    const submissions = await subsRes.json();

    // Find taken slots for requested date
    const taken = submissions
      .filter(s => s.data && s.data.date === date)
      .map(s => s.data.time)
      .filter(Boolean);

    return { statusCode: 200, headers, body: JSON.stringify({ taken }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }
};
