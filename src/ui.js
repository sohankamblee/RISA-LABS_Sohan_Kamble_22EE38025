(function(){
'use strict';
const E=window.Engine, P=window.Plan, C=window.Copilot, Store=window.Store;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'—':typeof v==='number'?v.toLocaleString('en-IN',{maximumFractionDigits:2}):esc(v);
const rs=v=>v==null?'—':(v<0?'−':'')+'₹'+Math.abs(Math.round(v)).toLocaleString('en-IN');
const pc=(v,d=1)=>v==null?'—':(v*100).toFixed(d)+'%';
const tag=v=>`<span class="tag t-${esc(String(v).split(' ')[0])}">${esc(v)}</span>`;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toLocaleDateString('en-CA');
const ORIGINAL=Store.unpack(window.BASELINE);

const st={ base:null, ops:[], db:null, asof:null, tab:'overview', store:Store.local(), chat:Store.lsGet('cf_chat_v1')||[], busy:false, provider:null, sample:null, health:{}, dl:null, custom:false, scenario:null, filter:'' };
function loadBase(){ const up=Store.loadDataset(); st.custom=!!up; st.base=Object.assign({}, up?up.tables:ORIGINAL, {tasks:P.SEED_TASKS, readings:[], settings:[]}); }
function rebuild(){ st.db=E.prepare(E.materialize(st.base,st.ops)); }
const version=()=>st.ops.map(o=>o.id).join('|').length+':'+st.ops.length+':'+st.asof+':'+(st.custom?'up':'orig');
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',4200);}
async function commit(list,msg){
  const ts=new Date().toISOString(); const ops=list.map((o,i)=>Object.assign({id:uid()+i,ts,actor:'team',type:'upsert'},o));
  try{ await st.store.add(ops); }catch(e){ toast('Not saved: '+e.message); return false; }
  const have=new Set(st.ops.map(o=>o.id)); st.ops=st.ops.concat(ops.filter(o=>!have.has(o.id))); rebuild(); render(); toast(msg||'Saved'); return true;
}
async function undo(ids){ try{ await st.store.remove(ids); }catch(e){ return toast('Not removed: '+e.message); } const s=new Set(ids); st.ops=st.ops.filter(o=>!s.has(o.id)); rebuild(); render(); toast('Reverted'); }
function ask(title,html,okText){ return new Promise(res=>{ const d=$('#dlg'); d.innerHTML=`<h3 style="margin-top:0">${esc(title)}</h3>${html}<p style="text-align:right"><button class="btn" value="no" id="dno">Cancel</button> <button class="btn p" id="dyes">${esc(okText||'Confirm')}</button></p>`;
  const done=v=>{const vals={};d.querySelectorAll('[name]').forEach(x=>vals[x.name]=x.value);d.close();res(v?vals:null);}; d.querySelector('#dyes').onclick=()=>done(true); d.querySelector('#dno').onclick=()=>done(false); d.oncancel=()=>res(null); d.showModal(); }); }
const table=(head,rows)=>`<div class="scroll"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}" class="mut">Nothing to show.</td></tr>`}</tbody></table></div>`;
const opt=(list,sel)=>list.map(o=>{const[v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${String(v)===String(sel)?' selected':''}>${esc(l)}</option>`}).join('');
const campOpts=()=>st.db.T.campaigns.map(c=>[c.campaign_id,c.campaign_name]);
const owners=()=>[...new Set([...st.db.T.campaigns.map(c=>c.owner_name),...st.db.T.tasks.map(t=>t.owner)].filter(Boolean))];
const cname=id=>(st.db.campaigns.get(id)||{}).campaign_name||id||'—';
const openTasks=()=>st.db.T.tasks.filter(t=>t.status!=='Done');

/* ---------- charts ---------- */
function funnel(s){ const t=s.totals; const steps=[['Impressions (events)',t.impressions],['Clicks (events)',t.clicks],['Landing sessions',t.sessions],['Identified people',t.identified],['Registered',t.registered],['Confirmed',t.confirmed],['Verified visitors',t.visitors]];
  const max=Math.log10(Math.max(10,steps[0][1]));
  return table(['Stage','Count','From previous',''],steps.map((x,i)=>{const prev=i?steps[i-1][1]:null; let conv=prev&&x[1]!=null?pc(x[1]/prev):'—'; if(i===3) conv='<span title="Anonymous sessions to identified people: different units">'+conv+'*</span>'; if(i===6&&x[1]!=null) conv=pc(t.show_rate)+' show†';
    return [esc(x[0]),fmt(x[1]),conv,`<div class="bar" style="width:180px"><i style="width:${x[1]?Math.max(2,Math.log10(x[1])/max*100):0}%"></i></div>`];}))+
    `<div class="small mut">Bars use a log scale. *Sessions are anonymous and can repeat; identified includes people from other routes. †Show rate = registered attendees / registered. ${t.visitors==null?'Visitors appear on or after the event date.':'Visitors also include '+fmt(t.unregistered_walkins)+' unregistered walk-ins.'}</div>`; }
function pacing(){ const db=st.db, ev=E.eventInfo(db), asof=st.asof, W=640,H=200,L=40,B=20;
  const t0=Date.parse(ev.first), t1=Date.parse(ev.starts); const x=d=>L+(Math.min(t1,Date.parse(d))-t0)/(t1-t0)*(W-L-8);
  const regs=db.T.registrations.filter(r=>r.registered_at.slice(0,10)<=asof&&(db.people.get(r.person_id)||{}).person_type==='external').map(r=>r.registered_at.slice(0,10)).sort();
  const goal=+((E.targetAt(db,asof)||{}).registration_goal||0); const ymax=Math.max(goal,regs.length,1)*1.08; const y=v=>H-B-v/ymax*(H-B-8);
  let n=0; const pts=[`${L},${y(0)}`]; const m=new Map(); for(const d of regs){n++;m.set(d,n);} for(const[d,v]of m) pts.push(`${x(d).toFixed(1)},${y(v).toFixed(1)}`);
  const pr=E.snapshot(db,asof).projection; const proj=pr.type==='forecast'?`<line x1="${x(asof)}" y1="${y(regs.length)}" x2="${x(ev.starts)}" y2="${y(pr.projected_registrations)}" stroke="#1f5eff" stroke-dasharray="5 4" stroke-width="2"/>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative registrations against goal">${[0,.25,.5,.75,1].map(f=>`<line x1="${L}" x2="${W}" y1="${y(ymax*f)}" y2="${y(ymax*f)}" stroke="#eef1f5"/><text x="2" y="${y(ymax*f)+4}">${Math.round(ymax*f/100)*100}</text>`).join('')}
  <line x1="${L}" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="#b3261e" stroke-dasharray="3 3"/><text x="${L+4}" y="${y(goal)-4}">Registration goal ${fmt(goal)}</text><polyline fill="none" stroke="#1f5eff" stroke-width="2.5" points="${pts.join(' ')}"/>${proj}<text x="${L}" y="${H-5}">${ev.first}</text><text x="${W-70}" y="${H-5}">${ev.starts}</text></svg><div class="small mut">Solid: actual cumulative external registrations. Dashed: run-rate projection.</div>`; }

/* ---------- views ---------- */
const V={};
V.overview=()=>{ const s=E.snapshot(st.db,st.asof), t=s.totals, pr=s.projection, d=E.decide(st.db,st.asof);
  const kp=s.targets_vs_actuals.map(m=>{const lab={identified_external_people:'Identified people',registrations:'Registrations',verified_external_visitors:'Verified visitors',marketing_spend_inr_vs_budget_limit:'Spend vs budget limit'}[m.metric]; const money=m.metric.startsWith('marketing');
    return `<div class="kpi"><span class="mut">${lab}</span><b>${m.actual==null?'Not yet':money?rs(m.actual):fmt(m.actual)}</b><span class="small">of ${money?rs(m.target):fmt(m.target)}${m.actual==null?' (event not started)':` · ${pc(m.pct_of_target,0)} · ${m.gap>=0?'+':''}${money?rs(m.gap):fmt(m.gap)}`}</span><div class="bar"><i style="width:${Math.min(100,(m.pct_of_target||0)*100)}%"></i></div></div>`;}).join('');
  const proj= pr.type==='forecast'?`<p><b style="font-size:20px">${fmt(pr.projected_visitors)}</b> projected visitors (range ${fmt(pr.range_visitors[0])}–${fmt(pr.range_visitors[1])}), ${pr.visitor_goal_gap>=0?'+':''}${fmt(pr.visitor_goal_gap)} vs goal. ${fmt(pr.projected_registrations)} projected registrations; projected spend ${rs(pr.projected_spend_inr)}. ${pr.days_to_event} days to event.</p><ul class="small mut">${pr.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:`<p>${esc(pr.note)} ${pr.projected_visitors!=null?`<b>${fmt(pr.projected_visitors)}</b> verified external visitors.`:''}</p>`;
  const attention=d.decisions.filter(r=>['CUT','CHANGE'].includes(r.verdict)).map(r=>`<li>${tag(r.verdict)} <b>${esc(r.name)}</b>: ${esc(r.reason)}</li>`);
  const od=openTasks().filter(x=>x.due_date<today()).length;
  const alloc=s.campaigns.reduce((a,c)=>a+(c.planned_budget_inr||0),0);
  return `<div class="kpis">${kp}</div><div class="two"><div class="card"><h2>Growth funnel</h2>${funnel(s)}</div><div><div class="card"><h2>Projected outcome</h2>${proj}</div><div class="card"><h2>Registration pacing</h2>${pacing()}</div></div></div>
  <div class="two"><div class="card"><h2>Needs attention</h2><ul>${attention.join('')||'<li class="mut">No campaign is currently flagged CUT or CHANGE.</li>'}</ul></div><div class="card"><h2>Execution and budget</h2><p>${openTasks().length} open tasks · ${st.db.T.tasks.filter(x=>x.status==='Done').length} done · ${st.db.T.tasks.filter(x=>x.status==='Blocked').length} blocked · ${od} overdue against today's date.</p><p>Spend ${rs(t.spend_inr)}${t.credits_inr?` (net of ${rs(-t.credits_inr)} vendor credits)`:''}. Cost per registration ${rs(t.cost_per_registration)}${t.cost_per_visitor?`, per visitor ${rs(t.cost_per_visitor)}`:''}.${alloc?` Planned campaign budgets entered by the team: ${rs(alloc)}.`:''}</p><p class="small mut">Target version in force: ${esc(s.target_version||'none')}. Data quality: ${Object.entries(s.data_quality.duplicates_removed).map(([k,v])=>`${v} duplicate ${k} rows removed`).join(', ')||'no duplicates found'}${Object.keys(s.data_quality.conflicting_duplicates).length?' · CONFLICTING duplicates: '+esc(JSON.stringify(s.data_quality.conflicting_duplicates)):''}${Object.keys(s.data_quality.orphan_rows).length?' · rows with unknown person: '+esc(JSON.stringify(s.data_quality.orphan_rows)):''}.</p></div></div>`; };

V.campaigns=()=>{ const s=E.snapshot(st.db,st.asof), post=s.attendance_observable, dg=E.diagnose(s);
  const ev=E.eventInfo(st.db), end=st.asof<ev.starts?st.asof:E.addDays(ev.starts,-1), b0=E.addDays(end,-13), a1=E.addDays(b0,-1), a0=E.addDays(a1,-13);
  const cmp=E.comparePeriods(st.db,a0,a1,b0,end);
  return `<div class="card"><h2>Campaign KPIs (as of ${st.asof})</h2>${table(['Campaign','Spend','Impr.','CTR','Sessions','Identified','Registered','Confirmed','Confirm %','Attended','Show %','₹/reg','₹/attendee'],s.campaigns.map(c=>[`<b>${esc(c.name)}</b><br><span class="small mut">${c.campaign_id} · ${esc(c.owner)} · ${esc(c.plan_status)}</span>`,rs(c.spend_inr),fmt(c.impressions),pc(c.ctr,2),fmt(c.sessions),fmt(c.identified),fmt(c.registered),fmt(c.confirmed),pc(c.registered_to_confirmed),fmt(c.attended),pc(c.show_rate),rs(c.cost_per_registration),rs(c.cost_per_attendee)]))}${post?'':'<div class="small mut">Attendance columns stay empty before the event: later outcomes are hidden at this as-of date.</div>'}</div>
  <div class="card"><h2>Bottlenecks: each campaign against the pooled rate of the others</h2>${table(['Campaign','Weakest stage','Its rate','Peers','Gap','Units lost vs peers'],dg.map(d=>d.bottleneck?[esc(d.name),esc(d.bottleneck.stage),pc(d.bottleneck.rate,2),pc(d.bottleneck.peer_rate,2),pc(d.bottleneck.relative_gap,0),fmt(d.bottleneck.units_lost_vs_peers)]:[esc(d.name),'<span class="mut">No stage more than 8% below peers (sample ≥30)</span>','','','','']))}<div class="small mut">A gap shows where to investigate. It does not prove why.</div></div>
  <div class="card"><h2>What is driving the change: ${a0} to ${a1} vs ${b0} to ${end}</h2><p>Registrations ${fmt(cmp.period_a.registrations)} → <b>${fmt(cmp.period_b.registrations)}</b> (${cmp.registration_change>=0?'+':''}${fmt(cmp.registration_change)}). Spend ${rs(cmp.period_a.spend_inr)} → ${rs(cmp.period_b.spend_inr)}.${cmp.decomposition?` Arithmetic split: session volume ${cmp.decomposition.from_session_volume}, registrations per session ${cmp.decomposition.from_conversion_per_session}.`:''}</p>${table(['Campaign','Earlier','Later','Change'],cmp.contribution_by_campaign.map(c=>[esc(c.campaign),c.period_a,c.period_b,(c.change>0?'+':'')+c.change]))}</div>`; };

V.decisions=()=>{ const d=E.decide(st.db,st.asof), S=E.settingsOf(st.db), s=E.snapshot(st.db,st.asof);
  const sc=st.scenario;
  return `<div class="card"><h2>Scale / change / stop (${esc(d.basis)}; blended ${rs(d.blended_unit_cost_inr)})</h2>${table(['Priority','Verdict','Why','Main bottleneck','Action'],d.decisions.map((r,i)=>[`${i+1}. <b>${esc(r.name)}</b><br><span class="small mut">${esc(r.owner)}</span>`,tag(r.verdict),`<div style="text-align:left">${esc(r.reason)}</div>`,`<div style="text-align:left">${esc(r.main_bottleneck)}</div>`,`<button class="btn" data-act="dtask" data-id="${r.campaign_id}">Create task</button>`]))}<ul class="small mut">${d.caveats.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>
  <div class="card"><h2>Thresholds and constraints (change them and verdicts recompute)</h2><form class="form" data-form="settings">${[['scale_ratio','Scale if cost ≤ × blended'],['change_ratio','Change if ≥ ×'],['cut_ratio','Cut if ≥ ×'],['min_regs','Min registrations'],['min_spend','Min spend ₹'],['quality_gap_pp','Quality guard (points)'],['assumed_show_rate','Assumed show rate (0–1)'],['assumed_walkins','Assumed walk-ins'],['elasticity','Spend elasticity']].map(([k,l])=>`<label>${l}<input name="${k}" type="number" step="any" value="${S[k]}"></label>`).join('')}<button class="btn p">Save settings</button></form></div>
  <div class="card"><h2>Budget allocator</h2><form class="form" data-form="scenario"><label>Total budget ₹<input name="total" type="number" value="${sc?sc.total:Math.max(0,s.totals.spend_inr)}"></label><label>Max × current per channel<input name="max" type="number" step="0.1" value="${sc?sc.max:2}"></label>${s.campaigns.filter(c=>c.spend_inr>0).map(c=>`<label>${esc(c.name)} fix at ₹<input name="fix_${c.campaign_id}" type="number" placeholder="free" value="${sc&&sc.fix[c.campaign_id]!=null?sc.fix[c.campaign_id]:''}"></label>`).join('')}<button class="btn p">Optimise</button></form>${sc&&sc.result?(sc.result.error?`<p class="note">${esc(sc.result.error)}</p>`:`<p>Modelled attributed attendees: ${fmt(sc.result.current_attributed_attendees)} → <b>${fmt(sc.result.scenario_attributed_attendees)}</b> (${sc.result.change>=0?'+':''}${fmt(sc.result.change)}) at elasticity ${sc.result.elasticity_assumption}. At 0.5: ${fmt(sc.result.sensitivity['elasticity_0.5'])}; at 0.9: ${fmt(sc.result.sensitivity['elasticity_0.9'])}.</p>${table(['Campaign','Current','Scenario','Change','Modelled attendees'],sc.result.allocation.map(a=>[esc(a.name),rs(a.current_inr),rs(a.scenario_inr),rs(a.change_inr),fmt(a.scenario_attendees)]))}<ul class="small mut">${[...sc.result.warnings,...sc.result.caveats].map(w=>`<li>${esc(w)}</li>`).join('')}</ul><button class="btn p" data-act="applyscen">Save as planned campaign budgets</button>`):'<p class="small mut">Fix any channel (0 pauses it); the rest is split to maximise modelled attendees.</p>'}</div>`; };

const STATUSES=['To do','In progress','Blocked','Done'];
V.execution=()=>{ const tasks=st.db.T.tasks.slice().sort((a,b)=>(a.status==='Done')-(b.status==='Done')||String(a.due_date).localeCompare(String(b.due_date)));
  return `<div class="card"><h2>Tasks and action items</h2><form class="form" data-form="task"><label style="grid-column:span 2">Task<input name="title" required></label><label>Owner<input name="owner" list="owners" required></label><label>Due<input name="due_date" type="date" required></label><label>Priority<select name="priority">${opt(['High','Medium','Low'],'Medium')}</select></label><label>Campaign<select name="campaign_id">${opt([['','—'],...campOpts()],'')}</select></label><button class="btn p">Add task</button></form><datalist id="owners">${owners().map(o=>`<option value="${esc(o)}">`).join('')}</datalist>
  ${table(['Task','Owner','Due','Priority','Status','Source',''],tasks.map(t=>[`<div style="text-align:left;min-width:220px"><b>${esc(t.title)}</b><br><span class="small mut">${esc(cname(t.campaign_id))}${t.tag?' · '+esc(t.tag):''}${t.success_metric?'<br>Success: '+esc(t.success_metric):''}${t.evidence?'<br>Evidence: '+esc(t.evidence):''}${t.notes?'<br>Note: '+esc(t.notes):''}</span></div>`,`<input style="width:110px" value="${esc(t.owner)}" list="owners" data-task="${esc(t.task_id)}" data-k="owner">`,`<input type="date" value="${esc(t.due_date)}" data-task="${esc(t.task_id)}" data-k="due_date">${t.status!=='Done'&&t.due_date<today()?'<br>'+tag('CHANGE overdue'):''}`,esc(t.priority),`<select data-task="${esc(t.task_id)}" data-k="status">${opt(STATUSES,t.status)}</select>`,`<span class="small">${esc(t.source)}${t.workspace?'<br>'+esc(t.workspace):''}</span>`,`<button class="btn" data-act="note" data-id="${esc(t.task_id)}">Note</button> <button class="btn d" data-act="deltask" data-id="${esc(t.task_id)}">Delete</button>`]))}</div>
  <div class="card"><h2>Campaigns</h2>${table(['Campaign','Owner','Plan status','Planned budget ₹','Open tasks'],st.db.T.campaigns.map(c=>[`<b>${esc(c.campaign_name)}</b> <span class="small mut">${esc(c.campaign_id)} · ${esc(c.channel)}</span>`,`<input style="width:120px" value="${esc(c.owner_name)}" data-camp="${esc(c.campaign_id)}" data-k="owner_name">`,`<select data-camp="${esc(c.campaign_id)}" data-k="plan_status">${opt(['active','scale','change','paused'],c.plan_status||'active')}</select>`,`<input type="number" style="width:110px" value="${esc(c.planned_budget_inr??'')}" data-camp="${esc(c.campaign_id)}" data-k="planned_budget_inr">`,openTasks().filter(t=>t.campaign_id===c.campaign_id).length]))}
  <h2 style="margin-top:12px">Add a campaign</h2><form class="form" data-form="campaign"><label>Name<input name="campaign_name" required></label><label>Channel<input name="channel" required></label><label>Owner<input name="owner_name" list="owners" required></label><label>Planned budget ₹<input name="planned_budget_inr" type="number"></label><button class="btn p">Add campaign</button></form></div>
  <div class="card"><h2>Saved change log (${st.ops.length}) · ${esc(st.store.label)}</h2>${table(['When','Change',''],st.ops.slice().sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,40).map(o=>[esc(o.ts.slice(0,19).replace('T',' ')),`<div style="text-align:left">${esc(o.label||o.type+' '+o.table+' '+o.key)}</div>`,`<button class="btn" data-act="undo" data-id="${esc(o.id)}">Undo</button>`]))}${st.ops.length?'<p><button class="btn d" data-act="reset">Reset all changes (restore original data)</button></p>':''}</div>`; };

V.plan=()=>{ const ev=P.evaluate(st.db.T.readings);
  return `<div class="note"><b>Next-edition plan: Bengaluru, 10–11 April 2027.</b> Base 2,350 verified external visitors on ₹3,00,000; stretch 3,000 on ₹3,60,000. Everything on this tab is a plan or a team-entered reading, kept separate from the historical dataset. Readings marked "simulated" exist only to demonstrate the rules.</div>
  <div class="card"><h2>Five bets: live verdicts from weekly readings</h2>${table(['#','Bet','Budget','Verdict','Latest reading','Rules'],ev.map(b=>[b.rank,`<div style="text-align:left"><b>${esc(b.name)}</b><br><span class="small mut">${esc(b.call)}<br>Leading: ${esc(b.leading_indicator)} (target ${b.leading_target})</span></div>`,rs(b.budget_inr),`${tag(b.verdict)}${b.includes_simulated?'<br><span class="small">uses simulated data</span>':''}`,`<div style="text-align:left" class="small">${esc(b.reason)}${b.as_of_week?`<br>To ${b.as_of_week}: ${b.cumulative_registrations} regs, ${rs(b.cumulative_spend_inr)}, lead ${fmt(b.leading_value)}`:''}</div>`,`<div style="text-align:left;min-width:230px" class="small"><b>Scale:</b> ${esc(b.scale_rule)}<br><b>Change:</b> ${esc(b.change_rule)}<br><b>Stop:</b> ${esc(b.stop_rule)}</div>`]))}</div>
  <div class="card"><h2>Add a weekly reading (this week's increments)</h2><form class="form" data-form="reading"><label>Bet<select name="bet_id">${opt(P.BETS.map(b=>[b.id,b.name]))}</select></label><label>Week ending<input name="week_ending" type="date" required value="2027-02-13"></label><label>Spend ₹<input name="spend_inr" type="number" min="0" required></label><label>Registrations<input name="registrations" type="number" min="0" required></label><label>Of which confirmed<input name="confirmed" type="number" min="0" required></label><label>Leading indicator value<input name="leading_value" type="number" step="any"></label><label>Duplicate sign-ups % (B3)<input name="dup_pct" type="number" step="any" min="0" max="100"></label><label>Opt-out % (B2)<input name="optout_pct" type="number" step="any" min="0" max="100"></label><label>Delivery % (B2)<input name="delivery_pct" type="number" step="any" min="0" max="100"></label><label>Type<select name="source">${opt(['actual','simulated'])}</select></label><button class="btn p">Save reading</button></form><p><button class="btn" data-act="sim">Load simulated example weeks</button> <button class="btn" data-act="clearsim">Remove simulated readings</button></p>
  ${table(['Bet','Week','Spend','Regs','Confirmed','Lead','Dup %','Opt-out %','Delivery %','Type',''],st.db.T.readings.map(r=>[esc(r.bet_id),esc(r.week_ending),rs(+r.spend_inr),fmt(+r.registrations),fmt(+r.confirmed),esc(r.leading_value),esc(r.dup_pct??''),esc(r.optout_pct??''),esc(r.delivery_pct??''),esc(r.source),`<button class="btn d" data-act="delread" data-id="${esc(r.reading_id)}">Delete</button>`]))}</div>
  <div class="card"><h2>Whole-campaign tripwires (share of the 2,857 base registration plan)</h2>${table(['Date','Gate','Last edition share','Base plan registrations','Act if below 85%'],P.GATES.map(g=>[g.date,g.label,pc(g.share,0),fmt(Math.round(2857*g.share)),fmt(Math.round(2857*g.share*.85))]))}</div>`; };

const EDIT=['daily','people','registrations','history','checkins','interactions','campaigns','targets'];
V.data=()=>{ const T=st.db.T; const tb=st.etable||'daily', key=E.KEYS[tb]; const q=(st.filter||'').toLowerCase();
  const hits=T[tb].filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)).slice(0,12);
  return `<div class="note">Use this tab to change data and test that analytics and the copilot respond. Original rows are never overwritten: each change is a logged, reversible operation. Dataset in use: <b>${st.custom?'uploaded workbook':'original CampusFest 2025 workbook'}</b>.</div>
  <div class="card"><h2>Add or correct a daily marketing record</h2><form class="form" data-form="daily"><label>Campaign<select name="campaign_id">${opt(campOpts())}</select></label><label>Date<input type="date" name="activity_date" required value="${st.asof}"></label>${['impressions','clicks','reported_reach','landing_page_sessions','registration_starts','marketing_spend_inr'].map(f=>`<label>${f.replace(/_/g,' ')}<input type="number" name="${f}" value="0" required></label>`).join('')}<button class="btn p">Add record</button></form><p class="small mut">Adds a new record for that day. To correct an existing one, use the row editor below.</p></div>
  <div class="two"><div class="card"><h2>Register a person / change status</h2><form class="form" data-form="status"><label>Registration ID<input name="registration_id" placeholder="R0001" required></label><label>New status<select name="status">${opt(['confirmed','cancelled','waitlisted','interested'])}</select></label><label>Effective<input type="datetime-local" name="effective_at" value="${st.asof}T18:00" required></label><button class="btn p">Save status</button></form></div>
  <div class="card"><h2>Record a check-in</h2><form class="form" data-form="checkin"><label>Person ID<input name="person_id" placeholder="E0001" required></label><label>Time<input type="datetime-local" name="occurred_at" value="2025-04-13T12:00" required></label><label>Result<select name="result">${opt(['admitted','denied','pending'])}</select></label><label>Verification<select name="verification">${opt(['verified','unverified'])}</select></label><button class="btn p">Save check-in</button></form></div></div>
  <div class="card"><h2>New target version</h2><form class="form" data-form="target"><label>Effective<input type="datetime-local" name="effective_at" value="${st.asof}T09:00" required></label>${['identified_external_people_goal','registration_goal','unique_external_visitors_goal','marketing_budget_inr'].map(f=>`<label>${f.replace(/_/g,' ')}<input type="number" name="${f}" value="${esc((E.targetAt(st.db,st.asof)||{})[f]??'')}" required></label>`).join('')}<button class="btn p">Save targets</button></form></div>
  <div class="card"><h2>Row editor (any source table)</h2><div class="form"><label>Table<select id="etable">${opt(EDIT,tb)}</select></label><label>Search (ID, date, campaign ID…)<input id="efilter" value="${esc(st.filter)}"></label></div>${table(['Record',''],hits.map(r=>[`<code style="font-size:11px">${esc(JSON.stringify(r))}</code>`,`<button class="btn" data-act="editrow" data-id="${esc(r[key])}">Edit</button> <button class="btn d" data-act="delrow" data-id="${esc(r[key])}">Delete</button>`]))}<div class="small mut">Showing up to 12 matches of ${fmt(T[tb].length)} rows.</div></div>
  <div class="card"><h2>Replace the whole dataset / export</h2><p>Upload a workbook with the same sheet names and ID columns (for example, an edited copy of the original). It stays in this browser.</p><input type="file" id="upload" accept=".xlsx"> ${st.custom?'<button class="btn" data-act="restore">Restore original workbook</button>':''} <button class="btn" data-act="export">Download current data (.xlsx)</button></div>`; };

V.about=()=>`<div class="card"><h2>How to read this product</h2><ul><li><b>As-of date</b> works like "today". Nothing after the end of that day is shown or given to the copilot.</li><li>Replay 31 March to practise decisions 12 days before the event; select 20 April for final results.</li><li>Visitors = distinct external people with an admitted and verified check-in.</li><li>Attribution = recorded registration source. In this data it equals first touch, so assisted conversions cannot be measured.</li><li>Verdicts and the allocator use averages and an assumed elasticity. They are decision aids, not causal proof.</li></ul><h2>What the data cannot tell you</h2><ul>${C.DEFINITIONS.not_in_data.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;

const TABS=[['overview','Overview'],['campaigns','Diagnose'],['decisions','Decide'],['execution','Execute'],['plan','2027 Bets'],['data','Data'],['about','Method']];
function render(){
  if(!st.db) return;
  $('#nav').innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}" class="${st.tab===k?'on':''}">${l}</button>`).join('')+'<button data-act="togglechat" style="margin-left:auto">Show/hide copilot</button>';
  const a=document.activeElement, keep=a&&a.id==='efilter'?a.selectionStart:null;
  try{ $('#view').innerHTML=V[st.tab](); }catch(e){ $('#view').innerHTML=`<div class="note">This view could not be computed from the current data: ${esc(e.message)}. Undo the last change in Execute, or restore the original data.</div>`; console.error(e); }
  if(keep!=null){const f=$('#efilter'); f.focus(); f.setSelectionRange(keep,keep);}
  $('#asof').value=st.asof; const ev=E.eventInfo(st.db); $('#asof').min=ev.first; $('#asof').max=ev.last;
  $('#storelabel').textContent=st.store.label;
  renderChat();
}

/* ---------- forms and actions ---------- */
const F={
  async settings(v){ const ops=Object.entries(v).filter(([k,x])=>x!==''&&isFinite(+x)&&+x!==E.settingsOf(st.db)[k]).map(([k,x])=>({table:'settings',key:k,row:{key:k,value:+x},label:`Setting ${k} = ${x}`})); if(ops.length) await commit(ops,'Settings saved'); else toast('No changes'); },
  scenario(v){ const fix={}; for(const[k,x]of Object.entries(v)) if(k.startsWith('fix_')&&x!=='') fix[k.slice(4)]=+x; st.scenario={total:+v.total,max:+v.max,fix}; st.scenario.result=E.simulateBudget(st.db,st.asof,{mode:'optimize',total_budget_inr:+v.total,max_multiple:+v.max,allocations_inr:fix}); render(); },
  async task(v){ const id='T-'+uid(); await commit([{table:'tasks',key:id,row:Object.assign({task_id:id,status:'To do',source:'manual',notes:''},v),label:'Task added: '+v.title}]); },
  async campaign(v){ const id='C'+uid().slice(-5).toUpperCase(); await commit([{table:'campaigns',key:id,row:{campaign_id:id,campaign_name:v.campaign_name,channel:v.channel,owner_name:v.owner_name,planned_budget_inr:v.planned_budget_inr===''?null:+v.planned_budget_inr,plan_status:'active'},label:'Campaign added: '+v.campaign_name}]); },
  async daily(v){ if(['impressions','clicks','landing_page_sessions','registration_starts','reported_reach'].some(f=>+v[f]<0)) return toast('Counts cannot be negative (only spend can be, for credits).'); const id='UI-'+uid(); const row={activity_id:id,campaign_id:v.campaign_id,activity_date:v.activity_date,platform:'entered in app'}; for(const f of ['impressions','clicks','reported_reach','landing_page_sessions','registration_starts','marketing_spend_inr']) row[f]=+v[f];
    await commit([{table:'daily',key:id,row,label:`Daily record added: ${cname(v.campaign_id)} ${v.activity_date}, spend ${v.marketing_spend_inr}`}],v.activity_date>st.asof?'Saved. It is dated after the as-of date, so it is hidden until you move the date.':'Saved and analytics updated'); },
  async status(v){ const r=st.db.T.registrations.find(x=>x.registration_id===v.registration_id.trim()); if(!r) return toast('Unknown registration ID'); const at=v.effective_at.replace('T',' ')+':00'; if(at<r.registered_at) return toast('Status cannot predate the registration ('+r.registered_at+').'); const id='UI-H-'+uid(); await commit([{table:'history',key:id,row:{history_id:id,registration_id:r.registration_id,effective_at:at,status:v.status},label:`${r.registration_id} status → ${v.status} at ${at}`}]); },
  async checkin(v){ const pid=v.person_id.trim(); if(!st.db.people.get(pid)) return toast('Unknown person ID'); const reg=st.db.T.registrations.find(x=>x.person_id===pid)||{}; const id='UI-CHK-'+uid(); const at=v.occurred_at.replace('T',' ')+':00'; if(at.slice(0,10)<E.eventInfo(st.db).starts) return toast('Check-ins cannot predate the event.'); await commit([{table:'checkins',key:id,row:{event_id:id,person_id:pid,registration_id:reg.registration_id||'',campaign_id:reg.campaign_id||'',occurred_at:at,result:v.result,verification:v.verification,source:'manual'},label:`Check-in ${pid} ${v.result}/${v.verification}`}]); },
  async target(v){ const at=v.effective_at.replace('T',' ')+':00'; const row={effective_at:at,target_version:'Entered in app'}; for(const[k,x]of Object.entries(v)) if(k!=='effective_at') row[k]=+x; await commit([{table:'targets',key:at,row,label:'New target version effective '+at}]); },
  async reading(v){ if(+v.confirmed>+v.registrations) return toast('Confirmed cannot exceed registrations.'); const id='RD-'+uid(); await commit([{table:'readings',key:id,row:Object.assign({reading_id:id},v),label:`Reading ${v.bet_id} ${v.week_ending} (${v.source})`}]); }
};
const SIM=[['B1','2027-02-13',9000,60,52,18],['B1','2027-02-27',14000,150,136,27],['B3','2027-02-27',6000,70,63,9],['B3','2027-03-06',5000,82,74,12],['B2','2027-04-07',9000,0,0,64],['B4','2027-02-27',12000,120,100,41],['B5','2027-02-13',14000,82,66,2.2],['B5','2027-02-27',12000,70,58,2.3]];
async function act(name,id){
  const T=st.db.T;
  if(name==='togglechat') $('#layout').classList.toggle('nochat');
  if(name==='undo') return undo([id]);
  if(name==='reset'){ if(await ask('Reset all changes?',`<p>This removes all ${st.ops.length} saved changes, including tasks you added, and restores the original data. This cannot be undone.</p>`,'Reset')) return undo(st.ops.map(o=>o.id)); }
  if(name==='deltask'){ const t=T.tasks.find(x=>x.task_id===id); if(await ask('Delete task?',`<p>${esc(t.title)}</p>`,'Delete')) return commit([{table:'tasks',key:id,type:'delete',label:'Task deleted: '+t.title}],'Deleted (undo from the change log)'); }
  if(name==='note'){ const t=T.tasks.find(x=>x.task_id===id); const v=await ask('Task note',`<textarea name="notes" rows="4">${esc(t.notes||'')}</textarea>`,'Save'); if(v) return commit([{table:'tasks',key:id,row:{notes:v.notes},label:'Note on: '+t.title}]); }
  if(name==='dtask'){ const r=E.decide(st.db,st.asof).decisions.find(x=>x.campaign_id===id); const verb={SCALE:'Plan a controlled scale-up of',CUT:'Freeze new spend and audit',CHANGE:'Run a corrective test on',HOLD:'Monitor','INSUFFICIENT EVIDENCE':'Collect more evidence on'}[r.verdict];
    const v=await ask('Create task from this verdict',`<div class="form" style="grid-template-columns:1fr"><label>Task<input name="title" value="${esc(verb+' '+r.name)}"></label><label>Owner<input name="owner" value="${esc(r.owner)}"></label><label>Due<input type="date" name="due_date" value="${E.addDays(st.asof,3)}"></label><label>Success measure<input name="success_metric" value="Re-check unit cost vs blended after 1 week"></label></div>`,'Create task');
    if(v){ const tid='T-'+uid(); return commit([{table:'tasks',key:tid,row:Object.assign({task_id:tid,campaign_id:id,priority:['CUT','CHANGE'].includes(r.verdict)?'High':'Medium',status:'To do',source:'decision rule',evidence:`As of ${st.asof}: ${r.reason}`},v),label:'Task from verdict: '+v.title}],'Task created. See Execute.'); } }
  if(name==='applyscen'){ const a=st.scenario.result.allocation; if(await ask('Save planned budgets?',`<p>Saves these amounts as planned campaign budgets. It does not alter recorded spend.</p>`,'Save')) return commit(a.map(x=>({table:'campaigns',key:x.campaign_id,row:{planned_budget_inr:x.scenario_inr},label:`Planned budget ${x.name} = ${x.scenario_inr}`}))); }
  if(name==='sim'){ if(T.readings.some(r=>r.source==='simulated')) return toast('Simulated weeks are already loaded.'); return commit(SIM.map((s,i)=>{const rid='SIM-'+i+uid(); return {table:'readings',key:rid,row:{reading_id:rid,bet_id:s[0],week_ending:s[1],spend_inr:s[2],registrations:s[3],confirmed:s[4],leading_value:s[5],dup_pct:s[0]==='B3'?2:'',optout_pct:s[0]==='B2'?2.1:'',delivery_pct:s[0]==='B2'?97:'',source:'simulated'},label:'SIMULATED reading '+s[0]+' '+s[1]};}),'Simulated weeks loaded'); }
  if(name==='clearsim') return undo(st.ops.filter(o=>o.table==='readings'&&o.row&&o.row.source==='simulated').map(o=>o.id));
  if(name==='delread') return commit([{table:'readings',key:id,type:'delete',label:'Reading deleted'}]);
  if(name==='editrow'){ const tb=st.etable||'daily', key=E.KEYS[tb]; const row=T[tb].find(r=>String(r[key])===id);
    const v=await ask(`Edit ${tb} ${id}`,`<textarea name="json" rows="12">${esc(JSON.stringify(row,null,1))}</textarea>`,'Save');
    if(v){ let n; try{n=JSON.parse(v.json);}catch(e){return toast('Invalid JSON: '+e.message);} if(String(n[key])!==id) return toast(`Do not change the ${key}.`); const miss=(E.REQUIRED[tb]||[]).filter(c=>!(c in n)); if(miss.length) return toast('Missing '+miss.join(', ')); return commit([{table:tb,key:id,row:n,label:`Edited ${tb} ${id}`}]); } }
  if(name==='delrow'){ const tb=st.etable||'daily'; if(await ask('Delete record?',`<p>${esc(tb)} ${esc(id)} will be hidden. You can undo this from the change log.</p>`,'Delete')) return commit([{table:tb,key:id,type:'delete',label:`Deleted ${tb} ${id}`}]); }
  if(name==='restore'){ Store.saveDataset(null); loadBase(); rebuild(); render(); toast('Original workbook restored'); }
  if(name==='export') exportXlsx();
}
async function exportXlsx(){ const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(st.db.T.event),'Event');
  for(const[k,s]of Object.entries(E.SHEETS)) if(k!=='event') XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(st.db.T[k]),s);
  const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'}); const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  if(window.claude){ const d=st.dl; if(d){ try{ await d.save({filename:'campusfest_current.xlsx',data:blob}); }catch(e){ toast('Download not completed: '+(e.message||e.code)); } return; } return toast('Downloads are not available in this view.'); }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='campusfest_current.xlsx'; a.click(); }
function normDate(v,col){ if(v instanceof Date){ const d=new Date(Math.round(v.getTime()/1000)*1000), p=n=>String(n).padStart(2,'0'); const day=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; return ['activity_date','history_start','history_end'].includes(col)?day:`${day} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0,19).replace('T',' '); return v; }
function parseWorkbook(buf){ const wb=XLSX.read(buf,{type:'array',cellDates:true}); const tables={}, problems=[];
  for(const[k,name]of Object.entries(E.SHEETS)){ if(!wb.Sheets[name]){problems.push('Missing sheet "'+name+'"');continue;}
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:true}).map(r=>{const o={};for(const[c,v]of Object.entries(r))o[c]=normDate(v,c);return o;});
    if(['daily','interactions','registrations','history','checkins'].includes(k)) rows.forEach(o=>{ delete o.campaign_name; delete o.owner_name; delete o.detail; if(k!=='daily') delete o.person_name; });
    const miss=(E.REQUIRED[k]||[]).filter(c=>rows.length&&!(c in rows[0])); if(miss.length) problems.push(`${name}: missing columns ${miss.join(', ')}`); if(!rows.length) problems.push(name+' is empty'); tables[k]=rows; }
  return {tables,problems}; }

/* ---------- copilot ---------- */
const proposals=new Map();
function md(src){ const lines=esc(src).split('\n'); let out='',list=false,tbl=[];
  const inline=s=>s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const flushT=()=>{ if(!tbl.length) return; const rows=tbl.filter(r=>!/^\|[\s:|-]+\|?$/.test(r)).map(r=>r.replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()))); out+=`<div class="scroll"><table>${rows.map((r,i)=>`<tr>${r.map(c=>i?`<td>${c}</td>`:`<th>${c}</th>`).join('')}</tr>`).join('')}</table></div>`; tbl=[]; };
  for(const l of lines){ const t=l.trim(); if(t.startsWith('|')){tbl.push(t);continue;} flushT(); const b=/^([-*•]|\d+\.)\s+(.*)/.exec(t); if(b){ if(!list){out+='<ul>';list=true;} out+=`<li>${inline(b[2])}</li>`; continue; } if(list){out+='</ul>';list=false;} if(t) out+=`<p>${inline(t.replace(/^#+\s*/,''))}</p>`; }
  flushT(); if(list) out+='</ul>'; return out; }
const ctx={ getDb:()=>st.db, asof:()=>st.asof, tasks:()=>st.db.T.tasks, readings:()=>st.db.T.readings, propose:p=>{ const id='P-'+uid(); proposals.set(id,Object.assign({id,state:'pending'},p)); st.pendingIds.push(id); return id; } };
st.pendingIds=[];
const CHIPS=['Are we on track against our visitor goal?','Which campaigns should we scale, change or stop, and why?','Why is Paid Social underperforming?','Does nurture email hurt attendance?','Which college do most attendees come from?','We only have ₹2,00,000. How should we split it?'];
function propHtml(p){ const d=p.data; const body=p.kind==='task'?`<b>Proposed task:</b> ${esc(d.title)}<br>Owner ${esc(d.owner)} · due ${esc(d.due_date)} · ${esc(d.priority)}${d.campaign_id?' · '+esc(cname(d.campaign_id)):''}<br>Success: ${esc(d.success_metric)}<br><span class="mut">Evidence: ${esc(d.evidence)}</span>`:`<b>Proposed campaign change:</b> ${esc(cname(d.campaign_id))}${d.plan_status?' → status '+esc(d.plan_status):''}${d.planned_budget_inr!=null?' · planned budget '+rs(d.planned_budget_inr):''}<br><span class="mut">${esc(d.reason)}</span>`;
  return `<div class="proposal">${body}<br>${p.state==='pending'?`<button class="btn p" data-prop="${p.id}" data-do="yes">Confirm and save</button> ${p.kind==='task'?`<button class="btn" data-prop="${p.id}" data-do="edit">Edit</button> `:''}<button class="btn" data-prop="${p.id}" data-do="no">Dismiss</button>`:`<b>${p.state==='saved'?'✓ Saved to Execute':'Dismissed. Nothing saved.'}</b>`}</div>`; }
async function onProp(id,what){ const p=proposals.get(id); if(!p||p.state!=='pending') return;
  if(what==='no'){ p.state='dismissed'; return saveChat(),renderChat(); }
  if(what==='edit'){ const d=p.data; const v=await ask('Edit before saving',`<div class="form" style="grid-template-columns:1fr">${['title','owner','due_date','priority','success_metric'].map(k=>`<label>${k.replace('_',' ')}<input name="${k}" value="${esc(d[k])}"></label>`).join('')}</div>`,'Save task'); if(!v) return; Object.assign(d,v); }
  let ok; if(p.kind==='task'){ const tid='T-'+uid(); ok=await commit([{table:'tasks',key:tid,actor:'copilot (user confirmed)',row:Object.assign({task_id:tid,status:'To do',source:'copilot (confirmed)',notes:'',campaign_id:''},p.data),label:'Copilot task confirmed: '+p.data.title}],'Task saved'); }
  else { const row={}; if(p.data.plan_status) row.plan_status=p.data.plan_status; if(p.data.planned_budget_inr!=null) row.planned_budget_inr=+p.data.planned_budget_inr; ok=await commit([{table:'campaigns',key:p.data.campaign_id,actor:'copilot (user confirmed)',row,label:`Copilot change confirmed: ${cname(p.data.campaign_id)} ${JSON.stringify(row)} (${p.data.reason})`}],'Campaign updated'); }
  if(ok){ p.state='saved'; saveChat(); renderChat(); } }
function saveChat(){ Store.lsSet('cf_chat_v1',st.chat.slice(-20).map(m=>Object.assign({},m,{tools:(m.tools||[]).map(t=>({name:t.name,args:t.args,result:JSON.stringify(t.result).length>3000?{preview:JSON.stringify(t.result).slice(0,3000)}:t.result}))}))); Store.lsSet('cf_props_v1',[...proposals.values()].slice(-20)); }
for(const p of Store.lsGet('cf_props_v1')||[]) proposals.set(p.id,p);
function renderChat(){
  const label={claude:'Model: Claude (page capability)',proxy:'Model: Gemini via server',direct:'Model: Gemini (your key)',none:'Model not connected'}[st.provider||'none'];
  $('#modellabel').textContent=label;
  const setup=(st.provider==null||st.provider==='none')?`<div class="note"><b>Connect a model to chat.</b> Analytics work without it. Paste a free Google AI Studio key (stored only in this browser), or set GEMINI_API_KEY on the server.<br><button class="btn p" data-act2="model">Connect</button></div>`:'';
  $('#msgs').innerHTML=setup+(st.chat.length?'':'<p class="mut">Ask about the current data. Answers show the tool calls used and a check of which numbers trace back to them. I can propose tasks; nothing saves until you confirm.</p>')+st.chat.map(m=>{
    if(m.role==='user') return `<div class="msg user">${esc(m.text)}</div>`;
    const g=m.ground; const gh=g&&g.checked?`<span class="ground ${g.unverified.length?'no':'ok'}">${g.unverified.length?`Check: ${g.unverified.length} of ${g.checked} figures not found in tool results: ${esc(g.unverified.slice(0,6).join(', '))}`:`✓ ${g.traced} of ${g.checked} figures found in tool results`}</span>`:(m.tools&&!m.tools.length&&!m.error?'<span class="ground no">No data tool was called for this answer</span>':'');
    return `<div class="msg assistant">${md(m.text)}${gh}${m.version&&m.version!==version()?'<br><span class="ground no">Data or as-of date changed after this answer. Ask again.</span>':''}${m.tools&&m.tools.length?`<details><summary>Data used: ${m.tools.length} tool call(s)</summary>${m.tools.map(t=>`<b>${esc(t.name)}</b> <code>${esc(JSON.stringify(t.args||{}))}</code><pre>${esc(JSON.stringify(t.result,null,1).slice(0,5000))}</pre>`).join('')}</details>`:''}${(m.proposals||[]).map(i=>proposals.get(i)).filter(Boolean).map(propHtml).join('')}</div>`; }).join('')+(st.busy?`<div class="msg assistant mut" id="working">${esc(st.step||'Thinking…')}</div>`:'');
  $('#send').disabled=st.busy; $('#chips').style.display=st.chat.length?'none':'flex'; const box=$('#msgs'); box.scrollTop=box.scrollHeight; }
async function send(q){
  q=q.trim(); if(!q||st.busy) return; if(!st.provider||st.provider==='none') return connectModel();
  const history=st.chat.filter(m=>!m.error).map(m=>({role:m.role,text:m.text,tools:m.tools}));
  st.chat.push({role:'user',text:q}); st.busy=true; st.step='Thinking…'; st.pendingIds=[]; $('#q').value=''; renderChat();
  const run=C.makeRunner(ctx), system=C.systemPrompt(ctx), ver=version();
  const onStep=n=>{ st.step='Reading data: '+n.replace(/_/g,' ')+'…'; const w=$('#working'); if(w) w.textContent=st.step; };
  try{
    let res;
    if(st.provider==='claude') res=await C.runClaude({sample:st.sample,system,history,question:q,run,onStep});
    else { const key=Store.lsGet('cf_gemini_key'); const custom=Store.lsGet('cf_gemini_model'); const models=custom?[custom]:(st.health.models||['gemini-3.8-flash','gemini-3.5-flash-lite']);
      const post=async(model,body)=>{ const r= st.provider==='proxy'? await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,body})}) : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)}); let data={}; try{data=await r.json();}catch(e){} return {ok:r.ok,status:r.status,data}; };
      res=await C.runGemini({post,models,system,history,question:q,run,onStep}); }
    // the check pool: this turn's tool results, earlier tool results, and the user's own numbers
    const pool=[q,res.calls.map(c=>[c.args,c.result]),history.map(h=>[h.role==='user'?h.text:'',(h.tools||[]).map(t=>t.result)]),st.asof];
    st.chat.push({role:'assistant',text:res.text,tools:res.calls,ground:C.groundCheck(res.text,pool),proposals:st.pendingIds.slice(),version:ver});
  }catch(e){
    const code=e&&e.code; const why=code==='rate_limited'?'Model rate limit reached. Wait a minute and retry.':code==='not_granted'?'Model access was not allowed in this view.':(e.message||code||String(e));
    st.chat.push({role:'assistant',text:'I could not complete that answer: '+why+' No data was changed.',error:true,tools:[],proposals:st.pendingIds.slice()});
  }
  st.busy=false; saveChat(); renderChat();
}
async function connectModel(){
  if(st.provider==='claude'||st.provider==='proxy') return toast('A model is already connected.');
  const v=await ask('Connect Gemini',`<p class="small">Create a free key at aistudio.google.com. It is kept only in this browser and sent only to Google's API. Do not use this on a shared computer.</p><div class="form" style="grid-template-columns:1fr"><label>API key<input type="password" name="key" autocomplete="off"></label><label>Model (optional)<input name="model" placeholder="gemini-3.8-flash" value="${esc(Store.lsGet('cf_gemini_model')||'')}"></label></div>`,'Connect');
  if(!v) return; if(v.key){ Store.lsSet('cf_gemini_key',v.key.trim()); st.provider='direct'; } Store.lsSet('cf_gemini_model',v.model.trim()||null); if(!v.key&&!Store.lsGet('cf_gemini_key')) toast('No key entered.'); renderChat(); }

/* ---------- wiring ---------- */
document.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.tab){ st.tab=b.dataset.tab; render(); }
  else if(b.dataset.act) act(b.dataset.act,b.dataset.id);
  else if(b.dataset.prop) onProp(b.dataset.prop,b.dataset.do);
  else if(b.dataset.act2==='model') connectModel();
  else if(b.dataset.chip!=null) send(CHIPS[+b.dataset.chip]);
  else if(b.dataset.asof){ st.asof=b.dataset.asof; st.scenario=null; render(); } });
document.addEventListener('submit',e=>{ const f=e.target.closest('form[data-form]'); if(!f) return; e.preventDefault(); const v={}; new FormData(f).forEach((x,k)=>v[k]=x); F[f.dataset.form](v); });
document.addEventListener('change',e=>{ const x=e.target;
  if(x.id==='asof'){ if(x.value){ st.asof=x.value; st.scenario=null; render(); } }
  else if(x.dataset.task){ const t=st.db.T.tasks.find(t=>t.task_id===x.dataset.task); commit([{table:'tasks',key:t.task_id,row:{[x.dataset.k]:x.value},label:`Task "${t.title}": ${x.dataset.k} = ${x.value}`}]); }
  else if(x.dataset.camp){ const val=x.dataset.k==='planned_budget_inr'?(x.value===''?null:+x.value):x.value; commit([{table:'campaigns',key:x.dataset.camp,row:{[x.dataset.k]:val},label:`${cname(x.dataset.camp)}: ${x.dataset.k} = ${x.value}`}]); }
  else if(x.id==='etable'){ st.etable=x.value; st.filter=''; render(); }
  else if(x.id==='upload'&&x.files[0]){ x.files[0].arrayBuffer().then(async buf=>{ let r; try{ r=parseWorkbook(buf);}catch(err){return toast('Could not read workbook: '+err.message);} if(r.problems.length) return ask('Upload rejected',`<ul>${r.problems.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`,'OK');
    if(!await ask('Use this workbook?',`<p>It replaces the source data in this browser. Saved row edits will be re-applied on top, so reset the change log first if you want the file exactly as it is.</p>`,'Use it')) return;
    const ok=Store.saveDataset({tables:r.tables}); loadBase(); rebuild(); render(); toast(ok?'Workbook loaded':'Loaded for this session only (too large to save)'); }); } });
document.addEventListener('input',e=>{ if(e.target.id==='efilter'){ st.filter=e.target.value; render(); } });

async function init(){
  loadBase(); st.asof=E.eventInfo(E.prepare(E.materialize(st.base,[]))).last;
  try{ st.ops=await st.store.load(); }catch(e){ st.ops=[]; }
  rebuild();
  $('#chips').innerHTML=CHIPS.map((c,i)=>`<button data-chip="${i}">${esc(c)}</button>`).join('');
  $('#composer form').addEventListener('submit',e=>{e.preventDefault(); send($('#q').value);});
  $('#q').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send($('#q').value);} });
  $('#newchat').onclick=()=>{ if(st.busy) return; st.chat=[]; proposals.clear(); saveChat(); renderChat(); };
  $('#modelbtn').onclick=connectModel;
  render();
  if(window.claude&&window.claude.use){
    claude.use('sample').then(s=>{ if(s){ st.sample=s; st.provider='claude'; renderChat(); } else fallback(); });
    claude.use('downloads').then(d=>st.dl=d).catch(()=>{});
    claude.use('db').then(async db=>{ if(!db) return; const a=Store.pagedb(db); try{ const ops=await a.load(); st.store=a; st.ops=ops; rebuild(); render(); a.subscribe(o=>{ if(JSON.stringify(o.map(x=>x.id).sort())!==JSON.stringify(st.ops.map(x=>x.id).sort())){ st.ops=o; rebuild(); render(); } }); }catch(e){ toast('Shared database unavailable; saving in this browser.'); } });
  } else {
    try{ const r=await fetch('/api/health'); if(r.ok) st.health=await r.json(); }catch(e){}
    if(st.health.supabase){ const a=Store.supabase(st.health.supabase.url,st.health.supabase.key); try{ st.ops=await a.load(); st.store=a; rebuild(); render(); }catch(e){ toast('Supabase unavailable; saving in this browser. '+e.message); } }
    fallback();
  }
  function fallback(){ st.provider= st.health.gemini?'proxy': Store.lsGet('cf_gemini_key')?'direct':'none'; renderChat(); }
}
window.__app={st,send,parseWorkbook,init};
init();
})();
