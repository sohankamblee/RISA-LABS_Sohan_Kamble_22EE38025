/* Analytics engine: pure functions, no DOM. Every number shown in the UI or given to the copilot comes from here. */
(function (root) {
'use strict';
const SHEETS = { event:'Event', targets:'Targets', campaigns:'Campaigns', daily:'Daily Marketing', people:'People',
  interactions:'Interest and Engagement', registrations:'Registrations', history:'Registration History', checkins:'Check-ins' };
const KEYS = { targets:'effective_at', campaigns:'campaign_id', daily:'activity_id', people:'person_id', interactions:'interaction_id',
  registrations:'registration_id', history:'history_id', checkins:'event_id', tasks:'task_id', readings:'reading_id', settings:'key' };
const REQUIRED = {
  targets:['effective_at','registration_goal','unique_external_visitors_goal','marketing_budget_inr','identified_external_people_goal'],
  campaigns:['campaign_id','campaign_name'],
  daily:['activity_id','campaign_id','activity_date','impressions','clicks','landing_page_sessions','marketing_spend_inr'],
  people:['person_id','person_type','first_seen_at'], interactions:['interaction_id','person_id','event_type','occurred_at'],
  registrations:['registration_id','person_id','registered_at'], history:['history_id','registration_id','effective_at','status'],
  checkins:['event_id','person_id','occurred_at','result','verification'] };
const DEFAULT_SETTINGS = { assumed_show_rate:0.70, assumed_walkins:0, elasticity:0.70, scale_ratio:0.85, change_ratio:1.20,
  cut_ratio:1.50, min_regs:40, min_spend:8000, quality_gap_pp:5 };

const num = v => (v === '' || v == null || isNaN(+v)) ? 0 : +v;
const div = (a,b) => b ? a / b : null;
const r1 = (v,d=4) => v == null ? null : Math.round(v * 10**d) / 10**d;
const dayOf = s => String(s || '').slice(0,10);
const endOf = d => d + ' 23:59:59';
const addDays = (d,n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); };
const daysBetween = (a,b) => Math.round((Date.parse(b+'T00:00:00Z') - Date.parse(a+'T00:00:00Z'))/864e5);

/* Apply the saved operation log on top of the untouched source tables. */
function materialize(base, ops) {
  const t = {}; for (const k of Object.keys(KEYS)) t[k] = (base[k] || []).slice();
  t.event = base.event.slice();
  for (const op of (ops || []).slice().sort((a,b)=> (a.ts+a.id).localeCompare(b.ts+b.id))) {
    const key = KEYS[op.table]; if (!key) continue;
    const id = String(op.key);
    const at = t[op.table].findIndex(r => String(r[key]) === id);
    if (op.type === 'delete') t[op.table] = t[op.table].filter(r => String(r[key]) !== id);
    else if (at === -1) t[op.table].push(op.row);
    else { const merged = Object.assign({}, t[op.table][at], op.row);
           t[op.table] = t[op.table].filter(r => String(r[key]) !== id); t[op.table].splice(at,0,merged); }
  }
  return t;
}

/* De-duplicate stable IDs and build joins. */
function prepare(tables) {
  const quality = { duplicates_removed:{}, conflicting_duplicates:{}, orphan_rows:{} };
  const T = { event: tables.event };
  for (const [name,key] of Object.entries(KEYS)) {
    const seen = new Map(); let dup = 0, conflict = 0;
    for (const row of (tables[name] || [])) {
      const id = String(row[key]);
      if (seen.has(id)) { dup++; if (JSON.stringify(seen.get(id)) !== JSON.stringify(row)) conflict++; }
      else seen.set(id,row);
    }
    T[name] = [...seen.values()];
    if (dup) quality.duplicates_removed[name] = dup;
    if (conflict) quality.conflicting_duplicates[name] = conflict;
  }
  const people = new Map(T.people.map(p => [p.person_id, p]));
  for (const n of ['registrations','checkins','interactions']) {
    const o = T[n].filter(r => !people.has(r.person_id)).length; if (o) quality.orphan_rows[n] = o;
  }
  const campaigns = new Map(T.campaigns.map(c => [c.campaign_id, c]));
  return { T, people, campaigns, quality };
}

function eventInfo(db) {
  const e = db.T.event[0];
  return { name:e.event_name, starts:dayOf(e.event_starts_at), ends:dayOf(e.event_ends_at),
           first:dayOf(e.history_start), last:dayOf(e.history_end) };
}
function settingsOf(db) {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  for (const r of db.T.settings) if (r.key in s) s[r.key] = +r.value;
  return s;
}
function targetAt(db, asof) {
  const el = db.T.targets.filter(t => String(t.effective_at) <= endOf(asof)).sort((a,b)=>String(a.effective_at).localeCompare(String(b.effective_at)));
  return el[el.length-1] || null;
}
function latestStatus(db, asof) {
  const m = new Map(), end = endOf(asof);
  for (const h of db.T.history) {
    if (String(h.effective_at) > end) continue;
    const cur = m.get(h.registration_id);
    if (!cur || (h.effective_at + h.history_id) > (cur.effective_at + cur.history_id)) m.set(h.registration_id, h);
  }
  return m;
}
const isExt = (db,id) => { const p = db.people.get(id); return !!p && p.person_type === 'external'; };

function snapshot(db, asof) {
  const ev = eventInfo(db), end = endOf(asof), S = settingsOf(db);
  const observable = asof >= ev.starts;
  const people = db.T.people.filter(p => p.person_type === 'external' && String(p.first_seen_at) <= end);
  const regs = db.T.registrations.filter(r => String(r.registered_at) <= end && isExt(db,r.person_id));
  const status = latestStatus(db, asof);
  const admitted = db.T.checkins.filter(c => String(c.occurred_at) <= end && c.result === 'admitted' && c.verification === 'verified' && isExt(db,c.person_id));
  const visitors = new Set(admitted.map(c => c.person_id));
  const regPeople = new Set(regs.map(r => r.person_id));
  const daily = db.T.daily.filter(d => dayOf(d.activity_date) <= asof);

  const blank = () => ({ impressions:0, clicks:0, reported_reach:0, landing_page_sessions:0, registration_starts:0, spend:0, identified:0,
    regSet:new Set(), confirmed:0, cancelled:0, waitlisted:0, interested:0, attSet:new Set() });
  const by = new Map(db.T.campaigns.map(c => [c.campaign_id, blank()]));
  const get = id => { if (!by.has(id)) by.set(id, blank()); return by.get(id); };
  for (const d of daily) { const g = get(d.campaign_id);
    for (const f of ['impressions','clicks','reported_reach','landing_page_sessions','registration_starts']) g[f] += num(d[f]);
    g.spend += num(d.marketing_spend_inr); }
  for (const p of people) if (p.first_campaign_id) get(p.first_campaign_id).identified++;
  const statusCounts = { confirmed:0, cancelled:0, waitlisted:0, interested:0, no_status:0 };
  const counted = new Set();
  for (const r of regs) {
    const g = r.campaign_id ? get(r.campaign_id) : null;
    const st = (status.get(r.registration_id) || {}).status || 'no_status';
    if (!counted.has(r.person_id)) { statusCounts[st] = (statusCounts[st]||0)+1; }
    if (g && !g.regSet.has(r.person_id)) { g.regSet.add(r.person_id); if (st in g) g[st]++; if (visitors.has(r.person_id)) g.attSet.add(r.person_id); }
    counted.add(r.person_id);
  }
  const campaigns = [...by.entries()].map(([id,g]) => {
    const meta = db.campaigns.get(id) || { campaign_name:id };
    const registered = g.regSet.size, attended = observable ? g.attSet.size : null;
    return { campaign_id:id, name:meta.campaign_name, channel:meta.channel||'', owner:meta.owner_name||'',
      plan_status:meta.plan_status||'active', planned_budget_inr: meta.planned_budget_inr != null ? num(meta.planned_budget_inr) : null,
      spend_inr:g.spend, impressions:g.impressions, clicks:g.clicks, reported_reach_sum:g.reported_reach,
      sessions:g.landing_page_sessions, form_starts:g.registration_starts, identified:g.identified,
      registered, confirmed:g.confirmed, cancelled:g.cancelled, waitlisted:g.waitlisted, attended,
      ctr:r1(div(g.clicks,g.impressions)), click_to_session:r1(div(g.landing_page_sessions,g.clicks)),
      session_to_identified:r1(div(g.identified,g.landing_page_sessions)), identified_to_registered:r1(div(registered,g.identified)),
      registered_to_confirmed:r1(div(g.confirmed,registered)), show_rate: observable ? r1(div(g.attSet.size,registered)) : null,
      cost_per_registration:r1(div(g.spend,registered),2), cost_per_confirmed:r1(div(g.spend,g.confirmed),2),
      cost_per_attendee: observable ? r1(div(g.spend,g.attSet.size),2) : null };
  }).sort((a,b)=>a.campaign_id.localeCompare(b.campaign_id));

  const sum = f => campaigns.reduce((a,c)=>a+(c[f]||0),0);
  const registeredAttended = observable ? [...regPeople].filter(p=>visitors.has(p)).length : null;
  const totals = {
    identified: people.length, registered: regPeople.size, confirmed: statusCounts.confirmed, status_counts: statusCounts,
    visitors: observable ? visitors.size : null, registered_attended: registeredAttended,
    unregistered_walkins: observable ? [...visitors].filter(p=>!regPeople.has(p)).length : null,
    show_rate: observable ? r1(div(registeredAttended, regPeople.size)) : null,
    spend_inr: daily.reduce((a,d)=>a+num(d.marketing_spend_inr),0),
    credits_inr: daily.reduce((a,d)=>a+Math.min(0,num(d.marketing_spend_inr)),0),
    impressions:sum('impressions'), clicks:sum('clicks'), sessions:sum('sessions'), form_starts:sum('form_starts'),
    attributed_identified: sum('identified') };
  totals.cost_per_registration = r1(div(totals.spend_inr, totals.registered),2);
  totals.cost_per_visitor = observable ? r1(div(totals.spend_inr, totals.visitors),2) : null;

  const target = targetAt(db, asof);
  const tva = !target ? [] : [
    ['identified_external_people', totals.identified, num(target.identified_external_people_goal)],
    ['registrations', totals.registered, num(target.registration_goal)],
    ['verified_external_visitors', totals.visitors, num(target.unique_external_visitors_goal)],
    ['marketing_spend_inr_vs_budget_limit', totals.spend_inr, num(target.marketing_budget_inr)]
  ].map(([metric,actual,goal]) => ({ metric, actual, target:goal, pct_of_target: actual==null?null:r1(div(actual,goal)), gap: actual==null?null:actual-goal }));
  return { as_of:asof, event:ev, attendance_observable:observable, target_version: target && target.target_version, targets_vs_actuals:tva,
    totals, campaigns, projection: project(db, asof, totals, regs, daily, S), data_quality: db.quality };
}

/* Run-rate projection. Uses only information available at the as-of date; the show rate is an explicit assumption. */
function project(db, asof, totals, regs, daily, S) {
  const ev = eventInfo(db);
  if (asof >= ev.ends) return { type:'actual', note:'Event has finished; visitors are actuals.', projected_visitors: totals.visitors };
  if (asof >= ev.starts) return { type:'event_in_progress', note:'Event in progress; visitor count is partial.', projected_visitors:null };
  const from = addDays(asof,-13);
  const recent = new Set(regs.filter(r => dayOf(r.registered_at) >= from).map(r=>r.person_id)).size;
  const recentSpend = daily.filter(d=>dayOf(d.activity_date) >= from).reduce((a,d)=>a+num(d.marketing_spend_inr),0);
  const left = daysBetween(asof, ev.starts) - 1;
  const pr = Math.round(totals.registered + recent/14*left);
  const t = targetAt(db, asof) || {};
  const vis = Math.round(pr*S.assumed_show_rate + S.assumed_walkins);
  return { type:'forecast', days_to_event: left+1, last_14d_registrations: recent, projected_registrations: pr,
    projected_visitors: vis, range_visitors:[Math.round(pr*(S.assumed_show_rate-0.07)+S.assumed_walkins), Math.round(pr*(S.assumed_show_rate+0.07)+S.assumed_walkins)],
    projected_spend_inr: Math.round(totals.spend_inr + recentSpend/14*left),
    visitor_goal_gap: vis - num(t.unique_external_visitors_goal),
    assumptions:[`Registrations continue at the last-14-day average until the day before the event`,
      `Show rate ${Math.round(S.assumed_show_rate*100)}% of registrants is an ASSUMPTION (not observable before the event); range shows +/-7 points`,
      `Unregistered walk-ins assumed ${S.assumed_walkins}`] };
}

const STAGES = [['ctr','Impression to click','clicks','impressions'],['click_to_session','Click to landing session','sessions','clicks'],
  ['session_to_identified','Session to identified person','identified','sessions'],['identified_to_registered','Identified to registered','registered','identified'],
  ['registered_to_confirmed','Registered to confirmed','confirmed','registered'],['show_rate','Registered to attended','attended','registered']];

/* For each campaign: the stage furthest below the pooled rate of all OTHER campaigns. */
function diagnose(snap) {
  return snap.campaigns.map(c => {
    const others = snap.campaigns.filter(o=>o.campaign_id!==c.campaign_id);
    const stages = [];
    for (const [k,label,n,d] of STAGES) {
      if (k==='show_rate' && !snap.attendance_observable) continue;
      const bench = div(others.reduce((a,o)=>a+(o[n]||0),0), others.reduce((a,o)=>a+(o[d]||0),0));
      if (c[k]==null || !bench) continue;
      stages.push({ stage:label, rate:c[k], peer_rate:r1(bench), relative_gap:r1(c[k]/bench-1,3), units_lost_vs_peers: Math.max(0, Math.round(bench*c[d]-c[n])), base:c[d] });
    }
    const worst = stages.filter(s=>s.relative_gap < -0.08 && s.base >= 30).sort((a,b)=>a.relative_gap-b.relative_gap)[0] || null;
    return { campaign_id:c.campaign_id, name:c.name, bottleneck:worst, stages };
  });
}

/* Scale / hold / change / cut rules. Pre-event: cost per CONFIRMED registration. Post-event: cost per ATTENDEE. */
function decide(db, asof) {
  const snap = snapshot(db, asof), S = settingsOf(db);
  const post = snap.attendance_observable;
  const outcome = post ? 'attended' : 'confirmed', costKey = post ? 'cost_per_attendee' : 'cost_per_confirmed';
  const totSpend = snap.campaigns.reduce((a,c)=>a+c.spend_inr,0), totOut = snap.campaigns.reduce((a,c)=>a+(c[outcome]||0),0);
  const blended = div(totSpend, totOut);
  const regTot = snap.campaigns.reduce((a,c)=>a+c.registered,0);
  const qual = post ? div(snap.campaigns.reduce((a,c)=>a+(c.attended||0),0), regTot) : div(snap.campaigns.reduce((a,c)=>a+c.confirmed,0), regTot);
  const diag = new Map(diagnose(snap).map(d=>[d.campaign_id,d]));
  const rows = snap.campaigns.map(c => {
    const cost = c[costKey], ratio = (cost!=null && blended) ? cost/blended : null;
    const q = post ? c.show_rate : c.registered_to_confirmed;
    let verdict, why;
    if (c.registered < S.min_regs || c.spend_inr < S.min_spend) { verdict='INSUFFICIENT EVIDENCE';
      why=`Only ${c.registered} registrations and Rs ${c.spend_inr} spend; minimum is ${S.min_regs} and Rs ${S.min_spend}.`; }
    else if (ratio == null) { verdict='CUT'; why='Spend with no outcome.'; }
    else {
      verdict = ratio <= S.scale_ratio ? 'SCALE' : ratio >= S.cut_ratio ? 'CUT' : ratio >= S.change_ratio ? 'CHANGE' : 'HOLD';
      why = `Cost per ${post?'attendee':'confirmed registration'} Rs ${cost} is ${ratio.toFixed(2)}x the blended Rs ${blended.toFixed(2)}.`;
      if (verdict==='SCALE' && q != null && qual != null && q < qual - S.quality_gap_pp/100) { verdict='HOLD';
        why += ` Held back: ${post?'show':'confirmation'} rate ${(q*100).toFixed(1)}% trails the portfolio ${(qual*100).toFixed(1)}%.`; }
    }
    const b = diag.get(c.campaign_id).bottleneck;
    return { campaign_id:c.campaign_id, name:c.name, owner:c.owner, verdict, reason:why, spend_inr:c.spend_inr, outcome_count:c[outcome],
      unit_cost_inr:cost, ratio_to_blended:r1(ratio,2), quality_rate:q,
      main_bottleneck: b ? `${b.stage}: ${(b.rate*100).toFixed(1)}% vs peers ${(b.peer_rate*100).toFixed(1)}%` : 'No stage more than 8% below peers with a usable sample' };
  });
  const order = { CUT:0, CHANGE:1, SCALE:2, HOLD:3, 'INSUFFICIENT EVIDENCE':4 };
  rows.sort((a,b)=>order[a.verdict]-order[b.verdict] || (b.spend_inr-a.spend_inr));
  return { as_of:asof, basis: post ? 'cost per verified attendee (actual)' : 'cost per currently-confirmed registration (attendance not yet observable)',
    blended_unit_cost_inr:r1(blended,2), thresholds:{scale_at_or_below:S.scale_ratio, change_at_or_above:S.change_ratio, cut_at_or_above:S.cut_ratio, min_regs:S.min_regs, min_spend_inr:S.min_spend},
    decisions:rows, caveats:['Observed average costs, not causal incrementality; a channel may assist others and no multi-touch data exists.',
      'Early reads can mislead: ramping channels may look expensive for several weeks.'] };
}

/* Diminishing-returns scenario: outcome = current outcome x (new spend / current spend) ^ elasticity. */
function simulateBudget(db, asof, opts) {
  opts = opts || {};
  const snap = snapshot(db, asof), S = settingsOf(db), e = opts.elasticity != null ? +opts.elasticity : S.elasticity;
  const post = snap.attendance_observable;
  const rows = snap.campaigns.filter(c=>c.spend_inr>0).map(c => ({ id:c.campaign_id, name:c.name, s0:c.spend_inr,
    o0: post ? c.attended : c.confirmed * (c.registered ? Math.min(1, S.assumed_show_rate*c.registered/Math.max(1,c.confirmed)) : 0) }));
  if (!rows.length) return { error:'No campaign has spend at this date.' };
  const cur = rows.reduce((a,r)=>a+r.s0,0);
  const total = opts.total_budget_inr != null ? +opts.total_budget_inr : cur;
  const maxM = opts.max_multiple != null ? +opts.max_multiple : 2, minM = opts.min_multiple != null ? +opts.min_multiple : 0.3;
  const fixed = opts.allocations_inr || {};
  const f = (r,s,el) => r.o0 * Math.pow(Math.max(0,s)/r.s0, el);
  let alloc = {}; const warnings = [];
  for (const k of Object.keys(fixed)) if (!rows.some(r=>r.id===k)) warnings.push(`Unknown or zero-spend campaign ${k} ignored.`);
  if (opts.mode === 'evaluate') { for (const r of rows) alloc[r.id] = r.id in fixed ? +fixed[r.id] : r.s0; }
  else {
    for (const r of rows) alloc[r.id] = r.id in fixed ? +fixed[r.id] : r.s0*minM;
    let rest = total - Object.values(alloc).reduce((a,b)=>a+b,0);
    if (rest < 0) { const free = rows.filter(r=>!(r.id in fixed)), floor = free.reduce((a,r)=>a+alloc[r.id],0);
      const room = total - rows.filter(r=>r.id in fixed).reduce((a,r)=>a+alloc[r.id],0);
      if (room < 0) return { error:`Fixed allocations alone exceed the Rs ${total} budget.` };
      for (const r of free) alloc[r.id] *= room/floor; rest = 0; warnings.push(`Budget is below the ${minM}x floors, so floors were scaled down.`); }
    const step = Math.max(250, total/1200);
    while (rest > 1) {
      const s = Math.min(step, rest); let best=null, gain=-1;
      for (const r of rows) { if (r.id in fixed || alloc[r.id]+s > r.s0*maxM + 1e-6) continue;
        const g = f(r,alloc[r.id]+s,e)-f(r,alloc[r.id],e); if (g>gain) { gain=g; best=r; } }
      if (!best) { warnings.push(`Rs ${Math.round(rest)} left unallocated: every channel is at its ${maxM}x extrapolation cap.`); break; }
      alloc[best.id]+=s; rest-=s;
    }
  }
  const out = el => rows.reduce((a,r)=>a+f(r,alloc[r.id],el),0);
  const base = rows.reduce((a,r)=>a+r.o0,0);
  for (const r of rows) if (alloc[r.id] > r.s0*2.001) warnings.push(`${r.name}: more than 2x observed spend; extrapolation is unreliable.`);
  return { as_of:asof, mode:opts.mode||'optimize', basis: post ? 'actual attendees by channel' : 'expected attendees = confirmed registrations scaled to the assumed show rate (same rate for all channels)',
    elasticity_assumption:e, current_spend_inr:cur, scenario_spend_inr:Math.round(Object.values(alloc).reduce((a,b)=>a+b,0)),
    current_attributed_attendees:Math.round(base), scenario_attributed_attendees:Math.round(out(e)), change:Math.round(out(e)-base),
    sensitivity:{ 'elasticity_0.5':Math.round(out(0.5)), 'elasticity_0.9':Math.round(out(0.9)) },
    allocation: rows.map(r=>({ campaign_id:r.id, name:r.name, current_inr:Math.round(r.s0), scenario_inr:Math.round(alloc[r.id]),
      change_inr:Math.round(alloc[r.id]-r.s0), scenario_attendees:Math.round(f(r,alloc[r.id],e)) })),
    warnings, caveats:['Modelled scenario, not evidence: the elasticity is an assumption and channels are treated as independent.',
      post ? 'Full-period what-if on a finished campaign; use it to plan the next edition.' : 'Full-period what-if; it ignores how little time may remain to spend.',
      'Walk-ins are excluded from attributed attendees.'] };
}

/* Window comparison: what changed, split into traffic volume and conversion effects. */
function comparePeriods(db, aStart, aEnd, bStart, bEnd, campaignId) {
  const win = (s,e) => {
    const d = db.T.daily.filter(x=>dayOf(x.activity_date)>=s && dayOf(x.activity_date)<=e && (!campaignId || x.campaign_id===campaignId));
    const sum = f => d.reduce((a,x)=>a+num(x[f]),0);
    const regs = db.T.registrations.filter(r=>dayOf(r.registered_at)>=s && dayOf(r.registered_at)<=e && isExt(db,r.person_id) && (!campaignId || r.campaign_id===campaignId));
    const o = { start:s, end:e, days:daysBetween(s,e)+1, spend_inr:sum('marketing_spend_inr'), impressions:sum('impressions'), clicks:sum('clicks'),
      sessions:sum('landing_page_sessions'), registrations:new Set(regs.map(r=>r.person_id)).size, by:{} };
    for (const r of regs) o.by[r.campaign_id]=(o.by[r.campaign_id]||0)+1;
    o.ctr=r1(div(o.clicks,o.impressions)); o.registrations_per_session=r1(div(o.registrations,o.sessions)); o.cost_per_registration=r1(div(o.spend_inr,o.registrations),2);
    return o;
  };
  const a = win(aStart,aEnd), b = win(bStart,bEnd);
  const ids = new Set([...Object.keys(a.by),...Object.keys(b.by)]);
  const contrib = [...ids].map(id=>({ campaign:(db.campaigns.get(id)||{}).campaign_name||id, period_a:a.by[id]||0, period_b:b.by[id]||0, change:(b.by[id]||0)-(a.by[id]||0) })).sort((x,y)=>Math.abs(y.change)-Math.abs(x.change));
  delete a.by; delete b.by;
  let decomposition = null;
  if (a.sessions && b.sessions) decomposition = { from_session_volume: Math.round((b.sessions-a.sessions)*(a.registrations/a.sessions)),
    from_conversion_per_session: Math.round((b.registrations/b.sessions - a.registrations/a.sessions)*b.sessions),
    note:'Arithmetic split of the registration change; it describes the change and does not prove its cause. Sessions are anonymous and registrations may lag sessions.' };
  return { period_a:a, period_b:b, registration_change:b.registrations-a.registrations, contribution_by_campaign:contrib, decomposition };
}

/* Observational comparison of people with / without an engagement event. */
function engagementLift(db, asof, eventType) {
  const end = endOf(asof), ev = eventInfo(db);
  const withE = new Set(db.T.interactions.filter(i=>i.event_type===eventType && String(i.occurred_at)<=end).map(i=>i.person_id));
  const ppl = db.T.people.filter(p=>p.person_type==='external' && String(p.first_seen_at)<=end);
  const reg = new Set(db.T.registrations.filter(r=>String(r.registered_at)<=end).map(r=>r.person_id));
  const att = new Set(db.T.checkins.filter(c=>String(c.occurred_at)<=end && c.result==='admitted' && c.verification==='verified').map(c=>c.person_id));
  const grp = list => ({ people:list.length, registration_rate:r1(div(list.filter(p=>reg.has(p.person_id)).length,list.length)),
    attendance_rate: asof>=ev.starts ? r1(div(list.filter(p=>att.has(p.person_id)).length,list.length)) : null });
  return { as_of:asof, event_type:eventType, with_event:grp(ppl.filter(p=>withE.has(p.person_id))), without_event:grp(ppl.filter(p=>!withE.has(p.person_id))),
    evidence_strength:'OBSERVATIONAL ONLY',
    warning: eventType.startsWith('nurture') ? 'Selection bias is likely: nurture messages appear to be sent to people who had not completed registration, so lower rates do not show that email hurts. A randomised holdout is needed.'
      : eventType==='registration_start' ? 'Starting the form is a prerequisite step toward registering, so the gap is largely mechanical.'
      : 'People who take this action may already be more interested (self-selection). The gap is not a causal effect; a randomised test is needed.' };
}

/* Generic filter / group / aggregate used for unfamiliar questions. Never returns rows dated after the as-of date. */
const DATE_FIELD = { daily:'activity_date', people:'first_seen_at', interactions:'occurred_at', registrations:'registered_at', registration_history:'effective_at', checkins:'occurred_at', targets:'effective_at' };
const QUERY_TABLES = ['daily','people','interactions','registrations','registration_history','checkins','campaigns','targets','tasks','readings'];
function rowsFor(db, table, asof) {
  const src = table==='registration_history' ? db.T.history : db.T[table];
  const end = endOf(asof), ev = eventInfo(db), df = DATE_FIELD[table];
  const status = latestStatus(db, asof);
  const regByP = new Map(db.T.registrations.filter(r=>String(r.registered_at)<=end).map(r=>[r.person_id,r]));
  const att = new Set(db.T.checkins.filter(c=>String(c.occurred_at)<=end && c.result==='admitted' && c.verification==='verified').map(c=>c.person_id));
  return src.filter(r => !df || (df==='activity_date' ? dayOf(r[df])<=asof : String(r[df])<=end)).map(r => {
    const o = Object.assign({}, r);
    if (o.campaign_id && db.campaigns.get(o.campaign_id)) o.campaign_name = db.campaigns.get(o.campaign_id).campaign_name;
    if (table==='people' && o.first_campaign_id && db.campaigns.get(o.first_campaign_id)) o.first_campaign_name = db.campaigns.get(o.first_campaign_id).campaign_name;
    if (o.person_id) { const p = db.people.get(o.person_id); if (p) { o.person_type=p.person_type; o.person_name=p.person_name; }
      if (table!=='registrations') o.is_registered = regByP.has(o.person_id);
      if (asof>=ev.starts) o.attended = att.has(o.person_id); }
    if (table==='registrations') o.current_status = (status.get(o.registration_id)||{}).status || 'no_status';
    if (df && o[df]) { const d = dayOf(o[df]); o.date=d; o.month=d.slice(0,7); const dt=new Date(d+'T00:00:00Z'); o.week_start=addDays(d,-((dt.getUTCDay()+6)%7)); o.weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()]; if (String(o[df]).length>10) o.hour=+String(o[df]).slice(11,13); }
    return o;
  });
}
function query(db, asof, q) {
  const table = q.table;
  if (!QUERY_TABLES.includes(table)) return { error:`Unknown table. Use one of ${QUERY_TABLES.join(', ')}.` };
  let rows = rowsFor(db, table, asof);
  const fields = new Set(rows.slice(0,500).flatMap(r=>Object.keys(r)));
  const bad = [...(q.filters||[]).map(f=>f.field), ...(q.group_by||[]), ...(q.metrics||[]).map(m=>m.field).filter(Boolean)].filter(f=>rows.length && !fields.has(f));
  if (bad.length) return { error:`Field(s) not in ${table}: ${[...new Set(bad)].join(', ')}. This may mean the data does not contain it. Available: ${[...fields].join(', ')}` };
  const ops = { eq:(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(), ne:(a,b)=>String(a).toLowerCase()!==String(b).toLowerCase(),
    gt:(a,b)=>cmp(a,b)>0, gte:(a,b)=>cmp(a,b)>=0, lt:(a,b)=>cmp(a,b)<0, lte:(a,b)=>cmp(a,b)<=0,
    contains:(a,b)=>String(a??'').toLowerCase().includes(String(b).toLowerCase()), in:(a,b)=>String(b).split(',').map(s=>s.trim().toLowerCase()).includes(String(a).toLowerCase()) };
  function cmp(a,b){ return (!isNaN(+a) && !isNaN(+b) && a!=='' && b!=='') ? +a - +b : String(a??'').localeCompare(String(b)); }
  for (const f of q.filters||[]) { const fn = ops[f.op]; if (!fn) return { error:`Unknown operator ${f.op}` }; rows = rows.filter(r=>fn(r[f.field], f.value)); }
  const metrics = (q.metrics && q.metrics.length) ? q.metrics : [{op:'count'}];
  const label = m => m.field ? `${m.op}_${m.field}` : m.op;
  const agg = (list,m) => { if (m.op==='count') return list.length;
    if (m.op==='count_distinct') return new Set(list.map(r=>r[m.field]).filter(v=>v!=null&&v!=='')).size;
    const v = list.map(r=>r[m.field]).filter(x=>x!=null&&x!==''&&!isNaN(+x)).map(Number);
    if (!v.length) return null; const s=v.reduce((a,b)=>a+b,0);
    return m.op==='sum'?r1(s,2):m.op==='avg'?r1(s/v.length,4):m.op==='min'?v.reduce((a,b)=>Math.min(a,b)):m.op==='max'?v.reduce((a,b)=>Math.max(a,b)):null; };
  const limit = Math.min(+q.limit||40, 100);
  if (q.list_columns && q.list_columns.length) return { as_of:asof, table, matched_rows:rows.length, rows:rows.slice(0,limit).map(r=>Object.fromEntries(q.list_columns.map(c=>[c,r[c]]))), truncated:rows.length>limit };
  const groups = new Map();
  for (const r of rows) { const k = JSON.stringify((q.group_by||[]).map(g=>r[g]??null)); if (!groups.has(k)) groups.set(k,[]); groups.get(k).push(r); }
  if (!(q.group_by||[]).length && !groups.size) groups.set('[]',[]);
  let out = [...groups.entries()].map(([k,list]) => { const o={}; JSON.parse(k).forEach((v,i)=>o[q.group_by[i]]=v); for (const m of metrics) o[label(m)]=agg(list,m); return o; });
  const sortKey = q.sort_by || ((q.group_by||[]).length ? label(metrics[0]) : null);
  if (sortKey) out.sort((a,b)=> (q.sort_dir==='asc'?1:-1)*cmp(a[sortKey],b[sortKey]));
  return { as_of:asof, table, filters:q.filters||[], matched_rows:rows.length, groups:out.length, results:out.slice(0,limit), truncated:out.length>limit };
}

/* Arithmetic without eval. */
function calculate(expr) {
  const s = String(expr).replace(/[,_\s]/g,''); let i=0;
  const peek=()=>s[i];
  function E(){ let v=T(); while(peek()==='+'||peek()==='-'){ const o=s[i++]; const w=T(); v=o==='+'?v+w:v-w; } return v; }
  function T(){ let v=F(); while(peek()==='*'||peek()==='/'){ const o=s[i++]; const w=F(); v=o==='*'?v*w:v/w; } return v; }
  function F(){ let v=U(); if(peek()==='^'){ i++; v=Math.pow(v,F()); } return v; }
  function U(){ if(peek()==='-'){ i++; return -U(); } if(peek()==='('){ i++; const v=E(); if(s[i++]!==')') throw new Error('Missing )'); return v; }
    const m=/^\d+(\.\d+)?/.exec(s.slice(i)); if(!m) throw new Error('Unexpected input at position '+i); i+=m[0].length; return +m[0]; }
  try { const v=E(); if(i!==s.length) throw new Error('Unexpected trailing input'); if(!isFinite(v)) return {error:'Result is not finite (division by zero?)'}; return { expression:expr, result:Math.round(v*1e6)/1e6 }; }
  catch(e){ return { error:e.message }; }
}

const API = { SHEETS, KEYS, REQUIRED, DEFAULT_SETTINGS, materialize, prepare, snapshot, diagnose, decide, simulateBudget, comparePeriods, engagementLift, query, calculate, eventInfo, settingsOf, targetAt, latestStatus, addDays, daysBetween };
if (typeof module !== 'undefined') module.exports = API; else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
