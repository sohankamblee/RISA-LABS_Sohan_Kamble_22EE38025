const fs=require('fs'),path=require('path'),E=require('../src/engine.js');
function unpack(p){const o={};for(const[k,t]of Object.entries(p))o[k]=t.rows.map(r=>Object.fromEntries(t.cols.map((c,i)=>[c,t.dicts[i]?t.dicts[i][r[i]]:r[i]])));return o;}
const base=unpack(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/baseline.json'))));
module.exports={E,base,db:(ops)=>E.prepare(E.materialize(base,ops||[]))};
