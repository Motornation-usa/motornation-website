// netlify/functions/get-statuses.js
exports.handler = async () => {
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore("appointment-statuses");
    const { blobs } = await store.list({ prefix: "status-" });
    const statuses = {};
    for (const blob of blobs) {
      const data = await store.get(blob.key, { type: "json" });
      const id = blob.key.replace("status-", "");
      if (data) statuses[id] = data.status;
    }
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify(statuses) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
