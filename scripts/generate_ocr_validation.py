"""Independent rendered text-diagram regression set; no generated image is used to train the model."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import re,json,random
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/ocr-independent';out.mkdir(parents=True,exist_ok=True)
text=(root/'vendor/dds/hands/list100.txt').read_text()
deals=re.findall(r'PBN[^\n]*"N:([^"\n]+)"',text)
fonts=['pala.ttf','bookos.ttf','corbel.ttf','gadugi.ttf']
random.seed(90871);manifest=[]
for i,deal in enumerate(deals[:80]):
 w=random.choice([800,960,1120,1280]);h=round(w*2.1875);im=Image.new('RGB',(w,h),random.choice(['#eeeeee','#ffffff','#f5f3eb']));d=ImageDraw.Draw(im)
 f=ImageFont.truetype('C:/Windows/Fonts/'+fonts[i%4],round(w*.044));symbol=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',round(w*.047))
 positions=[(.305,.122),(.556,.24),(.305,.353),(.055,.24)]
 hands={}
 for seat,hand,(x,y) in zip('NESW',deal.split(),positions):
  cards=[]
  for j,(suit,ranks) in enumerate(zip('SHDC',hand.split('.'))):
   ranks=ranks.replace('-','');cards.extend(suit+r for r in ranks)
   xx=round(x*w);yy=round((y+j*.0285)*h);color='#d2151e' if suit in 'HD' else '#111111'
   d.text((xx,yy),'♠♥♦♣'[j],font=symbol,fill=color)
   d.text((xx+round(w*.045),yy),ranks.replace('T','10'),font=f,fill='#111111')
  hands[seat]=cards
 name=f'dds-{i+1:03}-{fonts[i%4]}.png';im.save(out/name);manifest.append({'file':name,'hands':hands,'font':fonts[i%4],'source':f'dds list100 deal {i+1}'})
(out/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
print(f'Generated {len(manifest)} images from official DDS deals, four fonts excluded from model training.')
