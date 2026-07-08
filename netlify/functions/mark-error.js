// netlify/functions/mark-error.js
//
// Handles "Made in Error" — for a booking that was created by mistake
// (test entry, double-booking, wrong date typed by accident, etc).
//
// What it does, in order:
//   1. Reads the submission from Netlify Forms so we have the customer's
//      name/phone/email/vehicle before anything is removed.
//   2. Appends that contact info to a separate "error-log" store in
//      Netlify Blobs — nothing about the customer is lost.
//   3. Deletes the submission from Netlify Forms so it no longer shows
//      up on the Today tab, the Calendar tab, or the Customers tab.
//
// Requires NETLIFY_TOKEN and NETLIFY_SITE_ID as environment variables.
// NETLIFY_TOKEN is the same one get-submissions.js already uses.
// NETLIFY_SITE_ID must be added in Netlify → Site configuration →
// Environment variables (find the Site ID under Site configuration →
// General → Site details). Auto-injection of site context does not
// reliably apply to this project, so both are passed explicitly below —
// this is the fix for the "environment has not been configured to use
// Netlify Blobs" error.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let submissionId;
  try {
    const body = JSON.parse(event.body || "{}");
    submissionId = body.id;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing submission id" }) };
  }

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

  if (!NETLIFY_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: "NETLIFY_TOKEN not configured" }) };
  }
  if (!NETLIFY_SITE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "NETLIFY_SITE_ID not configured. Add it in Netlify → Site configuration → Environment variables. Find the value under Site configuration → General → Site details → Site ID.",
      }),
    };
  }

  try {
    // 1. Fetch the submission so we can save the customer's info before deleting.
    const getRes = await fetch(
      `https://api.netlify.com/api/v1/submissions/${submissionId}`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );

    if (!getRes.ok) {
      const errText = await getRes.text();
      return {
        statusCode: getRes.status,
        body: JSON.stringify({ error: "Could not load submission before deleting", detail: errText }),
      };
    }

    const submission = await getRes.json();
    const d = submission.data || {};

    // 2. Save the customer's contact info to a separate error-log store.
    // This is intentionally a different Blobs store than statuses, so an
    // accidental deletion never gets mixed up with real appointment history.
    // siteID + token passed explicitly — this is what the "environment has
    // not been configured" error was asking for.
    const errorStore = getStore({
      name: "error-log",
      siteID: NETLIFY_SITE_ID,
      token: NETLIFY_TOKEN,
    });
    const savedRecord = {
      original_submission_id: submissionId,
      name: `${d["first-name"] || ""} ${d["last-name"] || ""}`.trim(),
      phone: d.phone || "",
      email: d.email || "",
      address: d.address || d["street-address"] || "",
      vehicle: `${d["vehicle-year"] || ""} ${d.vehicle || ""}`.trim(),
      package: d.package || "",
      original_date: d.date || "",
      original_time: d.time || "",
      marked_error_at: new Date().toISOString(),
    };

    // Store as a list keyed by today's date + submission id so multiple
    // "Made in Error" actions on the same day don't overwrite each other.
    const key = `${new Date().toISOString().slice(0, 10)}_${submissionId}`;
    await errorStore.setJSON(key, savedRecord);

    // 3. Delete the submission so it disappears from Today / Calendar / Customers.
    const delRes = await fetch(
      `https://api.netlify.com/api/v1/submissions/${submissionId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );

    if (!delRes.ok) {
      const errText = await delRes.text();
      // Customer info is already saved at this point even if delete fails,
      // so we say so explicitly rather than a generic error.
      return {
        statusCode: delRes.status,
        body: JSON.stringify({
          error: "Customer info was saved, but the booking could not be deleted from Netlify Forms",
          detail: errText,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, saved: savedRecord }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Unknown error" }) };
  }
};
