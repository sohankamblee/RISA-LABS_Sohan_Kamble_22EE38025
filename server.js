/* Local run: node server.js   (optional: GEMINI_API_KEY=... node server.js) */
const http=require('http'), fs=require('fs'), path=require('path');
const gemini=require('./api/gemini.js'), health=require('./api/health.js');
const port=process.env.PORT||3000;
http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url==='/api/gemini') return gemini(req,res);
  if(url==='/api/health') return health(req,res);
  if(url==='/'||url==='/index.html'){ res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(fs.readFileSync(path.join(__dirname,'public/index.html'))); }
  res.statusCode=404; res.end('Not found');
}).listen(port,'127.0.0.1',()=>console.log('Growth Center on http://localhost:'+port));
