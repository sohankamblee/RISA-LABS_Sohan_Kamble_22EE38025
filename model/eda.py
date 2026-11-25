import pandas as pd, numpy as np
import sys, pathlib
x=pd.read_excel(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).parent.parent/'data/Attendee_Dataset.xlsx',sheet_name=None)
dm=x['Daily Marketing'].drop_duplicates('activity_id'); P=x['People']; I=x['Interest and Engagement']
R=x['Registrations']; H=x['Registration History'].drop_duplicates('history_id'); C=x['Check-ins'].drop_duplicates('event_id')
pd.set_option('display.width',300)
def snap(asof):
    end=pd.Timestamp(asof)+pd.Timedelta(hours=23,minutes=59,seconds=59)
    ext=set(P[P.person_type=='external'].person_id)
    p=P[(P.first_seen_at<=end)&P.person_id.isin(ext)]
    r=R[(R.registered_at<=end)&R.person_id.isin(ext)]
    h=H[(H.effective_at<=end)&H.person_id.isin(ext)].sort_values(['effective_at','history_id']).groupby('registration_id').tail(1)
    c=C[(C.occurred_at<=end)&(C.result=='admitted')&(C.verification=='verified')&C.person_id.isin(ext)]
    d=dm[dm.activity_date<=end]
    print('\n== ',asof,'identified',p.person_id.nunique(),'registered',r.person_id.nunique(),'confirmed',(h.status=='confirmed').sum(),h.status.value_counts().to_dict(),'visitors',c.person_id.nunique(),'spend',d.marketing_spend_inr.sum())
    g=d.groupby('campaign_id')[['impressions','clicks','reported_reach','landing_page_sessions','registration_starts','marketing_spend_inr']].sum()
    g['identified']=p.groupby('first_campaign_id').size(); g['reg']=r.groupby('campaign_id').person_id.nunique()
    g['conf_now']=h[h.status=='confirmed'].groupby('campaign_id').size()
    g['cancel']=h[h.status=='cancelled'].groupby('campaign_id').size()
    g['wait']=h[h.status=='waitlisted'].groupby('campaign_id').size()
    first=c.sort_values('occurred_at').drop_duplicates('person_id')
    fm=first.merge(P[['person_id','first_campaign_id']],on='person_id')
    rc=r[r.person_id.isin(first.person_id)]
    g['attended_regsrc']=rc.groupby('campaign_id').person_id.nunique()
    g['attended_firsttouch']=fm.groupby('first_campaign_id').size()
    g['ctr']=g.clicks/g.impressions; g['id_to_reg']=g.reg/g.identified; g['show']=g.attended_regsrc/g.reg
    g['cpr']=g.marketing_spend_inr/g.reg; g['cpa']=g.marketing_spend_inr/g.attended_regsrc
    g['sess_to_reg']=g.reg/g.landing_page_sessions
    print(g.round(3).T.to_string())
    return p,r,h,c,first
p,r,h,c,first=snap('2025-04-20')
for a in ['2025-03-01','2025-03-14','2025-03-31','2025-04-11']: snap(a)
# attendance by final status
end=pd.Timestamp('2025-04-11 23:59:59')
h11=H[H.effective_at<=end].sort_values(['effective_at','history_id']).groupby('registration_id').tail(1)
h11=h11[h11.person_id.isin(P[P.person_type=='external'].person_id)]
h11['att']=h11.person_id.isin(first.person_id)
print('\nshow rate by pre-event status\n',h11.groupby('status').att.agg(['sum','count','mean']))
noreg=first[first.registration_id.isna()]
print('external visitors',len(first),'without registration id',len(noreg),'; not in Registrations at all',(~first.person_id.isin(R.person_id)).sum())
print('visitors by day',C[(C.result=='admitted')&(C.verification=='verified')&C.person_id.isin(first.person_id)].assign(d=lambda t:t.occurred_at.dt.date).groupby('d').person_id.nunique().to_dict())
print('first arrival hour',first.occurred_at.dt.hour.value_counts().sort_index().to_dict())
# lead times
rr=R[R.person_id.isin(P[P.person_type=='external'].person_id)].copy(); rr['att']=rr.person_id.isin(first.person_id)
rr['lead']=(pd.Timestamp('2025-04-12')-rr.registered_at).dt.days
print('show by lead-time bucket\n',rr.groupby(pd.cut(rr.lead,[-5,7,14,28,45,100])).att.agg(['count','mean']))
rr['wk']=rr.registered_at.dt.to_period('W'); print(rr.groupby('wk').size().to_string())
# engagement lift
ev=I.groupby(['person_id','event_type']).size().unstack(fill_value=0)>0
ext=P[(P.person_type=='external')].set_index('person_id')
ev=ev.reindex(ext.index).fillna(False); ev['reg']=ev.index.isin(R.person_id); ev['att']=ev.index.isin(first.person_id)
for col in ['brochure_download','registration_start','event_question_submitted','nurture_email_sent','nurture_email_opened','nurture_email_clicked','opted_out']:
    for t in ['reg','att']:
        a=ev[ev[col]==True][t]; b=ev[ev[col]!=True][t]; print(col,t,len(a),round(a.mean(),3),'vs',len(b),round(b.mean(),3))
print('started not registered',(ev.registration_start&~ev.reg).sum(),'brochure not reg',(ev.brochure_download&~ev.reg).sum())
print(dm[dm.marketing_spend_inr<0].to_string())
print('reg before first_seen', (R.merge(P[['person_id','first_seen_at']]).eval('registered_at<first_seen_at')).sum())
print('reg campaign != first campaign', (R.merge(P[['person_id','first_campaign_id']]).eval('campaign_id!=first_campaign_id')).sum())
print('\n#### capacity')
cc=C[(C.result=='admitted')&(C.verification=='verified')&C.person_id.isin(first.person_id)].copy()
cc['d']=cc.occurred_at.dt.date; fd=cc.sort_values('occurred_at').drop_duplicates(['d','person_id'])
print(fd.groupby(['d',fd.occurred_at.dt.hour]).size().unstack(0))
