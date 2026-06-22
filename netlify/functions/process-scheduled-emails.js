// netlify/functions/process-scheduled-emails.js
// Runs every 30 min via cron — checks Netlify Blobs and sends due emails
// netlify.toml entry: [functions."process-scheduled-emails"] schedule = "*/30 * * * *"

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;

const SUBJECTS = {
  reminder_23hr: "Your oil change is tomorrow — see you soon!",
  reminder_1hr:  "We are on our way — your oil change is in 1 hour",
  review:        "How did we do? Leave us a quick Google review",
};

function buildReminderHTML(name, appt, type) {
  const isHour = type === "reminder_1hr";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;background:#f4f4f4"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
<tr><td style="background:#e84c0e;padding:28px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">MotorNation</h1>
  <p style="color:#ffe0cc;margin:6px 0 0;font-size:13px">Mobile Oil Change — We Come To You</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#222;font-size:21px;margin:0 0 6px">${isHour ? `We are on our way, ${name}!` : `Your oil change is tomorrow, ${name}!`}</h2>
  ${isHour ? `<p style="color:#e84c0e;font-size:17px;font-weight:700;margin:0 0 18px">Arriving in approximately 1 hour.</p>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
    <td style="background:#fff8f5;border:1px solid #f0d0c0;border-radius:6px;padding:16px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#e84c0e;text-transform:uppercase">Your Appointment</p>
      <p style="margin:0 0 5px;font-size:14px;color:#333">📅 <strong>${appt.date}</strong></p>
      <p style="margin:0 0 5px;font-size:14px;color:#333">🕐 <strong>${appt.time}</strong></p>
      <p style="margin:0 0 5px;font-size:14px;color:#333">📍 <strong>${appt.address}</strong></p>
      <p style="margin:0;font-size:14px;color:#333">🚗 <strong>${appt.package}</strong></p>
    </td></tr></table>
  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px">${isHour ? "Please make sure your vehicle is parked and accessible. We handle everything else!" : "No need to go anywhere — we come to you. Make sure your car is accessible."}</p>
  <p style="color:#888;font-size:13px;line-height:1.6;margin:0">Call or text: <strong style="color:#333">(720) 317-8949 | (720) 318-2028</strong><br><br>${isHour ? "See you shortly!" : "See you tomorrow!"}<br>— The MotorNation Team</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:14px 36px;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center;margin:0">MotorNation LLC · Aurora, CO · Serving Denver Metro</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function buildReviewHTML(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;background:#f4f4f4"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
<tr><td style="background:#e84c0e;padding:28px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700">MotorNation</h1>
  <p style="color:#ffe0cc;margin:6px 0 0;font-size:13px">Mobile Oil Change — We Come To You</p>
</td></tr>
<tr><td style="padding:36px">
  <h2 style="color:#222;font-size:21px;margin:0 0 14px">How did we do, ${name}?</h2>
  <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 18px">Hope your car is running smooth! If we did a great job, a quick Google review would mean everything to us — takes 30 seconds.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
    <td style="background:#fffdf0;border:1px solid #f5e088;border-radius:6px;padding:16px;text-align:center">
      <p style="margin:0 0 5px;font-size:24px">⭐⭐⭐⭐⭐</p>
      <p style="margin:0;font-size:13px;color:#555">30 seconds — makes a huge difference</p>
    </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr>
    <td align="center"><a href="https://g.page/r/Ccl3dz_PFNqXEAE/review" target="_blank" style="background:#fbbc04;color:#333;text-decoration:none;font-size:16px;font-weight:700;padding:13px 34px;border-radius:6px;display:inline-block">Leave a Google Review</a></td></tr></table>
  <p style="color:#888;font-size:13px;line-height:1.6;margin:0">Something not right? Call or text: <strong style="color:#333">(720) 317-8949 | (720) 318-2028</strong><br><br>Thank you!<br>— The MotorNation Team</p>
</td></tr>
<tr><td style="background:#f9f9f9;padding:14px 36px;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center;margin:0">MotorNation LLC · Aurora, CO · Serving Denver Metro</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(to, name, type, appt) {
  const html = type === "review" ? buildReviewHTML(name) : buildReminderHTML(name, appt, type);
  const res = await fetch("https://connect.mailerlite.com/api/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      from: { email: "a.khattab@motornationusa.com", name: "MotorNation" },
      to: [{ email: to, name }],
      subject: SUBJECTS[type],
      html,
    }),
  });
  const data = await res.json();
  console.log(`[${type}] → ${to} | status ${res.status} | id: ${data?.id || data?.message}`);
  return res.ok;
}

exports.handler = async () => {
  const { getStore } = require("@netlify/blobs");
  const store = getStore("scheduled-emails");
  const { blobs } = await store.list({ prefix: "job-" });
  const now = new Date();
  let sent = 0;

  for (const blob of blobs) {
    let job;
    try { job = await store.get(blob.key, { type: "json" }); } catch { continue; }
    if (!job) continue;

    let updated = false;
    for (const task of job.jobs) {
      if (task.sent) continue;
      if (new Date(task.sendAt) <= now) {
        const ok = await sendEmail(job.email, job.name, task.type, job.appt);
        if (ok) { task.sent = true; updated = true; sent++; }
      }
    }

    if (updated) {
      if (job.jobs.every(t => t.sent)) {
        await store.delete(blob.key);
      } else {
        await store.setJSON(blob.key, job);
      }
    }
  }

  console.log(`Cron complete — sent ${sent} email(s)`);
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};
