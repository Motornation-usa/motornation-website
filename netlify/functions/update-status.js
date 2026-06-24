// netlify/functions/update-status.js
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore("appointment-statuses");
    const { id, status } = JSON.parse(event.body);
    if (!id || !status) return { statusCode: 400, body: "Missing id or status" };
    await store.setJSON(`status-${id}`, { status, updatedAt: new Date().toISOString() });
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
