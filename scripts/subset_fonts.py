"""Create self-hosted WOFF2 subsets from OFL fonts; core UI first, remaining Unicode on demand."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
import re

root=Path(__file__).resolve().parents[1]
out=root/'public/fonts'
source=root/'.tools/fonts/noto-source';source.mkdir(parents=True,exist_ok=True)
ui=''.join(p.read_text(encoding='utf-8') for p in (root/'src').rglob('*.tsx'))
ui+=''.join(p.read_text(encoding='utf-8') for p in (root/'src').rglob('*.ts'))
core=set(range(32,256))|set(map(ord,ui))|set(map(ord,'♠♥♦♣−—✓'))
css=[]
for weight,filename in [(400,'k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf'),(600,'k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaGwHCnYw.ttf')]:
 original=source/filename
 if not original.exists():original.write_bytes((out/filename).read_bytes())
 font=TTFont(original);allcodes=set(font.getBestCmap());font.close()
 rest=sorted(allcodes-core);groups=[sorted(allcodes&core)]+[rest[i:i+256] for i in range(0,len(rest),256)]
 for i,codes in enumerate(groups):
  f=TTFont(original);options=subset.Options();options.flavor='woff2';options.layout_features=['*']
  sub=subset.Subsetter(options=options);sub.populate(unicodes=codes);sub.subset(f);f.flavor='woff2'
  name=f'noto-sc-{weight}-{i:03}.woff2';f.save(out/name);f.close()
  ranges=','.join(f'U+{c:X}' for c in codes)
  css.append(f"@font-face{{font-family:'Noto Sans SC';font-style:normal;font-weight:{weight};font-display:swap;src:url('/fonts/{name}') format('woff2');unicode-range:{ranges};}}")
 print(weight,len(groups),'subsets',flush=True)
(root/'src/fonts.css').write_text('\n'.join(css)+'\n',encoding='utf-8')
