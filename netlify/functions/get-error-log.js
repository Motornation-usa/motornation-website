// netlify/functions/get-error-log.js
//
// Returns every customer record saved by mark-error.js. This is the
// "safety net" view — if a booking was ever marked "Made in Error",
// their name/phone/email/vehicle is still here even though the
// appointment itself was removed from Today/Calendar/Customers.

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const errorStore = getStore("error-log");
    const { blobs } = await errorStore.list();

    const records = await Promise.all(
      blobs.map(async (b) => await errorStore.get(b.key, { type: "json" }))
    );

    // Newest first
    records.sort((a, b) => new Date(b.marked_error_at) - new Date(a.marked_error_at));

    return {
      statusCode: 200,
      body: JSON.stringify(records),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Unknown error" }) };
  }
};
