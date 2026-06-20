exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache'
  };

  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date) return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = '7481ed04-a832-44f6-b759-996bf8d8622a';

  if (!NETLIFY_TOKEN) {
    console.log('No NETLIFY_TOKEN found');
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }

  try {
    const https = require('https');

    const getJSON = (url, token) => new Promise((resolve, reject) => {
      const options = {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      };
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      }).on('error', reject);
    });

    const forms = await getJSON(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, NETLIFY_TOKEN);
    console.log('Forms found:', forms.length);

    const form = Array.isArray(forms) && forms.find(f => f.name === 'motornation-booking');
    if (!form) {
      console.log('Form not found');
      return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
    }

    const submissions = await getJSON(`https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100`, NETLIFY_TOKEN);
    console.log('Submissions found:', submissions.length, 'for date:', date);

    const taken = Array.isArray(submissions)
      ? submissions.filter(s => s.data && s.data.date === date).map(s => s.data.time).filter(Boolean)
      : [];

    console.log('Taken slots:', taken);
    return { statusCode: 200, headers, body: JSON.stringify({ taken }) };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [], error: err.message }) };
  }
};
