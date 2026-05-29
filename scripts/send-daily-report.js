// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// აუზების დღიური რეპორტის ავტომატური მეილი (სერვერული მხარე)
// გაშვებულია GitHub Actions-ით 10:00 და 18:00 (Asia/Tbilisi).
// კითხულობს Firestore-დან დღევანდელ რეპორტებს, აგებს HTML-ს
// და აგზავნის EmailJS-ის REST API-ით — ბრაუზერის გახსნა საჭირო არ არის.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const admin = require('firebase-admin');

// ── კონფიგურაცია (env-დან, ნაგულისხმევები index.html-ის შესაბამისი) ──
const EMAIL_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || 'service_uc9t7c5';
const EMAIL_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_c80oqpl';
const EMAIL_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || 'gMuchMs4-Nz5YFLch';
const EMAIL_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY; // secret — სავალდებულო
const REPORT_EMAIL      = process.env.REPORT_EMAIL        || 'a.gaiparashvili@lopotaresort.com';

const CHEMICALS = ['ქლორი (კგ)', 'pH+ (ლ)', 'pH- (ლ)', 'ალგეციდი (ლ)', 'ქლორი ტაბლეტი (კგ)'];

// ── HTML escape (index.html-ის e()-ის იდენტური) ──
function e(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sl(s) { return String(s).replace(/[^\wა-ჿ]/g, '_'); }

// ── getChem (index.html-ის იდენტური, ძველი მონაცემების თავსებადობით) ──
function getChem(chems, name) {
  if (!chems) return 0;
  if (chems[name] != null && chems[name] !== 0) return Number(chems[name]);
  const slug = sl(name);
  if (chems[slug] != null && chems[slug] !== 0) return Number(chems[slug]);
  const aliases = {
    'pH+ (ლ)': ['pH+ (კგ)', 'pH___კგ_', 'pH___ლ_'],
    'pH- (ლ)': ['pH- (კგ)', 'pH___კგ_', 'pH___ლ_'],
    'ალგეციდი (ლ)': ['ალგეციდი (კგ)', 'ალგეციდი__კგ_', 'ალგეციდი__ლ_'],
    'ქლორი ტაბლეტი (კგ)': ['ქლორი ტაბლეტი (ცალი)', 'ქლორი_ტაბლეტი__კგ_', 'ქლორი_ტაბლეტი__ცალი_'],
    'ქლორი (კგ)': ['ქლორი__კგ_'],
  };
  for (const alt of (aliases[name] || [])) {
    if (chems[alt] != null && chems[alt] !== 0) return Number(chems[alt]);
  }
  const nameLower = name.toLowerCase();
  for (const k of Object.keys(chems)) {
    if (k.toLowerCase() === nameLower) return Number(chems[k]) || 0;
  }
  if (chems[name] != null) return Number(chems[name]);
  if (chems[slug] != null) return Number(chems[slug]);
  return 0;
}

// ── დღიური HTML ცხრილი + ქიმიკატების ჯამი (ლიტრი/კგ ცალკე) ──
function buildDailyHTMLTable(reports, today) {
  const todayReps = reports.filter(r => r.date === today);
  if (!todayReps.length) return '<p>დღეს რეპორტი არ არის.</p>';
  let html = `<h2 style="font-family:sans-serif;color:#0077b6">🏊 აუზების დღიური რეპორტი — ${today}</h2>`;
  for (const r of todayReps) {
    const shift = r.shift === 'morning' ? '🌅 დილა' : '🌙 საღამო';
    html += `<h3 style="font-family:sans-serif;margin-top:20px">${shift} | ${e(r.operatorName || '')}</h3>`;
    html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;min-width:600px">
      <thead style="background:#0077b6;color:white">
        <tr><th>აუზი</th><th>PH</th><th>ქლ.(მგ/ლ)</th><th>ზედაპირი</th><th>ფილტრი</th><th>გაჩოთქვა</th><th>ცხაური</th>${CHEMICALS.map(c => `<th>${e(c)}</th>`).join('')}<th>კომენტარი</th></tr>
      </thead><tbody>`;
    for (const [pool, pd] of Object.entries(r.pools || {})) {
      const phColor = pd.ph && (pd.ph < 7.2 || pd.ph > 7.8) ? '#fecaca' : '';
      const clColor = pd.cl && (pd.cl < 1.0 || pd.cl > 3.0) ? '#fecaca' : '';
      html += `<tr>
        <td style="font-weight:600">${e(pool)}</td>
        <td style="background:${phColor}">${pd.ph ?? '—'}</td>
        <td style="background:${clColor}">${pd.cl ?? '—'}</td>
        <td>${pd.surf === 'yes' ? '✅' : pd.surf === 'no' ? '❌' : '—'}</td>
        <td>${pd.filt === 'yes' ? '✅' : pd.filt === 'no' ? '❌' : '—'}</td>
        <td>${pd.spla === 'yes' ? '✅' : pd.spla === 'no' ? '❌' : '—'}</td>
        <td>${pd.grid === 'yes' ? '✅' : pd.grid === 'no' ? '❌' : '—'}</td>
        ${CHEMICALS.map(c => `<td>${getChem(pd.chems, c)}</td>`).join('')}
        <td>${e(r.comment || '')}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    if (r.comment) html += `<p style="font-family:sans-serif;font-size:13px;color:#555;margin-top:6px">💬 <b>კომენტარი:</b> ${e(r.comment)}</p>`;
  }
  // ── ქიმიკატების ჯამი (ლიტრი ცალკე, კილოგრამი ცალკე) ──
  const chemTotals = {};
  CHEMICALS.forEach(c => chemTotals[c] = 0);
  let totalChemL = 0, totalChemKg = 0;
  for (const r of todayReps) {
    for (const pd of Object.values(r.pools || {})) {
      CHEMICALS.forEach(c => { chemTotals[c] += getChem(pd.chems, c); });
    }
  }
  Object.entries(chemTotals).forEach(([c, v]) => {
    const unit = (c.match(/\(([^)]+)\)/) || [])[1] || '';
    if (unit === 'კგ') totalChemKg += v;
    else if (unit === 'ლ') totalChemL += v;
  });
  html += `<h3 style="font-family:sans-serif;margin-top:24px">⚗️ ქიმიკატების ჯამი (დღე)</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <thead style="background:#0077b6;color:white"><tr><th>ქიმიკატი</th><th>ჯამი</th></tr></thead><tbody>
      ${CHEMICALS.map(c => { const unit = (c.match(/\(([^)]+)\)/) || [])[1] || ''; const v = chemTotals[c]; return `<tr><td>${e(c)}</td><td style="text-align:right">${v % 1 === 0 ? v : v.toFixed(2)} ${unit}</td></tr>`; }).join('')}
      <tr style="font-weight:bold;background:#e0f2fe"><td>📦 სულ (ლიტრი)</td><td style="text-align:right">${totalChemL.toFixed(1)} ლ</td></tr>
      <tr style="font-weight:bold;background:#e0f2fe"><td>📦 სულ (კილოგრამი)</td><td style="text-align:right">${totalChemKg.toFixed(1)} კგ</td></tr>
      </tbody></table>`;
  return html;
}

// ── EmailJS REST API-ით გაგზავნა ──
async function sendEmail(html, today, shiftLabel) {
  const payload = {
    service_id: EMAIL_SERVICE_ID,
    template_id: EMAIL_TEMPLATE_ID,
    user_id: EMAIL_PUBLIC_KEY,
    accessToken: EMAIL_PRIVATE_KEY,
    template_params: {
      to_email: REPORT_EMAIL,
      subject: `🏊 აუზების რეპორტი — ${today} ${shiftLabel}`,
      html_content: html,
      date: today,
      shift_label: shiftLabel,
    },
  };
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS ${res.status}: ${text}`);
  }
}

async function main() {
  if (!EMAIL_PRIVATE_KEY) throw new Error('EMAILJS_PRIVATE_KEY secret არ არის მითითებული');

  // Firebase Admin ინიციალიზაცია service account-ით
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!svc.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT secret არ არის მითითებული');
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  const db = admin.firestore();

  const today = new Date().toISOString().slice(0, 10);

  // დღევანდელი რეპორტების წამოღება
  const snap = await db.collection('pool_reports').where('date', '==', today).get();
  const reports = snap.docs.map(d => d.data());

  if (!reports.length) {
    console.log(`ℹ️  ${today}: დღევანდელი რეპორტი არ მოიძებნა — მეილი არ იგზავნება.`);
    return;
  }

  // ცვლის წარწერა გაშვების საათის მიხედვით (Tbilisi)
  const hourTbilisi = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', hour12: false }).format(new Date())
  );
  const shiftLabel = hourTbilisi < 15 ? '🌅 დილა (10:00)' : '🌙 საღამო (18:00)';

  const html = buildDailyHTMLTable(reports, today);
  await sendEmail(html, today, shiftLabel);
  console.log(`✅ მეილი გაიგზავნა: ${REPORT_EMAIL} | ${today} ${shiftLabel} | რეპორტები: ${reports.length}`);
}

main().catch(err => { console.error('❌ შეცდომა:', err.message); process.exit(1); });
