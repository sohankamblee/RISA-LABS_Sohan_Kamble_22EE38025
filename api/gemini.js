/* Serverless proxy so the Gemini key never reaches the browser. Basic abuse limits; see README "Known limitations". */
const ALLOWED = /^gemini-[a-z0-9.\-]+flash[a-z0-9.\-]*$/;
const hits = new Map();
module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error:'POST only' });
  if (!process.env.GEMINI_API_KEY) return send(500, { error:'GEMINI_API_KEY is not set on the server' });
  const origin = req.headers.origin, host = req.headers.host;
  let originHost = null; try { originHost = origin && new URL(origin).host; } catch (e) {}
  if (originHost !== host) return send(403, { error:'Cross-origin requests are not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0];
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= 40) return send(429, { error:'Too many requests; wait a minute' });
  list.push(now); hits.set(ip, list);
  try {
    let payload = req.body;
    if (!payload || typeof payload === 'string') {
      const raw = typeof payload === 'string' ? payload : await new Promise((ok, no) => { let s=''; req.on('data', c => { s+=c; if (s.length > 900000) { no(new Error('too large')); req.destroy(); } }); req.on('end', () => ok(s)); req.on('error', no); });
      payload = JSON.parse(raw || '{}');
    }
    const { model, body } = payload;
    if (!ALLOWED.test(model || '') || !body || JSON.stringify(body).length > 900000) return send(400, { error:'Invalid model or request too large' });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':process.env.GEMINI_API_KEY }, body:JSON.stringify(body) });
    send(r.status, await r.json().catch(() => ({ error:'Invalid response from model API' })));
  } catch (e) { send(502, { error:'Proxy error: ' + e.message }); }
};
