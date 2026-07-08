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
// Requires the same NETLIFY_TOKEN and FORM_ID already used by
// get-submissions.js — no new environment variables needed.

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
  const SITE_ID = process.env.SITE_ID; // Netlify auto-injects this at build/runtime

  if (!NETLIFY_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: "NETLIFY_TOKEN not configured" }) };
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
    const errorStore = getStore("error-log");
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
