// netlify/functions/get-square-payments.js
exports.handler = async () => {
  try {
    const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
    const LOCATION_ID = "LSKQ78G0R6HBJ";
    const begin = new Date();
    begin.setMonth(begin.getMonth() - 8);
    const res = await fetch(
      `https://connect.squareup.com/v2/payments?location_id=${LOCATION_ID}&begin_time=${begin.toISOString()}&limit=100`,
      { headers: { "Authorization": `Bearer ${SQUARE_TOKEN}`, "Content-Type": "application/json" } }
    );
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ payments: data.payments || [] })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
