"""Convert the source workbook to compact JSON. Rows are kept exactly as supplied (duplicates included);
the app de-duplicates at load time."""
import sys, json, pandas as pd
SHEETS={'event':'Event','targets':'Targets','campaigns':'Campaigns','daily':'Daily Marketing','people':'People',
 'interactions':'Interest and Engagement','registrations':'Registrations','history':'Registration History','checkins':'Check-ins'}
DROP={'daily':['campaign_name','owner_name'],'interactions':['campaign_name','owner_name','person_name','detail','owner_id'],
 'registrations':['campaign_name','owner_name','person_name','owner_id'],'history':['campaign_name','owner_name','person_name','owner_id','person_id','campaign_id'],
 'checkins':['campaign_name','owner_name','person_name','owner_id'],'people':['first_campaign_name','owner_name','owner_id']}
def fmt(v,col):
    if v is None or (isinstance(v,float) and pd.isna(v)) or v is pd.NaT: return ''
    if isinstance(v,pd.Timestamp):
        return v.strftime('%Y-%m-%d') if col in('activity_date','history_start','history_end') else v.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(v,float) and v.is_integer(): return int(v)
    return v.item() if hasattr(v,'item') else v
x=pd.read_excel(sys.argv[1],sheet_name=None); out={}
for k,s in SHEETS.items():
    d=x[s].drop(columns=DROP.get(k,[]),errors='ignore'); cols=list(d.columns); dicts={}; data=[]
    series=[[fmt(v,c) for v in d[c].tolist()] for c in cols]
    for i,c in enumerate(cols):
        u=list(dict.fromkeys(series[i]))
        if len(u)<len(series[i])*0.3 and len(u)<5000:
            ix={v:n for n,v in enumerate(u)}; dicts[i]=u; series[i]=[ix[v] for v in series[i]]
    out[k]={'cols':cols,'dicts':dicts,'rows':[list(r) for r in zip(*series)]}
json.dump(out,open(sys.argv[2],'w'),separators=(',',':'),ensure_ascii=False)
