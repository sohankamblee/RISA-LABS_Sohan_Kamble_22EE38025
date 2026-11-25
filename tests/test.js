/* node tests/test.js : engine, plan rules, copilot tools, grounding check, provider loops (with a scripted model), proxy guards. */
const assert=require('assert');
const {E,base,db}=require('./load.js'); const P=require('../src/plan.js'), C=require('../src/copilot.js');
let n=0; const t=async(name,fn)=>{ await fn(); n++; console.log('  ok',name); };
const op=(table,key,row,type='upsert')=>({id:'o'+Math.random(),ts:new Date().toISOString(),table,key,row,type});
(async()=>{
const d=db();
// Expected values below were computed independently with pandas (model/eda.py), not by this engine.
await t('final funnel equals independent calculation',()=>{ const x=E.snapshot(d,'2025-04-20').totals; assert.deepStrictEqual([x.identified,x.registered,x.confirmed,x.visitors,x.spend_inr,x.unregistered_walkins],[3625,2800,2500,2050,274000,125]); });
await t('31 Mar snapshot equals independent calculation',()=>{ const x=E.snapshot(d,'2025-03-31').totals; assert.deepStrictEqual([x.identified,x.registered,x.confirmed,x.spend_inr],[3320,2337,1962,248150]); });
await t('per-campaign attendees',()=>assert.deepStrictEqual(E.snapshot(d,'2025-04-20').campaigns.map(c=>c.attended),[390,340,175,385,275,195,165]));
await t('duplicates removed',()=>assert.deepStrictEqual(d.quality.duplicates_removed,{daily:2,history:4,checkins:20}));
await t('no future leakage before event',()=>{ const s=E.snapshot(d,'2025-03-31'); assert.strictEqual(s.totals.visitors,null); assert(s.campaigns.every(c=>c.attended===null&&c.show_rate===null));
  assert.strictEqual(E.query(d,'2025-03-31',{table:'checkins'}).matched_rows,0); assert(E.query(d,'2025-03-31',{table:'registrations',filters:[{field:'attended',op:'eq',value:'true'}]}).error);
  assert.strictEqual(E.engagementLift(d,'2025-03-31','brochure_download').with_event.attendance_rate,null); });
await t('target version switches with date',()=>{ assert.strictEqual(+E.targetAt(d,'2025-03-14').unique_external_visitors_goal,1800); assert.strictEqual(+E.targetAt(d,'2025-03-15').unique_external_visitors_goal,2200); });
await t('changed data: new spend flows to totals, campaign and verdict',()=>{ const d2=db([op('daily','X1',{activity_id:'X1',campaign_id:'C06',activity_date:'2025-04-10',impressions:0,clicks:0,landing_page_sessions:0,marketing_spend_inr:100000})]);
  assert.strictEqual(E.snapshot(d2,'2025-04-20').totals.spend_inr,374000); assert.strictEqual(E.decide(d2,'2025-04-20').decisions.find(r=>r.campaign_id==='C06').verdict,'CUT'); });
await t('changed data: denied check-in lowers visitors; delete and undo work',()=>{ const ids=base.checkins.filter(c=>c.person_id==='E0002');
  const ops=ids.map(c=>op('checkins',c.event_id,Object.assign({},c,{result:'denied'}))); assert.strictEqual(E.snapshot(db(ops),'2025-04-20').totals.visitors,2049); assert.strictEqual(E.snapshot(db([]),'2025-04-20').totals.visitors,2050);
  assert.strictEqual(E.snapshot(db([op('registrations','R0001',null,'delete')]),'2025-04-20').totals.registered,2799); });
await t('status change moves confirmed count',()=>assert.strictEqual(E.snapshot(db([op('history','H9',{history_id:'H9',registration_id:'R0001',effective_at:'2025-04-11 20:00:00',status:'cancelled'})]),'2025-04-20').totals.confirmed,2499));
await t('thresholds are editable constraints',()=>{ const d2=db([op('settings','cut_ratio',{key:'cut_ratio',value:3})]); assert.strictEqual(E.decide(d2,'2025-04-20').decisions.find(r=>r.campaign_id==='C03').verdict,'CHANGE'); });
await t('query engine',()=>{ const r=E.query(d,'2025-04-20',{table:'checkins',filters:[{field:'result',op:'eq',value:'admitted'},{field:'verification',op:'eq',value:'verified'},{field:'person_type',op:'eq',value:'external'}],group_by:['date'],metrics:[{op:'count_distinct',field:'person_id'}]});
  assert.deepStrictEqual(r.results.map(x=>x.count_distinct_person_id).sort(),[1345,1430]); assert(/does not contain/.test(E.query(d,'2025-04-20',{table:'people',group_by:['college']}).error)); });
await t('calculator',()=>{ assert.strictEqual(E.calculate('(2050-1800)/1800*100').result,13.888889); assert(E.calculate('process.exit()').error); assert(E.calculate('1/0').error); });
await t('allocator respects budget, caps and pauses',()=>{ const r=E.simulateBudget(d,'2025-04-20',{total_budget_inr:200000,allocations_inr:{C03:0}}); assert(Math.abs(r.scenario_spend_inr-200000)<5); assert.strictEqual(r.allocation.find(a=>a.campaign_id==='C03').scenario_inr,0);
  assert(r.allocation.every(a=>a.scenario_inr<=a.current_inr*2+1)); assert(E.simulateBudget(d,'2025-04-20',{total_budget_inr:1000,allocations_inr:{C01:5000}}).error);
  const big=E.simulateBudget(d,'2025-04-20',{total_budget_inr:900000}); assert(big.warnings.some(w=>/unallocated/.test(w))); });
await t('plan rules: no reading, small sample, ramp protection, stop, scale',()=>{ assert(P.evaluate([]).every(b=>b.verdict==='NOT STARTED'));
  const rd=(b,w,s,r,c,l)=>({bet_id:b,week_ending:w,spend_inr:s,registrations:r,confirmed:c,leading_value:l});
  const g=(rs,id)=>P.evaluate(rs).find(b=>b.id===id).verdict;
  assert.strictEqual(g([rd('B1','2027-02-13',1000,5,4,1)],'B1'),'INSUFFICIENT EVIDENCE');
  assert.strictEqual(g([rd('B1','2027-02-13',9000,50,45,10),rd('B1','2027-02-27',9000,50,45,12)],'B1'),'CHANGE');
  assert.strictEqual(g([rd('B1','2027-03-20',20000,100,90,10),rd('B1','2027-03-27',20000,100,90,12)],'B1'),'STOP');
  assert.strictEqual(g([rd('B5','2027-02-13',14000,82,70,2.2)],'B5'),'STOP');
  assert.strictEqual(g([rd('B3','2027-02-27',8000,300,280,20)],'B3'),'SCALE'); });
await t('plan rules match slide 3: leading indicators and guard rails',()=>{
  const rd=(b,w,s,r,c,l,x)=>Object.assign({bet_id:b,week_ending:w,spend_inr:s,registrations:r,confirmed:c,leading_value:l},x||{});
  const g=(rs,id)=>P.evaluate(rs).find(b=>b.id===id).verdict;
  // B2: reconfirm, opt-out, delivery
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,64)],'B2'),'HOLD');
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,64,{optout_pct:2,delivery_pct:97})],'B2'),'SCALE');
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,64,{optout_pct:4,delivery_pct:97})],'B2'),'CHANGE');
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,80,{optout_pct:6,delivery_pct:99})],'B2'),'STOP');
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,80,{optout_pct:1,delivery_pct:85})],'B2'),'STOP');
  assert.strictEqual(g([rd('B2','2027-04-07',0,0,0,50)],'B2'),'CHANGE');
  // B3: conversion and duplicates; integrity stop ignores sample size and ramp protection
  assert.strictEqual(g([rd('B3','2027-02-27',8000,300,280,10)],'B3'),'CHANGE');
  assert.strictEqual(g([rd('B3','2027-02-06',500,10,9,30,{dup_pct:8})],'B3'),'STOP');
  assert.strictEqual(g([rd('B3','2027-02-27',8000,300,280,'')],'B3'),'HOLD');
  assert.strictEqual(g([rd('B3','2027-03-20',10000,100,90,20),rd('B3','2027-03-27',10000,100,90,20)],'B3'),'STOP');
  // B4: active share
  assert.strictEqual(g([rd('B4','2027-03-06',12000,200,190,41)],'B4'),'CHANGE');
  assert.strictEqual(g([rd('B4','2027-03-06',12000,200,190,55)],'B4'),'SCALE');
  assert.strictEqual(g([rd('B4','2027-03-06',6000,100,95,20),rd('B4','2027-03-13',6000,100,95,25)],'B4'),'STOP');
  assert.strictEqual(g([rd('B4','2027-02-06',6000,100,95,20),rd('B4','2027-02-13',6000,100,95,25)],'B4'),'CHANGE');
  // B1: both cost and pace must fail; one alone only means CHANGE
  assert.strictEqual(g([rd('B1','2027-03-20',100000,700,650,25),rd('B1','2027-03-27',1000,10,9,25)],'B1'),'CHANGE');
  // B5: no stop below Rs 8k
  assert.strictEqual(g([rd('B5','2027-02-13',7000,42,38,2)],'B5'),'CHANGE');
});
const asof={v:'2025-03-31'}; const proposals=[];
const ctx={getDb:()=>d,asof:()=>asof.v,tasks:()=>P.SEED_TASKS,readings:()=>[],propose:p=>{proposals.push(p);return 'P'+proposals.length;}};
const run=C.makeRunner(ctx);
await t('every tool runs',()=>{ for(const [name,args] of [['get_overview',{}],['get_campaign_performance',{}],['get_decisions',{}],['compare_periods',{a_start:'2025-03-04',a_end:'2025-03-17',b_start:'2025-03-18',b_end:'2025-03-31'}],['query_data',{table:'daily',group_by:['campaign_name'],metrics:[{op:'sum',field:'clicks'}]}],['engagement_comparison',{event_type:'nurture_email_opened'}],['simulate_budget',{mode:'optimize',total_budget_inr:200000}],['calculate',{expression:'1+1'}],['list_tasks',{}],['get_plan',{}],['get_definitions',{}]]) { const r=run(name,args); assert(!r.error,name+': '+r.error); } });
await t('tool as_of cannot look into the future',()=>{ const r=run('get_overview',{as_of:'2025-04-20'}); assert.strictEqual(r.as_of,'2025-03-31'); assert.strictEqual(r.totals.visitors,null); assert(r.note); });
await t('proposals do not write; incomplete ones are rejected',()=>{ assert(run('propose_task',{title:'x'}).error); const r=run('propose_task',{title:'Pause creator spend',owner:'Nisha Rao',due_date:'2025-04-02',priority:'High',success_metric:'a',evidence:'b'}); assert(/AWAITING/.test(r.status)); assert.strictEqual(P.SEED_TASKS.length,8); });
await t('grounding check accepts traced figures and flags invented ones',()=>{ const src=[run('get_overview',{})];
  const ok=C.groundCheck('Registrations are 2,337 and spend is Rs 2,48,150 as of 2025-03-31.',src); assert.strictEqual(ok.unverified.length,0,ok.unverified.join()); const bad=C.groundCheck('We expect 4,812 visitors and a 93.7% show rate.',src); assert.strictEqual(bad.unverified.length,2); });
await t('Gemini loop: executes tools, echoes thought signature and id, supports follow-up history',async()=>{ const seen=[]; let k=0;
  const post=async(model,body)=>{ seen.push(JSON.parse(JSON.stringify(body))); k++; return {ok:true,status:200,data:{candidates:[{content: k===1?{role:'model',parts:[{functionCall:{id:'abc',name:'get_decisions',args:{}},thoughtSignature:'SIG'}]}:{role:'model',parts:[{text:'Creator Partners: CUT.'}]}}]}}; };
  const r=await C.runGemini({post,models:['m1'],system:'s',history:[{role:'user',text:'q0'},{role:'assistant',text:'a0',tools:[{name:'get_overview'}]}],question:'q1',run});
  assert.strictEqual(r.text,'Creator Partners: CUT.'); const turn=seen[1].contents; assert.strictEqual(turn[turn.length-2].parts[0].thoughtSignature,'SIG'); assert.strictEqual(turn[turn.length-1].parts[0].functionResponse.id,'abc'); assert.strictEqual(seen[0].contents.length,3); });
await t('Gemini loop: falls back to second model and surfaces errors',async()=>{ const used=[]; const r=await C.runGemini({post:async m=>{used.push(m); return m==='a'?{ok:false,status:404,data:{}}:{ok:true,data:{candidates:[{content:{parts:[{text:'hi'}]}}]}};},models:['a','b'],system:'',history:[],question:'q',run,sleep:async()=>{}}); assert.strictEqual(r.model,'b');
  await assert.rejects(C.runGemini({post:async()=>({ok:false,status:400,data:{error:{message:'bad key'}}}),models:['a'],system:'',history:[],question:'q',run}),/bad key/); });
await t('Claude adapter: tools are wired and instructions precede history',async()=>{ let got; const sample=async(msgs,o)=>{ got=msgs; const tool=o.tools.find(x=>x.name==='get_overview'); await tool.execute({}); return {text:'done'}; };
  const r=await C.runClaude({sample,system:'SYS',history:[],question:'hello',run}); assert.strictEqual(r.calls.length,1); assert(got[0].content.startsWith('<instructions>\nSYS')); });
await t('proxy guards',async()=>{ const h=require('../api/gemini.js'); const call=async(req)=>{ let out; await h(req,{setHeader(){},end(s){out={code:this.statusCode,body:s};}}); return out; };
  delete process.env.GEMINI_API_KEY; assert.strictEqual((await call({method:'POST',headers:{}})).code,500); process.env.GEMINI_API_KEY='test';
  assert.strictEqual((await call({method:'GET',headers:{}})).code,405); assert.strictEqual((await call({method:'POST',headers:{host:'a',origin:'http://evil'},socket:{}})).code,403);
  assert.strictEqual((await call({method:'POST',headers:{host:'a',origin:'http://a'},socket:{},body:{model:'../x',body:{}}})).code,400); delete process.env.GEMINI_API_KEY; });
console.log(n+' tests passed');
})().catch(e=>{ console.error(e); process.exit(1); });
