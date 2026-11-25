"""Bundle src/ + data/baseline.json into one self-contained public/index.html"""
import pathlib
R=pathlib.Path(__file__).parent
html=(R/'src/index.tpl.html').read_text()
parts={'/*CSS*/':'src/style.css','/*XLSX*/':'vendor/xlsx.mini.min.js','/*DATA*/':'data/baseline.json','/*ENGINE*/':'src/engine.js','/*PLAN*/':'src/plan.js','/*COPILOT*/':'src/copilot.js','/*STORE*/':'src/store.js','/*UI*/':'src/ui.js'}
chunks={}
for k,f in parts.items():
    t=(R/f).read_text()
    if f.endswith(('.js','.json')): t=t.replace('</script','<\\/script')
    chunks[k]=t
for k,v in chunks.items():
    assert html.count(k)==1,k
    html=html.replace(k,v)
(R/'public').mkdir(exist_ok=True); (R/'public/index.html').write_text(html); print('built',len(html)//1024,'KB')
