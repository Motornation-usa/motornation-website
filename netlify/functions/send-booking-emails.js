// netlify/functions/send-booking-emails.js
// Fires on every new Netlify form submission via webhook
// Set this as a webhook in Netlify: Site > Forms > motornation-booking > Outgoing notifications

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_GROUP_ID = "190921497719604601";

async function addToMailerLite(email, name, appt) {
  const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      name,
      groups: [MAILERLITE_GROUP_ID],
      resubscribe: true,
      fields: {
        appointment_date: appt.date,
        appointment_time: appt.time,
        appointment_package: appt.package,
        appointment_address: appt.address,
        appointment_phone: appt.phone,
      }
    }),
  });
  return res.json();
}

function parseApptUTC(dateStr, timeStr) {
  // dateStr: "2026-06-25", timeStr: "9:00 AM"
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let [_, h, min, mer] = m;
  h = +h; min = +min;
  if (mer.toUpperCase() === "PM" && h !== 12) h += 12;
  if (mer.toUpperCase() === "AM" && h === 12) h = 0;
  const [yr, mo, dy] = dateStr.split("-").map(Number);
  // Mountain Daylight Time = UTC-6
  return new Date(Date.UTC(yr, mo - 1, dy, h + 6, min));
}

function buildConfirmHTML(name, appt) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;background:#f4f4f4">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
<tr><td style="background:#e84c0e;padding:28px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">MotorNation</h1>
  <p style="color:#ffe0cc;margin:6px 0 0;font-size:13px">Mobile Oil Change — We Come To You</p>
</td></tr>
<tr><td style="padding:36px 36px 28px">
  <h2 style="color:#222;font-size:21px;margin:0 0 14px">You are confirmed, ${name}!</h2>
  <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 22px">Your mobile oil change is booked. We will come straight to you — no waiting rooms, no driving anywhere.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px">
    <tr><td style="background:#fff8f5;border:1px solid #f0d0c0;border-radius:6px;padding:18px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#e84c0e;text-transform:uppercase;letter-spacing:1px">Your Appointment</p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">📅 <strong>${appt.date}</strong></p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">🕐 <strong>${appt.time}</strong></p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">📍 <strong>${appt.address}</strong></p>
      <p style="margin:0;font-size:14px;color:#333">🚗 <strong>${appt.package}</strong></p>
    </td></tr>
  </table>
  <p style="color:#888;font-size:13px;line-height:1.6;margin:0">Questions? Call or text:<br><strong style="color:#333">(720) 317-8949 &nbsp;|&nbsp; (720) 318-2028</strong><br><br>See you soon!<br>— The MotorNation Team</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center;margin:0">MotorNation LLC · Aurora, CO · Serving Denver Metro</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildReminderHTML(name, appt, when) {
  const isHour = when === "1hr";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;background:#f4f4f4">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
<tr><td style="background:#e84c0e;padding:28px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">MotorNation</h1>
  <p style="color:#ffe0cc;margin:6px 0 0;font-size:13px">Mobile Oil Change — We Come To You</p>
</td></tr>
<tr><td style="padding:36px 36px 28px">
  <h2 style="color:#222;font-size:21px;margin:0 0 6px">${isHour ? `We are on our way, ${name}!` : `Your oil change is tomorrow, ${name}!`}</h2>
  ${isHour ? `<p style="color:#e84c0e;font-size:17px;font-weight:700;margin:0 0 18px">Arriving in approximately 1 hour.</p>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
    <tr><td style="background:#fff8f5;border:1px solid #f0d0c0;border-radius:6px;padding:18px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#e84c0e;text-transform:uppercase;letter-spacing:1px">Your Appointment</p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">📅 <strong>${appt.date}</strong></p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">🕐 <strong>${appt.time}</strong></p>
      <p style="margin:0 0 6px;font-size:14px;color:#333">📍 <strong>${appt.address}</strong></p>
      <p style="margin:0;font-size:14px;color:#333">🚗 <strong>${appt.package}</strong></p>
    </td></tr>
  </table>
  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 18px">${isHour ? "Please make sure your vehicle is parked and accessible with a few feet of clearance. We handle everything else!" : "No need to go anywhere — we come to you. Just make sure your car is accessible."}</p>
  <p style="color:#888;font-size:13px;line-height:1.6;margin:0">Call or text: <strong style="color:#333">(720) 317-8949 &nbsp;|&nbsp; (720) 318-2028</strong><br><br>${isHour ? "See you shortly!" : "See you tomorrow!"}<br>— The MotorNation Team</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center;margin:0">MotorNation LLC · Aurora, CO · Serving Denver Metro</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildReviewHTML(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;background:#f4f4f4">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
<tr><td style="background:#e84c0e;padding:28px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">MotorNation</h1>
  <p style="color:#ffe0cc;margin:6px 0 0;font-size:13px">Mobile Oil Change — We Come To You</p>
</td></tr>
<tr><td style="padding:36px 36px 28px">
  <h2 style="color:#222;font-size:21px;margin:0 0 14px">How did we do, ${name}?</h2>
  <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px">Hope your car is running smooth! If we did a great job, a quick Google review would mean everything to us. Takes 30 seconds.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px">
    <tr><td style="background:#fffdf0;border:1px solid #f5e088;border-radius:6px;padding:18px;text-align:center">
      <p style="margin:0 0 6px;font-size:26px">⭐⭐⭐⭐⭐</p>
      <p style="margin:0;font-size:14px;color:#555">30 seconds — makes a huge difference for us</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px">
    <tr><td align="center">
      <a href="https://g.page/r/Ccl3dz_PFNqXEAE/review" target="_blank" style="background:#fbbc04;color:#333;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:6px;display:inline-block">Leave a Google Review</a>
    </td></tr>
  </table>
  <p style="color:#888;font-size:13px;line-height:1.6;margin:0">Something not right? Call or text: <strong style="color:#333">(720) 317-8949 &nbsp;|&nbsp; (720) 318-2028</strong><br><br>Thank you!<br>— The MotorNation Team</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:16px 36px;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center;margin:0">MotorNation LLC · Aurora, CO · Serving Denver Metro</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function sendEmail(to, name, subject, html) {
  const res = await fetch("https://connect.mailerlite.com/api/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      from: { email: "a.khattab@motornationusa.com", name: "MotorNation" },
      to: [{ email: to, name }],
      subject,
      html,
    }),
  });
  const data = await res.json();
  console.log(`Email [${subject}] to ${to} — status ${res.status}`, data?.id || data?.message || "");
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  let payload;
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad JSON" }; }

  const d = payload?.payload?.data || payload?.data || {};
  const name  = `${d["first-name"] || d.name || ""} ${d["last-name"] || ""}`.trim() || "there";
  const email = d.email;
  const date  = d.date || d["appointment-date"];
  const time  = d.time || d["appointment-time"];
  const pkg   = d.package || "";
  const addr  = d.address || d["street-address"] || "";
  const phone = d.phone || "";

  if (!email || !date || !time) {
    console.log("Missing fields:", { email, date, time });
    return { statusCode: 400, body: "Missing email, date, or time" };
  }

  const appt = { date, time, package: pkg, address: addr, phone };

  // 1. Add to MailerLite group (triggers Email 1 automation — confirmation)
  await addToMailerLite(email, name, appt);

  // Parse appointment time in UTC
  const apptUTC = parseApptUTC(date, time);
  if (!apptUTC) {
    console.log("Could not parse time:", time);
    return { statusCode: 400, body: "Could not parse appointment time" };
  }

  // 2. Store scheduled jobs in Netlify Blobs for the cron processor
  const { getStore } = require("@netlify/blobs");
  const store = getStore("scheduled-emails");
  const jobId = `job-${email}-${date}-${time}`.replace(/[^a-zA-Z0-9\-_]/g, "_");

  const reminder23hr = new Date(apptUTC.getTime() - 23 * 60 * 60 * 1000);
  const reminder1hr  = new Date(apptUTC.getTime() - 60 * 60 * 1000);
  const reviewTime   = new Date(apptUTC.getTime() + 20 * 60 * 60 * 1000);

  await store.setJSON(jobId, {
    email, name, appt,
    jobs: [
      { type: "reminder_23hr", sendAt: reminder23hr.toISOString(), sent: false },
      { type: "reminder_1hr",  sendAt: reminder1hr.toISOString(),  sent: false },
      { type: "review",        sendAt: reviewTime.toISOString(),   sent: false },
    ]
  });

  console.log(`Scheduled reminders for ${email}: 23hr=${reminder23hr.toISOString()}, 1hr=${reminder1hr.toISOString()}, review=${reviewTime.toISOString()}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
