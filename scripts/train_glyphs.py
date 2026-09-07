"""Train a small glyph recognizer from synthetic fonts only. User screenshots are never training input."""
from pathlib import Path
import random,json,time,argparse
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import torch
from torch import nn
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--version',default='v4')
parser.add_argument('--max-angle',type=float,default=12)
args=parser.parse_args()
random.seed(418);np.random.seed(418);torch.manual_seed(418)
labels=list('23456789TJQKA')+['10','S','H','D','C','1','0']
glyphs=list('23456789TJQKA')+['10','♠','♥','♦','♣','1','0']
fontroot=Path('C:/Windows/Fonts')
names=['arial.ttf','arialbd.ttf','arialn.ttf','arialnb.ttf','times.ttf','timesbd.ttf','calibri.ttf','calibrib.ttf','cambria.ttc','consola.ttf','consolab.ttf','tahoma.ttf','tahomabd.ttf','verdana.ttf','verdanab.ttf','segoeui.ttf','seguisb.ttf','georgia.ttf','georgiab.ttf','trebuc.ttf','trebucbd.ttf']
fonts=[p for n in names if (p:=fontroot/n).exists()]+list((root/'.tools/fonts').glob('*.ttf'))*3
def render(index,angle=None,font=None):
 f=ImageFont.truetype(str(font or random.choice(fonts)),random.randint(14,70));im=Image.new('L',(160,160));d=ImageDraw.Draw(im);d.text((35,20),glyphs[index],font=f,fill=255,stroke_width=random.choice([0,0,0,1]));box=im.getbbox();im=im.crop(box)
 im=im.resize((max(2,int(im.width*random.uniform(.7,1.3))),im.height))
 angle=random.choice([0,0,0,random.uniform(-args.max_angle,args.max_angle)]) if angle is None else angle
 im=im.rotate(angle,expand=True,resample=Image.Resampling.BILINEAR);box=im.getbbox();im=im.crop(box)
 if random.random()<.5:im=im.point(lambda x:255 if x>random.randint(70,160) else 0)
 if random.random()<.3:im=im.filter(ImageFilter.GaussianBlur(random.uniform(.1,.65)))
 scale=26/max(im.size);im=im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.Resampling.BILINEAR)
 out=Image.new('L',(32,32));out.paste(im,((32-im.width)//2+random.randint(-1,1),(32-im.height)//2+random.randint(-1,1)))
 a=np.array(out,dtype=np.float32)/255
 a=np.clip(a+np.random.normal(0,.025,a.shape),0,1)
 return a.astype(np.float32)
class Net(nn.Module):
 def __init__(self):
  super().__init__();self.layers=nn.Sequential(nn.Conv2d(1,24,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),nn.Conv2d(24,48,3,padding=1),nn.ReLU(),nn.MaxPool2d(2),nn.Conv2d(48,64,3,padding=1),nn.ReLU(),nn.AdaptiveAvgPool2d((4,4)),nn.Flatten(),nn.Linear(1024,128),nn.ReLU(),nn.Dropout(.1),nn.Linear(128,len(labels)))
 def forward(self,x):return self.layers(x)
if __name__=='__main__':
 out=root/f'.cache/models-{args.version}';out.mkdir(parents=True,exist_ok=True)
 cache=root/f'.cache/glyphs-{args.version}.npz'
 if cache.exists():
  a=np.load(cache);x=torch.tensor(a['x'],dtype=torch.float32);y=torch.tensor(a['y'])
 else:
  print('Generating 48000 synthetic glyphs including low-resolution corners',flush=True)
  x=[];y=[]
  for i in range(len(labels)):
   for j in range(2400):x.append(render(i));y.append(i)
  x=torch.tensor(np.array(x)[:,None]);y=torch.tensor(y);cache.parent.mkdir(exist_ok=True);np.savez_compressed(cache,x=x.numpy(),y=y.numpy())
 order=torch.randperm(len(y));train=order[:-4000];val=order[-4000:]
 device='cuda' if torch.cuda.is_available() else 'cpu';torch.set_num_threads(4);net=Net().to(device);opt=torch.optim.Adam(net.parameters(),lr=.001)
 best_acc=0;best_state=None
 for epoch in range(35):
  net.train();idx=train[torch.randperm(len(train))];losses=[]
  for batch in idx.split(256):
   opt.zero_grad();loss=nn.functional.cross_entropy(net(x[batch].to(device)),y[batch].to(device));loss.backward();opt.step();losses.append(loss.item())
  net.eval()
  with torch.no_grad():acc=(net(x[val].to(device)).argmax(1).cpu()==y[val]).float().mean().item()
  if acc>best_acc:best_acc=acc;best_state={k:v.detach().cpu().clone() for k,v in net.state_dict().items()}
  print(epoch+1,round(sum(losses)/len(losses),4),round(acc,4),flush=True)
 net.load_state_dict(best_state);acc=best_acc;net.cpu().eval();torch.onnx.export(net,torch.zeros(1,1,32,32),str(out/'glyphs.onnx'),input_names=['image'],output_names=['logits'],dynamic_axes={'image':{0:'batch'},'logits':{0:'batch'}},opset_version=17)
 (out/'glyphs.json').write_text(json.dumps({'labels':labels,'size':32,'seed':418,'max_angle':args.max_angle,'training':'synthetic system fonts only; no supplied screenshots','train':len(train),'validation':len(val),'validation_accuracy':acc,'fonts':[p.name for p in fonts]},indent=2),encoding='utf8')
 print('Saved model',flush=True)
