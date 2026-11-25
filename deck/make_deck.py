"""Builds the 3-slide strategy PDF from model.json.  Usage: python3 make_deck.py "Your Name" "Roll number" """
import sys, json, pathlib, asyncio
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).parent
NAME=sys.argv[1] if len(sys.argv)>1 else 'Sohan Kamble'
ROLL=sys.argv[2] if len(sys.argv)>2 else '22EE38025'
m=json.load(open(HERE.parent/'model'/'model.json'))
b,s,t,h,mc=m['base'],m['stretch'],m['total'],m['hist'],m['mc']
n=lambda v:f"{v:,.0f}"
pc=lambda v,d=1:f"{v*100:.{d}f}%"
assert round(b['visitors'])==2373 and round(s['visitors'])==3132, 'model changed: re-check slide text'
def waterfall():
    items=m['bridge']; W,H=705,168; lo,hi=1850,2860; y=lambda v:H-44-(v-lo)/(hi-lo)*(H-62)
    short=['2025 actual','Squad Pass','Referral crew','Pay-per-show amb.','Organic + community','Cut paid + creator','Overlap','Show-Up Engine','New-city drag','Walk-ins','Base model']
    bw=W/len(items); out=f'<svg viewBox="0 0 {W} {H}" width="100%">'; run=0
    for i,(lab,v) in enumerate(items):
        end=i in(0,len(items)-1)
        a,bb=(lo,v) if end else (run,run+v)
        run=v if end else run+v
        col='#1d3557' if end else ('#1b8a5a' if v>0 else '#c0392b')
        top,bot=y(max(a,bb)),y(min(a,bb)); x=i*bw+5
        txt=n(v) if end else f"{'+' if v>0 else '−'}{abs(v):,.0f}"
        out+=f'<rect x="{x}" y="{top}" width="{bw-10}" height="{max(1.5,bot-top)}" fill="{col}"/><text x="{x+(bw-10)/2}" y="{top-3}" text-anchor="middle" font-size="10" font-weight="700" fill="#111">{txt}</text>'
        words=short[i].split(' '); 
        for k,w in enumerate(words): out+=f'<text x="{x+(bw-10)/2}" y="{H-33+k*10.5}" text-anchor="middle" font-size="9" fill="#444">{w}</text>'
    return out+f'<text x="0" y="9" font-size="9" fill="#777">Axis starts at {n(lo)}</text></svg>'
CSS='''
@page{size:1280px 720px;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,Carlito,Calibri,"DejaVu Sans",sans-serif;color:#141b26;font-size:11.4px;line-height:1.32}
.slide{width:1280px;height:720px;padding:18px 26px 12px;position:relative;overflow:hidden;page-break-after:always;display:flex;flex-direction:column}
.slide:last-child{page-break-after:auto}
.kick{font-size:11px;font-weight:700;letter-spacing:.06em;color:#1f5eff;text-transform:uppercase;display:flex;justify-content:space-between}
h1{font-size:23px;line-height:1.15;margin:3px 0 8px;color:#101a2b}
h2{font-size:12px;color:#101a2b;border-bottom:2px solid #1d3557;padding-bottom:2px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.03em}
table{border-collapse:collapse;width:100%}th{background:#1d3557;color:#fff;text-align:left;padding:3px 6px;font-size:10.6px}td{padding:3px 6px;border-bottom:1px solid #dde3ec;vertical-align:top}
.r td:not(:first-child),.r th:not(:first-child){text-align:right}
tr.hi td{background:#eef3ff;font-weight:700}
.dense{font-size:12.4px}.dense th{font-size:11.4px}.s1 .foot{padding-top:2px}.s1 td{padding:2px 6px}.foot{margin-top:auto;font-size:9.2px;color:#6b7687;border-top:1px solid #dde3ec;padding-top:4px}
.row{display:flex;gap:14px}.box{background:#f4f6fa;border-radius:6px;padding:6px 9px}
.big{display:flex;gap:10px;margin-bottom:8px}.big>div{border-radius:8px;padding:6px 12px;background:#f4f6fa;flex:1}.big b{font-size:25px;line-height:1.05;display:block}
.pill{display:inline-block;border-radius:10px;padding:0 6px;font-size:9.4px;font-weight:800;white-space:nowrap}
.g{background:#d9f2e6;color:#0b6b43}.a{background:#fdefd0;color:#8a5200}.red{background:#fde0dd;color:#a31f17}.bl{background:#e3ebff;color:#1d47b8}
.src{font-size:9px;font-weight:700;color:#1f5eff}
'''
ch=b['channels']
funnel_rows=[('Impressions (events, not people)','impr','impr'),('Clicks','clicks','clicks'),('Landing sessions','sessions','sessions'),('Identified people','identified','identified'),('Registrations','reg','reg')]
fr=''
for lab,a,k in funnel_rows:
    lyv={'impr':1029015,'clicks':32070,'sessions':24645,'identified':3500,'reg':2800}[a]
    fr+=f"<tr><td>{lab}</td><td>{n(lyv)}</td><td>{n(b['funnel'][k])}</td><td>{n(s['funnel'][k])}</td></tr>"
fr+=f"<tr><td>Show rate (attended ÷ registered)</td><td>{pc(t['show'])}</td><td>{pc(b['show'])}</td><td>{pc(s['show'])}</td></tr>"
fr+=f"<tr><td>+ unregistered walk-ins</td><td>{t['walkins']}</td><td>{b['walk']}</td><td>{s['walk']}</td></tr>"
fr+=f"<tr class='hi'><td>Verified external visitors (model → target)</td><td>2,050</td><td>{n(b['visitors'])} → 2,350</td><td>{n(s['visitors'])} → 3,000</td></tr>"
fr+="<tr><td>Marketing budget · cost per target visitor</td><td>₹2.74L · ₹134</td><td>₹3.00L · ₹128</td><td>₹3.60L · ₹120</td></tr>"
fr+=f"<tr><td>Click rate · registrations ÷ identified</td><td>3.1% · 80.0%</td><td>{pc(b['funnel']['clicks']/b['funnel']['impr'])} · {pc(b['funnel']['reg']/b['funnel']['identified'])}</td><td>{pc(s['funnel']['clicks']/s['funnel']['impr'])} · {pc(s['funnel']['reg']/s['funnel']['identified'])}</td></tr>"
def au(seg,size,evid,why,pri,cls): return f"<tr><td><b>{seg}</b></td><td>{size}</td><td>{evid}</td><td>{why}</td><td><span class='pill {cls}'>{pri}</span></td></tr>"
audiences=''.join([
 au('College clubs &amp; class groups (engg, degree, mgmt)','~90,000 students<br><span class="src">[A] 150 colleges × 600</span>','86% show · ₹81','Groups decide and turn up together','P1','g'),
 au('Friends of registrants','~2,900 seeds<br><span class="src">[A] = base registrants</span>','79% show · ₹69','Cheapest; needs seeds first','P1','g'),
 au('Peers of campus ambassadors','Subset of the 90,000','75% show · ₹108','Reach inside colleges; pay on show','P2','bl'),
 au('Interest communities + event searchers','~100 groups; search demand capped<br><span class="src">[A]</span>','78–83% · ₹72–97','Efficient but hard to scale','P2','bl'),
 au('Broad social &amp; creator audiences','Large, size unknown','50% show · ₹274–337','Buys sign-ups that do not show','P3','red')])
S1=f'''<div class="slide s1" style="padding-bottom:8px">
<div class="kick"><span>How high can we aim? · Challenge A: Attendee Growth</span><span style="color:#101a2b;font-size:13px;text-transform:none">{NAME} · {ROLL}</span></div>
<h1>Commit 2,350 verified outside visitors on ₹3.0L (+15%); chase 3,000 on ₹3.6L if early gates pass</h1>
<div class="big">
<div style="flex:1.55"><b style="font-size:15px">Bengaluru · 10–11 April 2027 (proposed)</b>Bengaluru Urban has <b style="display:inline;font-size:11.4px">1,106 colleges</b>, India’s top district (Jaipur 703, Hyderabad 491, Pune 475) <span class="src">[S1]</span>. So a metro-linked venue can draw many <span class="src">[A]</span>.</div>
<div><b style="color:#1d47b8">2,350</b>Base: simulation median {n(mc['p50'])}; P(≥2,350) {pc(mc['p_ge_2350'],0)}; P(&gt;2,050) {pc(mc['p_ge_hist'],0)}</div>
<div><b style="color:#0b6b43">3,000</b>Stretch: only {pc(mc['stretch_plan']['p_ge_3000'],0)} likely today. Needs 2.8× college + referral spend (untested). Extra ₹60k only if 27 Feb: ≥1,501 regs at ≤₹89</div></div>
<h2>Who we target: need only 2.6% of the core pool (base), 3.3% (stretch)</h2>
<table><tr><th style="width:290px">Audience</th><th style="width:230px">Potential size</th><th style="width:165px">2025 show · ₹/attendee <span style="font-weight:400">[D]</span></th><th>Why</th><th style="width:50px">Priority</th></tr>{audiences}</table>
<div class="row" style="margin-top:9px">
<div style="width:520px"><h2>Funnel and cost: 2025 actual → plan</h2><table class="r"><tr><th>Stage</th><th>2025 <span style="font-weight:400">[D]</span>*</th><th>Base</th><th>Stretch</th></tr>{fr}</table></div>
<div style="flex:1"><h2>Bridge: 2,050 → {n(b['visitors'])} base model</h2>{waterfall()}
<div class="box" style="margin-top:3px"><b>Why believe it:</b> the largest lever moves money from channels at ₹274–337 per attendee to ₹69–108. Show rate goes {pc(t['show'])} → 74.4% from channel mix → {pc(b['show'])} with reminders (+4.5 pts, unproven).<br><b>What breaks it:</b> new-city transfer swings the result {n(m['sens']['transfer'][0])}–{n(m['sens']['transfer'][1])}; spend elasticity {n(m['sens']['e'][0])}–{n(m['sens']['e'][1])}; 80% band {n(mc['p10'])}–{n(mc['p90'])}.</div></div></div>
<div class="row" style="margin-top:7px"><div class="box" style="flex:1.2"><b>Model:</b> channel registrations = 2025 × (new ÷ old spend)<sup>0.70</sup> (stretch 0.80); × 2025 show rate; − 15% overlap on gains of college, referral, ambassador (stretch 10%); + show lift; × 0.96 new-city factor (stretch 1.0). Ranges in the 20,000-run simulation are my judgement, not data.</div>
<div class="box" style="flex:1"><b>Capacity:</b> 1.35 visit-days per visitor, busier day 51.5%, peak hour 17.6% <span class="src">[D]</span> → stretch ≈2,185/day, 383 arrivals/hour. Book ≥2,500/day <span class="src">[A]</span>; 3 scan lanes at 168/hour each <span class="src">[A]</span> + 1 spare, manual fallback.</div></div>
<div class="foot"><b>[D]</b> Provided CampusFest 2025 data (synthetic, no city), de-duplicated. *Funnel rows sum campaign records; all-source identified = 3,625. <b>[S1]</b> Ministry of Education, AISHE 2021-22. <b>[A]</b> My assumption. Assumes 2025 channel behaviour carries to Bengaluru. Visitors = admitted + verified outsiders. Under-18s not targeted.</div></div>'''
bm={x['id']:x for x in m['bets']}
def bet(rank,i,name,call,cls,concept,contrib,res,test):
    x=bm[i]; return f"<tr><td style='font-size:19px;font-weight:800;color:#1d3557'>{rank}</td><td><b style='font-size:12.4px'>{name}</b><br><span class='pill {cls}'>{call}</span></td><td>{concept}</td><td>{contrib}</td><td>{res}</td><td>{test}</td><td style='text-align:center'><b style='font-size:14px'>{x['score']:.1f}</b><br><span style='font-size:9.4px'>{x['gross']:.0f}×{pc(x['conf'],0)}÷{x['pw']}pw<br>₹{x['cost_per_inc']:.0f}/extra</span></td></tr>"
rows=''.join([
bet(1,'B1','College Squad Pass','DOUBLE DOWN','g','Clubs register squads of 8+ through a captain; reserved zone, club leaderboard, certificate. Works because college partners already show best (85.6%) at ₹81.','<b>+240</b> gross<br>High confidence (80%)','<b>₹62k</b> (+31k)<br>1 lead + 25 captains; 6 pw<br>18 Jan–27 Mar','Two squad offers randomised across matched colleges. KPIs: clubs signed, squad fill, cost/reg, confirm %.'),
bet(2,'B3','Crew Referral Loop','DOUBLE DOWN','g','Each registrant gets a crew link; reward unlocks when 3 friends are <i>verified at the gate</i>. 2025 referrals: ₹69/attendee, lowest.','<b>+172</b> gross<br>70% confidence','<b>₹38k</b> (+19k)<br>1 growth + dev; 4 pw<br>1 Feb–9 Apr; needs B1 seeds','A/B reward: priority entry vs merch. KPIs: invite→reg %, cost/reg, duplicate %.'),
bet(3,'B2','Show-Up Engine','BUILD + HOLDOUT','bl','QR pass, opt-in reminders at T-7/T-3/T-1, one-tap reconfirm, personal day-wise lineup, backfill freed spots from waitlist. 2025: 31% did not attend.','<b>+138</b> gross (+4.5 pts); 134 after overlap<br>60%: unproven','<b>₹22k</b><br>1 ops + dev; 3 pw<br>build Feb; send 3–9 Apr','Random 80/20 holdout (~73% power for +5 pts). KPIs: delivery, reconfirm %, opt-out, show-rate lift.'),
bet(4,'B4','Pay-per-Show Ambassadors','RESTRUCTURE','a','Small base + payout per verified check-in, pods of 4; avoids paying for empty sign-ups. 2025: 75% show, below other peer channels.','<b>+111</b> gross<br>60% confidence','<b>₹60k</b> (+18k)<br>1 lead + 30 reps; 8 pw<br>22 Jan–10 Apr','Old vs new payout by college cluster. KPIs: active share, cost/reg, show %.'),
bet(5,'B5','Paid Social + Creator blitz','REJECT SCALE-UP','red','The tempting option: biggest reach. But CTR trails (paid 2.1% vs 3.6% for others) and only 50% of registrants attend. Keep a capped, gated test.','Blitz +₹31k: only <b>+76</b><br>at ₹409 per extra','Cap <b>₹65k</b> (from ₹152k)<br>4 pw; start 1 Feb','Venue-radius creatives; each gets ₹8k, then cost/reg gate. KPIs: CTR, cost/reg, confirm %.')])
alloc=[('College squads',31,62,86),('Referral crew',19,38,54),('Ambassadors',42,60,74),('Show-Up Engine',0,22,32),('Paid social',93,45,50),('Creators',59,20,20),('Organic search',14,18,20),('Community',16,20,24),('Reserve',0,15,0)]
assert [sum(a[i] for a in alloc) for i in (1,2,3)]==[274,300,360]
at=''.join(f"<th>{a[0]}</th>" for a in alloc)
S2=f'''<div class="slide dense">
<div class="kick"><span>Where will we place our bets?</span><span>Five ideas, ranked</span></div>
<h1>Double down on squads and referrals; fix turnout and ambassador pay; stop buying cheap reach</h1>
<table><tr><th style="width:26px">#</th><th style="width:132px">Idea · call</th><th style="width:300px">Concept and why it could work</th><th style="width:130px">Extra visitors vs 2025</th><th style="width:150px">Budget · people · timing</th><th>Test and KPIs</th><th style="width:96px">Score</th></tr>{rows}</table>
<div style="margin-top:9px"><h2>Money, ₹ thousand: cut paid + creator by ₹87k, reinvest it plus ₹26k more</h2><table class="r"><tr><th>Line</th>{at}<th>Total</th></tr>
<tr><td>2025 spent</td>{''.join(f'<td>{a[1]}</td>' for a in alloc)}<td>274</td></tr><tr class="hi"><td>Base plan</td>{''.join(f'<td>{a[2]}</td>' for a in alloc)}<td>300</td></tr><tr><td>Stretch</td>{''.join(f'<td>{a[3]}</td>' for a in alloc)}<td>360</td></tr></table></div>
<div class="row" style="margin-top:9px">
<div class="box" style="flex:1"><b>The trade I am making:</b> giving up ~228 attendees from paid + creators to buy +240 squads, +172 referrals, +111 ambassadors, +65 organic/community and +134 show-up. After −78 overlap, −87 new-city drag and −5 walk-ins: <b>net +323</b>.</div>
<div class="box" style="flex:1"><b>Overlap and dependencies:</b> squads and ambassadors hit the same colleges, so each college gets one owner and one tracked link. Referrals need squad registrants as seeds. Show-up acts on everyone's registrations, so it is not added twice. Team limit: 4 owners plus volunteers, 25 person-weeks across the five.</div>
<div class="box" style="flex:1"><b>Biggest portfolio risk:</b> last-touch data cannot show whether paid ads helped other channels. So paid is capped, not zeroed, and organic + referral volume is watched after any cut. <b>Also rejected:</b> celebrity headliner (cost, unproven); more email volume (12.7% of emailed people opted out in 2025).</div></div>
<div class="foot"><b>Framework: money-adjusted RICE</b> = (extra attendees × confidence ÷ person-weeks) ÷ (₹ per extra attendee ÷ 100). Impact is already in "extra attendees". Confidence and effort are judgement calls. B3 scores 27.2 vs B1 24.9; I rank B1 first because B3 depends on it and the gap is under 10%. B5 is scored as the scale-up I reject. Gross = before overlap and new-city drag.</div></div>'''
def r3(name,var,good,bad,scale,change,stop,when):
    return f"<tr><td><b>{name}</b><br><span style='font-size:9.4px;color:#555'>{when}</span></td><td>{var}</td><td><span class='pill g'>✓</span> {good}<br><span class='pill red'>✗</span> {bad}</td><td>{scale}</td><td>{change}</td><td>{stop}</td></tr>"
r=''.join([
r3('1 · Squad Pass','<b>Active clubs × squad fill.</b> Risk: slow ramp; captains go quiet.','25 clubs with captains by 13 Feb','&lt;15 clubs by 13 Feb','CPR ≤₹87, pace ≥100%, confirm ≥89% → add ₹12k','CPR ₹87–113 or pace 70–99% → swap bottom clubs, change squad size or perk','Not before 13 Mar. Then CPR &gt;₹113 <b>and</b> pace &lt;70% twice → stop new squad spend','Weekly; plan 709 regs'),
r3('2 · Referral Crew','<b>Invites per reg × invite→reg.</b> Risk: fake or duplicate sign-ups.','≥25% invite within 72h; ≥15% convert','&lt;8% convert by 6 Mar','CPR ≤₹69 and conversion ≥15% → fund more rewards','CPR ₹69–90 or 8–15% → new reward, ask right after confirmation','Duplicates &gt;5% → pause payouts. CPR &gt;₹90 twice after 13 Mar → freeze','Twice weekly; plan 551'),
r3('3 · Show-Up Engine','<b>Reconfirm → attend link.</b> Risk: message fatigue; proxy may not predict turnout.','Delivery ≥95%, reconfirm ≥60%','Reconfirm &lt;40%','≥60% and opt-out ≤3% per send → keep cadence; roll out next edition if holdout confirms lift','40–59% → change timing, channel, lineup hook','Opt-out &gt;5% or delivery &lt;90% → stop that send. Real lift judged only after event','Each send, 3–9 Apr'),
r3('4 · Pay-per-Show Amb.','<b>Share of reps with 5+ regs/week.</b> Risk: reps quit over delayed pay.','≥50% active by 27 Feb','&lt;30% active','CPR ≤₹93 and ≥50% active → add reps in best colleges','30–49% → replace bottom quarter, pair into pods, pay base weekly','&lt;30% active or confirm &lt;80% twice → stop hiring, move money to B1/B3','Weekly; plan 647'),
r3('5 · Paid + Creator test','<b>Click rate and confirm quality.</b> Risk: cheap clicks, no-shows; hidden assist lost.','CTR ≥2.5%, CPR ≤₹95','CPR &gt;₹150 after ₹8k','CPR ≤₹95 and confirm ≥85% → +₹10k from reserve','CPR ₹95–150 → new creative or creator, tighter geography','CPR &gt;₹150 after ₹8k → pause that creative/creator','Every ₹8k per creative')])
gt=''.join(f"<tr><td>{d}</td><td>{p}</td><td>{n(2857*v)}</td><td>{n(2857*v*.85)}</td></tr>" for d,p,v in [('27 Feb','41%',.409),('13 Mar','56%',.558),('27 Mar','80%',.801),('3 Apr','92%',.922)])
S3=f'''<div class="slide dense">
<div class="kick"><span>How will we know what is working?</span><span>Leading signals → thresholds → action</span></div>
<h1>Judge each bet on early signals with set kill lines, but protect slow-ramp channels from a premature stop</h1>
<table><tr><th style="width:128px">Bet · read</th><th style="width:190px">Critical variable · biggest risk</th><th style="width:175px">Early signal</th><th style="width:190px"><span class="pill g">SCALE</span></th><th style="width:220px"><span class="pill a">CHANGE</span></th><th><span class="pill red">STOP</span></th></tr>{r}</table>
<div style="font-size:9.6px;color:#555;margin-top:2px">CPR = cumulative spend ÷ registrations. Pace = cumulative registrations ÷ plan × 2025 share at the same days-to-event. No cost verdict below ₹8k spend and 40 registrations. Thresholds are starting rules to recalibrate in week 4.</div>
<div class="row" style="margin-top:8px">
<div style="width:318px"><h2>Whole-campaign tripwire</h2><table class="r"><tr><th>Gate</th><th>2025 share</th><th>Plan regs</th><th>Alarm below</th></tr>{gt}</table><div style="margin-top:3px">Below alarm: release ₹15k reserve to the best-CPR channel, add 10 clubs, reset the public forecast. Separately, ≥1,501 regs on 27 Feb at CPR ≤₹89 unlocks the stretch ₹60k.</div></div>
<div style="width:385px"><h2>Cause and effect: a backtest on 2025</h2><table class="r"><tr><th>Cost per confirmed ÷ blended</th><th>1 Mar</th><th>14 Mar</th><th>31 Mar</th></tr><tr><td>Creator Partners</td><td>2.11×</td><td>2.13×</td><td>1.98×</td></tr><tr><td>College Partnerships</td><td>1.04×</td><td>1.19×</td><td>0.71×</td></tr></table><div style="margin-top:3px">Creators were flagged to cut <b>six weeks early</b>. College partners looked mediocre until late, then finished at 0.57× cost per attendee. So: no stop on slow-ramp bets before the protect date, and two bad reads in a row. Trap: emailed people attended less (35% vs 70%), likely because email targeted non-converters. Only a holdout can settle it.</div></div>
<div style="flex:1"><h2>Dashboard + AI copilot: the weekly loop</h2><div class="box"><b>1 Detect:</b> Diagnose tab finds each channel's weakest stage and splits changes into traffic vs conversion.<br><b>2 Decide:</b> rules engine returns scale / change / stop with sample guards; allocator tests budget cuts and caps.<br><b>3 Ask:</b> copilot answers from live data, separates evidence from assumption, flags untraced numbers, says when data cannot answer.<br><b>4 Act:</b> it proposes a task; a human confirms; owner and deadline are saved.<br><b>5 Re-check:</b> new readings recompute verdicts. The AI never edits data on its own.</div></div></div>
<div class="foot">Backtest uses only records dated on or before each snapshot, on one synthetic edition: it shows how the rules behave, not that they will generalise. Dates assume the 10–11 April 2027 event.</div></div>'''
html=f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{S1}{S2}{S3}</body></html>'
(HERE/'deck.html').write_text(html)
async def go():
    async with async_playwright() as p:
        br=await p.chromium.launch(); pg=await br.new_page(viewport={'width':1280,'height':720})
        await pg.goto((HERE/'deck.html').as_uri()); await pg.wait_for_timeout(500)
        over=await pg.evaluate("""[...document.querySelectorAll('.slide')].map(s=>{const f=s.querySelector('.foot');const r=s.getBoundingClientRect();let low=0;s.querySelectorAll('*').forEach(e=>{if(!e.closest('.foot')&&!e.closest('svg')){low=Math.max(low,e.getBoundingClientRect().bottom)}});return {footer_past_page:Math.round(f.getBoundingClientRect().bottom-r.bottom),content_into_footer:Math.round(low-f.getBoundingClientRect().top),sideways:s.scrollWidth-s.clientWidth}})""")
        print('layout check (all <=0 is good):',over)
        out=HERE/f'{NAME.replace(" ","_")}_Growth_Strategy.pdf'
        await pg.pdf(path=str(out),width='1280px',height='720px',print_background=True); await br.close(); print(out)
asyncio.run(go())
