module.exports = (req, res) => {
  const out = { gemini: !!process.env.GEMINI_API_KEY };
  if (process.env.GEMINI_MODEL) out.models = [process.env.GEMINI_MODEL];
  // The Supabase anon key is designed to be public; access is controlled by the row-level policies in supabase.sql.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) out.supabase = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  res.statusCode = 200; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(out));
};
