const https = require('https');

const getJSON = (url, token) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Parse: ' + data.substring(0,100))); }
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
  const FORM_ID = '6a3469e74658ba00087e093c';

  if (!TOKEN) {
    console.log('ERROR: No NETLIFY_TOKEN');
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }

  try {
    const subs = await getJSON(
      `https://api.netlify.com/api/v1/forms/${FORM_ID}/submissions?per_page=100`,
      TOKEN
    );

    console.log('Subs type:', typeof subs, Array.isArray(subs) ? 'len:'+subs.length : JSON.stringify(subs).substring(0,100));

    const taken = Array.isArray(subs)
      ? subs.filter(s => s.data && s.data.date === date).map(s => s.data.time).filter(Boolean)
      : [];

    console.log('Date:', date, 'Taken:', JSON.stringify(taken));
    return { statusCode: 200, headers, body: JSON.stringify({ taken }) };

  } catch(err) {
    console.error('Error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ taken: [] }) };
  }
};
