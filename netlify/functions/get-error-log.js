// netlify/functions/get-error-log.js
//
// Returns every customer record saved by mark-error.js. This is the
// "safety net" view — if a booking was ever marked "Made in Error",
// their name/phone/email/vehicle is still here even though the
// appointment itself was removed from Today/Calendar/Customers.
//
// Requires NETLIFY_TOKEN and NETLIFY_SITE_ID — same as mark-error.js.

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

  if (!NETLIFY_TOKEN || !NETLIFY_SITE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "NETLIFY_TOKEN and/or NETLIFY_SITE_ID not configured in environment variables.",
      }),
    };
  }

  try {
    const errorStore = getStore({
      name: "error-log",
      siteID: NETLIFY_SITE_ID,
      token: NETLIFY_TOKEN,
    });
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
