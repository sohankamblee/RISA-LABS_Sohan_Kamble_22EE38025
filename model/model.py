"""Growth model. Run: python3 -I model.py <attendee.xlsx>  -> prints and writes model.json"""
import sys, json, math, random, pandas as pd
src=sys.argv[1]
x=pd.read_excel(src,sheet_name=None)
dm=x['Daily Marketing'].drop_duplicates('activity_id'); P=x['People']; R=x['Registrations']
H=x['Registration History'].drop_duplicates('history_id'); C=x['Check-ins'].drop_duplicates('event_id')
ext=set(P[P.person_type=='external'].person_id)
R=R[R.person_id.isin(ext)]
adm=C[(C.result=='admitted')&(C.verification=='verified')&C.person_id.isin(ext)]
vis=set(adm.person_id); walk=len(vis-set(R.person_id))
names=dict(zip(x['Campaigns'].campaign_id,x['Campaigns'].campaign_name))
hist={}
for c,n in names.items():
    d=dm[dm.campaign_id==c]; r=R[R.campaign_id==c]
    hist[c]=dict(name=n,spend=int(d.marketing_spend_inr.sum()),impr=int(d.impressions.sum()),clicks=int(d.clicks.sum()),
      sessions=int(d.landing_page_sessions.sum()),identified=int(((P.first_campaign_id==c)&(P.person_type=='external')).sum()),
      reg=int(r.person_id.nunique()),att=int(r.person_id.isin(vis).sum()))
    h=hist[c]; h['show']=h['att']/h['reg']; h['cpr']=h['spend']/h['reg']; h['cpa']=h['spend']/h['att']
tot={k:sum(h[k] for h in hist.values()) for k in ['spend','impr','clicks','sessions','identified','reg','att']}
tot.update(visitors=len(vis),walkins=walk,identified_all=int(P[P.person_type=='external'].person_id.nunique()),
           show=tot['att']/tot['reg'],visit_days=int(adm.assign(d=adm.occurred_at.dt.date).drop_duplicates(['person_id','d']).shape[0]))
# ---- plan (Rs thousands by channel)
PLAN_BASE   ={'C04':62,'C05':38,'C01':60,'C06':18,'C07':20,'C02':45,'C03':20}; SHOW_B=22; RES_B=15   # =300
PLAN_STRETCH={'C04':86,'C05':54,'C01':74,'C06':20,'C07':24,'C02':50,'C03':20}; SHOW_S=32; RES_S=0    # =360
assert sum(PLAN_BASE.values())+SHOW_B+RES_B==300 and sum(PLAN_STRETCH.values())+SHOW_S+RES_S==360
BASE=dict(e=0.70,overlap=0.15,show_lift=0.045,walk=120,transfer=0.96)
STRETCH=dict(e=0.80,overlap=0.10,show_lift=0.055,walk=150,transfer=1.0)
GROW=['C04','C05','C01']
def run(plan,e,overlap,show_lift,walk,transfer):
    ch={}
    for c,h in hist.items():
        s=plan[c]*1000; m=(s/h['spend'])**e*transfer
        o={k:h[k]*m for k in ['impr','clicks','sessions','identified','reg']}
        o.update(spend=s,att=o['reg']*h['show'],name=h['name']); ch[c]=o
    t={k:sum(v[k] for v in ch.values()) for k in ['spend','impr','clicks','sessions','identified','reg','att']}
    inc={c:ch[c]['att']-hist[c]['att'] for c in hist}
    ov=overlap*sum(max(0,inc[c]) for c in GROW)
    ovfrac=ov/t['att']
    reg=t['reg']*(1-ovfrac); att_pre=t['att']-ov
    lift=reg*show_lift
    visitors=att_pre+lift+walk
    for k in ['reg','identified']: t[k]*=(1-ovfrac)
    return dict(channels=ch,inc=inc,overlap_deduct=ov,lift=lift,walk=walk,reg=reg,att_reg=att_pre+lift,visitors=visitors,
                show=(att_pre+lift)/reg,funnel=t)
base=run(PLAN_BASE,**BASE); stretch=run(PLAN_STRETCH,**STRETCH)
# ---- Monte Carlo on the base plan: ranges are judgement calls, stated in README
random.seed(7); N=20000; sims=[]
for _ in range(N):
    sims.append(run(PLAN_BASE,e=random.uniform(.50,.90),overlap=random.uniform(.05,.25),
      show_lift=random.triangular(0,.08,.05),walk=random.triangular(50,175,125),transfer=random.triangular(.80,1.08,.98))['visitors'])
sims.sort(); q=lambda p:sims[int(p*N)]
mc=dict(p10=q(.1),p50=q(.5),p90=q(.9),p_ge_hist=sum(s>2050 for s in sims)/N,
        p_ge_2200=sum(s>=2200 for s in sims)/N,p_ge_2350=sum(s>=2350 for s in sims)/N)
random.seed(11)
ss=[run(PLAN_STRETCH,e=random.uniform(.50,.90),overlap=random.uniform(.05,.25),show_lift=random.triangular(0,.08,.05),
      walk=random.triangular(50,175,125),transfer=random.triangular(.80,1.08,.98))['visitors'] for _ in range(N)]
mc['stretch_plan']=dict(p50=sorted(ss)[N//2],p90=sorted(ss)[int(.9*N)],p_ge_3000=sum(v>=3000 for v in ss)/N,p_ge_3200=sum(v>=3200 for v in ss)/N)
sens={}
for k,lo,hi in [('transfer',.80,1.08),('e',.50,.90),('show_lift',0,.08),('overlap',.25,.05),('walk',50,175)]:
    a=run(PLAN_BASE,**{**BASE,k:lo})['visitors']; b=run(PLAN_BASE,**{**BASE,k:hi})['visitors']; sens[k]=[a,b]
# ---- capacity
days=adm.assign(d=adm.occurred_at.dt.date,h=adm.occurred_at.dt.hour).sort_values('occurred_at').drop_duplicates(['d','person_id'])
per_day=days.groupby('d').size(); peak=days.groupby(['d','h']).size()
vd=tot['visit_days']/len(vis); d1=per_day.max()/per_day.sum(); pk=peak.max()/per_day.loc[peak.idxmax()[0]]
def cap(v):
    day=v*vd*d1; ph=day*pk; lanes=math.ceil(ph/(240*0.7))
    return dict(peak_day=day,peak_hour=ph,lanes=lanes)
capacity=dict(visit_days_per_visitor=vd,day1_share=d1,peak_hour_share=pk,base=cap(base['visitors']),stretch=cap(stretch['visitors']))
# ---- pacing curve (share of final external registrations by days-to-event)
ev=pd.Timestamp('2025-04-12')
pace={t:float((R.registered_at<=ev-pd.Timedelta(days=t)+pd.Timedelta(hours=23,minutes=59)).mean()) for t in [70,56,42,28,14,7,1]}
# ---- A/B sample size for show-up engine (two-sided a=.05, power .8)
def n_arm(p1,p2):
    za,zb=1.95996,0.84162; pb=(p1+p2)/2
    return math.ceil((za*math.sqrt(2*pb*(1-pb))+zb*math.sqrt(p1*(1-p1)+p2*(1-p2)))**2/(p2-p1)**2)
ab=dict(p1=tot['show'],lift=.05,n_per_arm=n_arm(tot['show'],tot['show']+.05))
# ---- five bets
def standalone(chs,plan=PLAN_BASE,e=.70):
    return sum(hist[c]['reg']*((plan[c]*1000/hist[c]['spend'])**e)*hist[c]['show']-hist[c]['att'] for c in chs)
paid_extra=hist['C02']['reg']*(((hist['C02']['spend']+31000)/hist['C02']['spend'])**.7-1)*hist['C02']['show']
def pure(chs): return standalone(chs,e=BASE['e'])
show_gross=sum(hist[c]['reg']*(PLAN_BASE[c]*1000/hist[c]['spend'])**BASE['e'] for c in hist)*BASE['show_lift']
bets=[
 dict(id='B1',name='College Squad Pass',gross=pure(['C04']),extra_cost=62000-hist['C04']['spend'],budget=62000,conf=.8,pw=6),
 dict(id='B3',name='Crew Referral Loop',gross=pure(['C05']),extra_cost=38000-hist['C05']['spend'],budget=38000,conf=.7,pw=4),
 dict(id='B2',name='Show-Up Engine',gross=show_gross,extra_cost=22000,budget=22000,conf=.6,pw=3),
 dict(id='B4',name='Pay-per-Show Ambassadors',gross=pure(['C01']),extra_cost=60000-hist['C01']['spend'],budget=60000,conf=.6,pw=8),
 dict(id='B5',name='Paid + Creator Blitz',gross=paid_extra,extra_cost=31000,budget=31000,conf=.7,pw=4)]
for b in bets:
    b['rice']=b['gross']*b['conf']/b['pw']; b['cost_per_inc']=b['extra_cost']/b['gross']; b['score']=b['rice']/(b['cost_per_inc']/100)
# bridge: last edition -> base case (sums exactly)
nofric=run(PLAN_BASE,**{**BASE,'transfer':1.0,'show_lift':0.0,'overlap':0.0,'walk':tot['walkins']})
bridge=[['Last edition (actual)',tot['visitors']],
 ['College Squad Pass',nofric['inc']['C04']],['Crew Referral Loop',nofric['inc']['C05']],['Pay-per-Show Ambassadors',nofric['inc']['C01']],
 ['Organic + community',nofric['inc']['C06']+nofric['inc']['C07']],['Cut paid + creator',nofric['inc']['C02']+nofric['inc']['C03']]]
a1=run(PLAN_BASE,**{**BASE,'transfer':1.0,'show_lift':0.0,'walk':tot['walkins']})['visitors']
a2=run(PLAN_BASE,**{**BASE,'transfer':1.0,'walk':tot['walkins']})['visitors']
a3=run(PLAN_BASE,**{**BASE,'walk':tot['walkins']})['visitors']
bridge+=[['Overlap deduction',a1-nofric['visitors']],['Show-Up Engine',a2-a1],['New-city friction',a3-a2],['Walk-in change',base['visitors']-a3],['Base case',base['visitors']]]
assert abs(sum(v for _,v in bridge[:-1])-base['visitors'])<1e-6
OUT=dict(hist=hist,total=tot,plan_base=PLAN_BASE,plan_stretch=PLAN_STRETCH,show_budget=[SHOW_B,SHOW_S],reserve=[RES_B,RES_S],
 assumptions=dict(base=BASE,stretch=STRETCH),base=base,stretch=stretch,mc=mc,sens=sens,capacity=capacity,pace=pace,ab=ab,bets=bets,bridge=bridge,
 other_channels_inc=base['inc']['C06']+base['inc']['C07'], harvest_inc=base['inc']['C02']+base['inc']['C03'])
json.dump(OUT,open('model.json','w'),indent=1,default=float)
if __name__=='__main__':
    print(json.dumps({k:v for k,v in OUT.items() if k not in('hist','base','stretch')},indent=1,default=float))
    for n,s in [('base',base),('stretch',stretch)]:
        print(n,{k:round(v,3) for k,v in s.items() if not isinstance(v,dict)}); print({k:round(v) for k,v in s['funnel'].items()})
        print(pd.DataFrame(s['channels']).T[['name','spend','reg','att']].to_string()); print({k:round(v) for k,v in s['inc'].items()})
