/* Persistence: an append-only operation log over the untouched baseline.
   Adapters: shared page database (hosted artifact) > Supabase (if configured) > this browser (localStorage). */
(function(root){
'use strict';
const LS='cf_ops_v1', LSD='cf_dataset_v1';
const mem={};
const lsGet=k=>{ if(k in mem) return mem[k]; try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
const lsSet=(k,v)=>{ mem[k]=v; try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } };
function local(){ return { kind:'local', label:'Saved in this browser',
  async load(){ return lsGet(LS)||[]; },
  async add(ops){ const all=(lsGet(LS)||[]).concat(ops); if(!lsSet(LS,all)) throw new Error('Browser storage is unavailable or full; change is NOT saved.'); },
  async remove(ids){ const s=new Set(ids); if(!lsSet(LS,(lsGet(LS)||[]).filter(o=>!s.has(o.id)))) throw new Error('Could not update browser storage.'); } }; }
function supabase(url,key){ const base=url.replace(/\/$/,'')+'/rest/v1/cf_ops', h={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const chk=async r=>{ if(!r.ok) throw new Error('Supabase '+r.status+': '+(await r.text()).slice(0,200)); return r; };
  return { kind:'supabase', label:'Shared database (Supabase)',
    async load(){ const out=[]; for(let from=0;;from+=1000){ const r=await chk(await fetch(base+'?select=data&order=created_at.asc,id.asc',{headers:Object.assign({Range:`${from}-${from+999}`},h)})); const j=await r.json(); out.push(...j.map(x=>x.data)); if(j.length<1000) return out; } },
    async add(ops){ await chk(await fetch(base,{method:'POST',headers:h,body:JSON.stringify(ops.map(o=>({id:o.id,data:o})))})); },
    async remove(ids){ for(let i=0;i<ids.length;i+=50) await chk(await fetch(base+'?id=in.('+ids.slice(i,i+50).map(encodeURIComponent).join(',')+')',{method:'DELETE',headers:h})); } }; }
function pagedb(db){ const col=db.collection('ops');
  return { kind:'pagedb', label:'Shared page database',
    async load(){ const q=await col.limit(1000).get(); return q.docs.map(d=>JSON.parse(JSON.stringify(d.data()))); },
    async add(ops){ for(const o of ops) await col.doc(o.id).set(o); },
    async remove(ids){ for(const id of ids) await col.doc(id).delete(); },
    subscribe(cb){ return col.limit(1000).onSnapshot(q=>{ if(!q.metadata.fromCache) cb(q.docs.map(d=>JSON.parse(JSON.stringify(d.data())))); },()=>{}); } }; }
/* column-wise packing with value dictionaries keeps a full workbook within browser storage limits */
function pack(tables){ const o={}; for(const[k,rows]of Object.entries(tables)){ const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))], dicts={};
  const series=cols.map((c,i)=>{ const v=rows.map(r=>r[c]??''), u=[...new Set(v)]; if(u.length<v.length*0.3&&u.length<5000){ const ix=new Map(u.map((x,n)=>[x,n])); dicts[i]=u; return v.map(x=>ix.get(x)); } return v; });
  o[k]={cols,dicts,rows:rows.map((_,r)=>series.map(s=>s[r]))}; } return o; }
function unpack(p){ const o={}; for(const[k,t]of Object.entries(p)) o[k]=t.rows.map(r=>Object.fromEntries(t.cols.map((c,i)=>[c,t.dicts[i]?t.dicts[i][r[i]]:r[i]]))); return o; }
const API={local,supabase,pagedb,
  loadDataset:()=>{ const d=lsGet(LSD); return d?{tables:unpack(d.packed)}:null; }, saveDataset:d=>lsSet(LSD,d?{packed:pack(d.tables)}:null), pack, unpack, lsGet, lsSet };
if(typeof module!=='undefined') module.exports=API; else root.Store=API;
})(typeof window!=='undefined'?window:globalThis);
