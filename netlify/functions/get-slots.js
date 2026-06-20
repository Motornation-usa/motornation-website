const https = require('https');

const getJSON = (url, token) => new Promise((resolve, reject) => {
  const opts = {
    headers: { 'Authorization': `Bearer ${token}` }
  };
  https.get(url, opts, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Parse error: ' + data.substring(0,200))); }
    });
  }).on('error', reject);
});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  const date = event.queryStringParameters && event.queryStringParameters.date;
  if (!date) return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };

  const TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = '7481ed04-a832-44f6-b759-996bf8d8622a';

  if (!TOKEN) {
    console.log('ERROR: No NETLIFY_TOKEN');
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }

  try {
    // Get all forms for the site
    const formsUrl = `https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`;
    console.log('Fetching forms from:', formsUrl);
    const forms = await getJSON(formsUrl, TOKEN);
    console.log('Forms response type:', typeof forms, Array.isArray(forms) ? 'array len:'+forms.length : JSON.stringify(forms).substring(0,100));

    if (!Array.isArray(forms)) {
      console.log('Forms is not array, raw:', JSON.stringify(forms).substring(0,200));
      return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
    }

    const form = forms.find(f => f.name === 'motornation-booking');
    if (!form) {
      console.log('Available forms:', forms.map(f => f.name).join(', '));
      return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
    }

    console.log('Found form:', form.id);
    const subs = await getJSON(`https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=100`, TOKEN);
    console.log('Submissions type:', typeof subs, Array.isArray(subs) ? 'len:'+subs.length : 'not array');

    const taken = Array.isArray(subs)
      ? subs.filter(s => s.data && s.data.date === date).map(s => s.data.time).filter(Boolean)
      : [];

    console.log('Taken for', date, ':', JSON.stringify(taken));
    return { statusCode: 200, headers, body: JSON.stringify({ taken }) };

  } catch(err) {
    console.error('CATCH:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [], error: err.message }) };
  }
};
