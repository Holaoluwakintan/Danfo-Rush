// Challenge links: /c/<score>/<nick> -> WhatsApp-friendly preview, then into the game with the score to beat.
module.exports = (req, res) => {
  const q = req.query || {};
  const s = Math.max(0, Math.min(9999999, parseInt(q.s, 10) || 0));
  const n = String(q.n || 'Your friend').replace(/[^A-Za-z0-9 _.\-]/g, '').slice(0, 16) || 'Your friend';
  const host = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'danfo-rush-ng.vercel.app');
  const fmt = s.toLocaleString('en-US');
  const target = `/?c=${s}&n=${encodeURIComponent(n)}`;
  const title = `${n} dey challenge you: beat ${fmt} in Danfo Rush 🚌💨`;
  const desc = 'Dodge okadas, potholes and LASTMA through Lagos traffic. Free, plays in your browser, works offline.';
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${host}/og-challenge.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${host}/c/${s}/${encodeURIComponent(n)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head>
<body style="background:#150c26;color:#fff;font-family:system-ui;text-align:center;padding:40px">
<p>Loading Danfo Rush…</p><a style="color:#FFC21A" href="${esc(target)}">Tap here if it doesn't open</a>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`);
};
