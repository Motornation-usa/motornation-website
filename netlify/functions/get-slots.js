exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Date required' }) };
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = process.env.SITE_ID || '7481ed04-a832-44f6-b759-996bf8d8622a';
  if (!NETLIFY_TOKEN) return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  try {
    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
      headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
    });
    const forms = await formsRes.json();
    const form = forms.find(f => f.name === 'motornation-booking');
    if (!form) return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
    const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100`, {
      headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
    });
    const submissions = await subsRes.json();
    const taken = submissions
      .filter(s => s.data && s.data.date === date)
      .map(s => s.data.time)
      .filter(Boolean);
    return { statusCode: 200, headers, body: JSON.stringify({ taken }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }
};
