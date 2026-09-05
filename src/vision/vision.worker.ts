import * as ort from 'onnxruntime-web/wasm';
import {SEATS,SUITS,type Card,type Seat,type Suit} from '../core/types';
import {boardFromHands,sortCards} from '../core/cards';
import type {Candidate,Recognition} from './recognize';
interface Component{x:number;y:number;w:number;h:number;pixels:number[];label?:string;confidence?:number;rotation?:number}
const labels=[...'23456789TJQKA','10','S','H','D','C'];
function components(data:ImageData):Component[]{const {width:w,height:h}=data;const a=data.data,mask=new Uint8Array(w*h),seen=new Uint8Array(w*h);for(let i=0;i<w*h;i++){const r=a[i*4],g=a[i*4+1],b=a[i*4+2];mask[i]=r+g+b<420||r>100&&r>g*1.45&&r>b*1.35?1:0;}const result:Component[]=[];const queue=new Int32Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const pos=y*w+x;if(!mask[pos]||seen[pos])continue;let head=0,tail=1;queue[0]=pos;seen[pos]=1;let minX=x,maxX=x,minY=y,maxY=y;while(head<tail){const p=queue[head++],px=p%w,py=Math.floor(p/w);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);for(const d of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]){const n=p+d;if(n>=0&&n<w*h&&!seen[n]&&mask[n]&&Math.abs(n%w-px)<=1){seen[n]=1;queue[tail++]=n;}}}const cw=maxX-minX+1,ch=maxY-minY+1;
 if(tail>=12&&cw>=3&&ch>=7&&cw<=w*.075&&ch<=w*.075&&cw*ch<6000)result.push({x:minX,y:minY,w:cw,h:ch,pixels:Array.from(queue.subarray(0,tail))});}
 return result;
}
function tensorOf(c:Component,w:number,rot=0){const buf=new Float32Array(32*32);const cw=rot%180?c.h:c.w,ch=rot%180?c.w:c.h,scale=26/Math.max(cw,ch),ox=(32-cw*scale)/2,oy=(32-ch*scale)/2;for(const p of c.pixels){let x=p%w-c.x,y=Math.floor(p/w)-c.y;if(rot===90)[x,y]=[c.h-1-y,x];if(rot===180)[x,y]=[c.w-1-x,c.h-1-y];if(rot===270)[x,y]=[y,c.w-1-x];const xx=Math.floor(ox+x*scale),yy=Math.floor(oy+y*scale);if(xx>=0&&xx<32&&yy>=0&&yy<32)buf[yy*32+xx]=1;}return buf;}
function inverseVector(x:number,y:number,rot:number):[number,number]{if(rot===90)return [y,-x];if(rot===180)return [-x,-y];if(rot===270)return [-y,x];return [x,y];}
async function run(bitmap:ImageBitmap):Promise<Recognition>{const scale=Math.min(1,1280/bitmap.width),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale),canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0,w,h);bitmap.close();const data=ctx.getImageData(0,0,w,h);const white=Array.from({length:20},(_,i)=>{const p=(Math.floor(h*.35)+i)*w+Math.floor(w*.5);return data.data[p*4]+data.data[p*4+1]+data.data[p*4+2]>650;}).filter(Boolean).length>15;self.postMessage({progress:15});const comps=components(data);
 // Merge disconnected 10 glyphs; retain original components so the model can select the better match.
 const merged:Component[]=[];for(const a of comps)for(const b of comps){if(a===b)continue;const gap=b.x-a.x-a.w;if(gap>=0&&gap<a.h*.35&&Math.abs(a.y-b.y)<a.h*.2&&Math.abs(a.h-b.h)<a.h*.25&&a.w<a.h*.65&&b.w<b.h*.9){merged.push({x:a.x,y:Math.min(a.y,b.y),w:b.x+b.w-a.x,h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y),pixels:[...a.pixels,...b.pixels]});}}
 comps.push(...merged);ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths='/models/';const session=await ort.InferenceSession.create('/models/glyphs.onnx',{executionProviders:['wasm']});const all:Component[]=[];
 for(const rot of (white?[0]:[0,90,180,270])){const input=new Float32Array(comps.length*1024);comps.forEach((c,i)=>input.set(tensorOf(c,w,rot),i*1024));const output=await session.run({image:new ort.Tensor('float32',input,[comps.length,1,32,32])});const logits=output.logits.data as Float32Array;comps.forEach((c,i)=>{const row=Array.from(logits.slice(i*labels.length,(i+1)*labels.length)),max=Math.max(...row),exps=row.map(v=>Math.exp(v-max)),sum=exps.reduce((a,b)=>a+b,0),index=row.indexOf(max);all.push({...c,label:labels[index],confidence:1/sum,rotation:rot});});self.postMessage({progress:25+rot/6});}
 const candidates:Candidate[]=[];
 function zone(x:number,y:number):Seat|null{if(y<h*.29&&x>w*.14&&x<w*.87)return 'N';if(y>h*.70)return 'S';if(y>h*.3&&y<h*.7&&x<w*.22)return 'W';if(y>h*.26&&y<h*.7&&x>w*.77)return 'E';return null;}
 if(white){
  // Text hand diagrams: use symbol-row anchors; rows can contain multi-digit tens.
  const symbols=all.filter(c=>SUITS.includes(c.label as Suit)&&c.confidence!>.65);
  for(const anchor of symbols){const s=zone(anchor.x,anchor.y);if(!s)continue;const row=all.filter(c=>!SUITS.includes(c.label as Suit)&&c.confidence!>.55&&c.x>anchor.x+anchor.w*.8&&c.x<anchor.x+w*.31&&Math.abs(c.y+c.h/2-anchor.y-anchor.h/2)<anchor.h*.45&&c.h>anchor.h*.55&&c.h<anchor.h*1.5).sort((a,b)=>a.x-b.x);let end=-1;for(const c of row.sort((a,b)=>a.x-b.x||b.w-a.w)){if(c.x<end)continue;end=c.x+c.w;const rank=c.label==='10'?'T':c.label!;candidates.push({seat:s,card:`${anchor.label}${rank}` as Card,confidence:Math.min(c.confidence!,anchor.confidence!),box:[c.x/w,c.y/h,c.w/w,c.h/h]});}}
 }else{
  for(const r of all){if(SUITS.includes(r.label as Suit)||r.confidence!<.7)continue;const seat=zone(r.x+r.w/2,r.y+r.h/2);if(!seat)continue;
   // One corner per card: discard lower mirrored indices and unrelated central artwork.
   if(seat==='N'&&r.y>h*.145)continue;
   if(seat==='S'&&r.y<h*.73)continue;
   const rv= r.rotation!;const possible=all.filter(c=>c.rotation===rv&&SUITS.includes(c.label as Suit)&&c.confidence!>.7).map(c=>{const dx=c.x+c.w/2-r.x-r.w/2,dy=c.y+c.h/2-r.y-r.h/2;const [xx,yy]=inverseVector(dx,dy,(360-rv)%360);const size=Math.max(r.w,r.h);return {c,xx,yy,size};}).filter(({xx,yy,size,c})=>yy>size*.25&&yy<size*2.1&&Math.abs(xx)<size*.85&&Math.max(c.w,c.h)<size*1.6).sort((a,b)=>Math.hypot(a.xx,a.yy)-Math.hypot(b.xx,b.yy));
   if(possible.length){const c=possible[0].c;candidates.push({seat,card:`${c.label}${r.label==='10'?'T':r.label}` as Card,confidence:Math.min(c.confidence!,r.confidence!),box:[r.x/w,r.y/h,r.w/w,r.h/h]});}
  }
 }
 // Keep the strongest interpretation of an index region. Do not infer missing cards.
 const selected:Candidate[]=[];for(const c of candidates.sort((a,b)=>b.confidence-a.confidence)){if(selected.some(x=>Math.abs(x.box[0]-c.box[0])<.015&&Math.abs(x.box[1]-c.box[1])<.01))continue;if(selected.some(x=>x.card===c.card&&x.seat===c.seat))continue;selected.push(c);}
 const board=boardFromHands(['?','?','?','?'],'图片识牌 · 待核对');for(const s of SEATS){const cards=selected.filter(c=>c.seat===s).map(c=>c.card);board.position.hands[s]=cards.length?sortCards(cards):null;}
 const warnings=['按画面上下左右暂标 N/S/W/E；实际方位可能旋转，请核对','定约、当前墩及低置信度牌张需确认后分析'];
 if(SEATS.some(s=>(board.position.hands[s]?.length??0)!==13))warnings.push('存在缺失或未知手牌，不会自动凑满 52 张');
 self.postMessage({progress:100});await session.release();return {board,candidates:selected,warnings,layout:white?'text':'cards'};
}
self.onmessage=async({data})=>{try{self.postMessage({result:await run(data.bitmap)});}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}};
