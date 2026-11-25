/* The next-edition plan (Bengaluru, 10-11 April 2027). Targets and thresholds come from model/model.py.
   These are PLAN values and assumptions, not observed results. */
(function(root){
'use strict';
const GATES = [ // date, share of final registrations last edition had reached at the same days-to-event
  {date:'2027-02-27', label:'T-42', share:0.409},{date:'2027-03-13', label:'T-28', share:0.558},
  {date:'2027-03-27', label:'T-14', share:0.801},{date:'2027-04-03', label:'T-7', share:0.922}];
const BETS = [
 {id:'B1',rank:1,name:'College Squad Pass',call:'DOUBLE DOWN',budget:62000,plan_regs:709,max_cpr:87,min_confirm:0.89,leading:'Partner clubs signed with a named captain',leading_target:25,leading_by:'2027-02-13',ramp_protect_until:'2027-03-13',
  scale:'CPR <= Rs 87, regs >= 100% of pace, confirmation >= 89%: add Rs 12k',change:'CPR Rs 87-113 or pace 70-99%: swap bottom clubs, change squad size or perk',stop:'After T-28 only: CPR > Rs 113 AND pace < 70% on 2 reads: stop new squad spend'},
 {id:'B3',rank:2,name:'Crew Referral Loop',call:'DOUBLE DOWN',budget:38000,plan_regs:551,max_cpr:69,min_confirm:0.89,leading:'Invite-to-registration conversion (%)',leading_target:15,leading_by:'2027-03-06',ramp_protect_until:'2027-03-13',
  scale:'CPR <= Rs 69 and invite conversion >= 15%: fund more rewards',change:'CPR Rs 69-90 or conversion 8-15% (or lower): change reward and share moment',stop:'Duplicates > 5%: pause payouts. CPR > Rs 90 on 2 reads after T-28: freeze'},
 {id:'B2',rank:3,name:'Show-Up Engine',call:'BUILD, WITH HOLDOUT',budget:22000,plan_regs:null,max_cpr:null,min_confirm:null,leading:'Reconfirmation rate of messaged registrants (%)',leading_target:60,leading_by:'2027-04-07',ramp_protect_until:'2027-04-07',
  scale:'Reconfirm >= 60%, opt-out <= 3%, delivery >= 95%: keep cadence',change:'Reconfirm below 60% (or opt-out 3-5%, delivery 90-95%): change timing, channel, lineup hook',stop:'Opt-out > 5% or delivery < 90%: stop that send'},
 {id:'B4',rank:4,name:'Pay-per-Show Ambassadors',call:'RESTRUCTURE',budget:60000,plan_regs:647,max_cpr:93,min_confirm:0.89,leading:'Ambassadors with 5+ registrations a week (%)',leading_target:50,leading_by:'2027-02-27',ramp_protect_until:'2027-02-27',
  scale:'CPR <= Rs 93 and active share >= 50%: add reps in best colleges',change:'Active share 30-49% or CPR above Rs 93: replace bottom quarter, pair into pods, pay base weekly',stop:'From 27 Feb: active share < 30% or confirmation < 80% on 2 reads: stop hiring, move money to B1/B3'},
 {id:'B5',rank:5,name:'Paid + Creator (capped test)',call:'DEPRIORITISE',budget:65000,plan_regs:556,max_cpr:117,min_confirm:0.85,leading:'Click-through rate (%)',leading_target:2.5,leading_by:'2027-02-13',ramp_protect_until:'2027-02-06',
  scale:'CPR <= Rs 95 and confirmation >= 85%: add Rs 10k from reserve',change:'CPR Rs 95-150: new creative or creator, tighter geography',stop:'CPR > Rs 150 after Rs 8k spend: pause that creative or creator'}
];
function paceShare(date){ // linear interpolation between gate shares
  const pts=[{date:'2027-01-18',share:0},{date:'2027-01-30',share:0.042},{date:'2027-02-13',share:0.21},...GATES,{date:'2027-04-09',share:1}];
  const t=Date.parse(date); if(t<=Date.parse(pts[0].date)) return 0;
  for(let i=1;i<pts.length;i++){ const a=Date.parse(pts[i-1].date), b=Date.parse(pts[i].date); if(t<=b) return pts[i-1].share+(pts[i].share-pts[i-1].share)*(t-a)/(b-a); }
  return 1;
}
/* Verdict for each bet from the weekly readings the team enters. Spend, registrations and confirmed are summed to date;
   percentages (leading value, duplicates, opt-outs, delivery) are taken from the reading itself.
   These rules mirror slide 3 of the strategy deck one for one. */
const num=v=>v===''||v==null||isNaN(+v)?null:+v;
function evaluate(readings){
  return BETS.map(b=>{
    const rs=readings.filter(r=>r.bet_id===b.id).sort((x,y)=>x.week_ending.localeCompare(y.week_ending));
    const base={id:b.id,rank:b.rank,name:b.name,call:b.call,budget_inr:b.budget,plan_registrations:b.plan_regs,leading_indicator:b.leading,leading_target:b.leading_target,
      scale_rule:b.scale,change_rule:b.change,stop_rule:b.stop,readings:rs.length,includes_simulated:rs.some(r=>r.source==='simulated')};
    if(!rs.length) return Object.assign(base,{verdict:'NOT STARTED',reason:'No readings entered yet.'});
    const upto=i=>{ const s=rs.slice(0,i+1), sum=f=>s.reduce((a,r)=>a+(+r[f]||0),0); const regs=sum('registrations'), spend=sum('spend_inr'); const last=s[s.length-1];
      return {week:last.week_ending,regs,spend,cpr:regs?spend/regs:null,confirm:regs?sum('confirmed')/regs:null,lead:num(last.leading_value),
        dup:num(last.dup_pct),optout:num(last.optout_pct),delivery:num(last.delivery_pct),
        pace:b.plan_regs?regs/(b.plan_regs*paceShare(last.week_ending)||1):null}; };
    const cur=upto(rs.length-1), prev=rs.length>1?upto(rs.length-2):null;
    const stats={as_of_week:cur.week,cumulative_registrations:cur.regs,cumulative_spend_inr:cur.spend,cpr_inr:cur.cpr&&Math.round(cur.cpr*10)/10,
      confirmation_rate:cur.confirm&&Math.round(cur.confirm*1000)/1000,pace_vs_plan:cur.pace&&Math.round(cur.pace*100)/100,leading_value:cur.lead,
      duplicate_pct:cur.dup,optout_pct:cur.optout,delivery_pct:cur.delivery};
    const out=(verdict,reason)=>Object.assign(base,stats,{verdict,reason});
    const pct=v=>Math.round(v*100)+'%';

    if(b.id==='B2'){ // message health first, then the reconfirmation proxy
      const harm=[]; if(cur.optout!=null&&cur.optout>5) harm.push(`opt-out ${cur.optout}% is above 5%`); if(cur.delivery!=null&&cur.delivery<90) harm.push(`delivery ${cur.delivery}% is below 90%`);
      if(harm.length) return out('STOP',`Stop this send: ${harm.join(' and ')}.`);
      if(cur.lead==null) return out('INSUFFICIENT EVIDENCE','No reconfirmation rate entered.');
      if(cur.lead<60) return out('CHANGE',`Reconfirmation ${cur.lead}% is below 60%${cur.lead<40?' (and below the 40% warning line)':''}: change timing, channel or lineup hook.`);
      if(cur.optout==null||cur.delivery==null) return out('HOLD',`Reconfirmation ${cur.lead}% passes. Enter opt-out % and delivery % before calling this SCALE.`);
      if(cur.optout>3||cur.delivery<95) return out('CHANGE',`Reconfirmation ${cur.lead}% passes, but ${cur.optout>3?`opt-out ${cur.optout}% is above 3%`:`delivery ${cur.delivery}% is below 95%`}.`);
      return out('SCALE',`Reconfirmation ${cur.lead}%, opt-out ${cur.optout}%, delivery ${cur.delivery}%: keep the cadence. Real turnout lift is judged only against the holdout after the event.`);
    }
    if(b.id==='B3'&&cur.dup!=null&&cur.dup>5) return out('STOP',`Fake or duplicate sign-ups are ${cur.dup}% (above 5%): pause payouts and clean the data. Ramp protection does not apply to integrity breaches.`);
    if(cur.spend<8000&&cur.regs<40) return out('INSUFFICIENT EVIDENCE','Below Rs 8,000 spend and 40 registrations.');
    const protectedNow=cur.week<b.ramp_protect_until;
    const money=`CPR Rs ${stats.cpr_inr}, confirmation ${pct(cur.confirm||0)}${b.id==='B5'?'':`, pace ${pct(cur.pace||0)}`}`;

    const bad=s=>{ if(!s||s.cpr==null) return false;
      if(b.id==='B1') return s.cpr>113&&s.pace<0.7;
      if(b.id==='B3') return s.cpr>90;
      if(b.id==='B4') return (s.lead!=null&&s.lead<30)||s.confirm<0.80;
      return s.cpr>150&&s.spend>=8000; };
    const stopNow = b.id==='B5' ? bad(cur) : (bad(cur)&&bad(prev)&&!protectedNow);
    if(stopNow) return out('STOP',`${money}${b.id==='B4'&&cur.lead!=null?`, active ambassadors ${cur.lead}%`:''}: stop line breached${b.id==='B5'?' after Rs 8,000 spend':' on two consecutive reads'}.`);

    const misses=[];
    if(b.id==='B1'){ if(cur.cpr==null||cur.cpr>87) misses.push('CPR above Rs 87'); if(cur.pace<1) misses.push('pace below 100%'); if(cur.confirm<0.89) misses.push('confirmation below 89%');
      if(cur.week>='2027-02-13'&&cur.week<'2027-02-27'&&cur.lead!=null&&cur.lead<15) misses.push(`only ${cur.lead} clubs signed by 13 Feb (warning line 15)`); }
    if(b.id==='B3'){ if(cur.cpr==null||cur.cpr>69) misses.push('CPR above Rs 69'); if(cur.lead!=null&&cur.lead<15) misses.push(`invite conversion ${cur.lead}% below 15%`); }
    if(b.id==='B4'){ if(cur.cpr==null||cur.cpr>93) misses.push('CPR above Rs 93'); if(cur.lead!=null&&cur.lead<50) misses.push(`active ambassadors ${cur.lead}% below 50%`); if(cur.confirm<0.80) misses.push('confirmation below 80%'); }
    if(b.id==='B5'){ if(cur.cpr==null||cur.cpr>95) misses.push('CPR above Rs 95'); if(cur.confirm<0.85) misses.push('confirmation below 85%'); }
    if(misses.length) return out('CHANGE',`${money}. Missed: ${misses.join('; ')}.${protectedNow&&b.id!=='B5'?` Ramp protection: no cost-based STOP before ${b.ramp_protect_until}.`:''}`);
    if((b.id==='B3'||b.id==='B4')&&cur.lead==null) return out('HOLD',`${money} passes. Enter the leading indicator before calling this SCALE.`);
    return out('SCALE',`${money}${b.id==='B3'?`, invite conversion ${cur.lead}%`:''}${b.id==='B4'?`, active ambassadors ${cur.lead}%`:''}: all scale conditions met.`);
  });
}
const SEED_TASKS=[
 ['PT01','Sign 25 college clubs, each with a named squad captain','Meera Iyer','2027-02-13','C04','High','B1'],
 ['PT02','Ship squad registration page with unique squad links and duplicate checks','Dev Malhotra','2027-01-25','C05','High','B3'],
 ['PT03','Set up invite tracking (invites sent, invite to registration, duplicates)','Dev Malhotra','2027-01-30','C05','High','B3'],
 ['PT04','Rewrite ambassador payout: small base plus payment per verified check-in','Meera Iyer','2027-01-22','C01','High','B4'],
 ['PT05','Assign random 80/20 holdout for reconfirmation messages before first send','Arjun Verma','2027-03-20','','High','B2'],
 ['PT06','Launch paid and creator capped test with CPR gate after Rs 8k per creative','Nisha Rao','2027-02-06','C02','Medium','B5'],
 ['PT07','Book venue for 2,500 per day and 4 scan lanes; rehearse manual fallback','Arjun Verma','2027-02-01','','High','Capacity'],
 ['PT08','T-42 gate review: 41% of registration plan reached? Decide stretch unlock','Meera Iyer','2027-02-27','','High','Gate']
].map(a=>({task_id:a[0],title:a[1],owner:a[2],due_date:a[3],campaign_id:a[4],priority:a[5],tag:a[6],status:'To do',source:'plan seed',notes:'',workspace:'2027 plan'}));
const API={BETS,GATES,SEED_TASKS,evaluate,paceShare};
if(typeof module!=='undefined') module.exports=API; else root.Plan=API;
})(typeof window!=='undefined'?window:globalThis);
