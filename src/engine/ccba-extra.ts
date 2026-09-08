import {SUITS,type Constraint} from '../core/types';

type Rule={patch:Omit<Constraint,'seat'>;description:string;section:string};
const r=(description:string,section:string,patch:Rule['patch']={}):Rule=>({description,section,patch});
const points=(minHcp:number,maxHcp=37)=>({minHcp,maxHcp});
const len=(s:string,min:number,max=13)=>({lengths:{[s]:[min,max] as [number,number]}});
const major=(s:string)=>s==='H'||s==='S';
const other=(s:string)=>s==='H'?'S':'H';
const both=(a:string,b:string,n=5)=>({lengths:{[a]:[n,13] as [number,number],[b]:[n,13] as [number,number]}});
const rank=(b:string)=>Number(b[0])*5+['C','D','H','S','NT'].indexOf(b.slice(1));
const isSuit=(b:string)=>/^[1-7][CDHS]$/.test(b);
const minimum=(previous:string,s:string)=>Number(previous[0])+Number(rank(`${previous[0]}${s}`)<=rank(previous));

/** Explicit continuation families from the official v2.2 main text. */
export function extraUncontested(p:string[],passed:boolean):Rule|undefined{
 const [o,a,b,c,d]=p,s=o.slice(1),last=p.at(-1)!;
 // Strong-two NT rebids use the same conventions as a 2NT opening, not a
 // second artificial 2C opening. Strength remains on the original opener.
 if(o==='2C'&&a==='2D'&&b==='2NT'&&p.length>=4)return extraUncontested(['2NT',...p.slice(3)],false);
 if(p.length===2){
  if(o==='1NT'&&(a==='3C'||a==='3D'))return r('单低花套邀请 3NT，不是转移叫','3.1');
  if(o==='1NT'&&a==='4S')return r('65 以上双低花；10–14 调整点不作为 HCP','3.1',{...both('C','D'),expression:'c 6+ OR d 6+'});
  if(passed&&/^1[HS]$/.test(o)){
   if(a==='2NT')return r('已不叫方四张以上支持、至少两控制的邀请，不是杰可贝逼局','2.7',len(s,4));
   if((a==='3D'||a==='3H')&&a[1]!==s)return r('已不叫方配合显示叫：9–11 点，四张将牌和四张所叫套','2.7',{...points(9,11),...both(s,a[1],4)});
   if(a===`3${s}`||a===`4${s}`)return r('已不叫方阻击/进攻型加叫，四张以上将牌','2.7',len(s,4));
  }
  if(/^2[DHS]$/.test(o)){
   if(a==='2NT')return r('奥古斯特：询问高低限与套质量，不表示无将牌型','5.1');
   if(a===`3${s}`)return r('加深阻击；不把阻击加叫当作邀请','5.1');
   if(isSuit(a)&&a[1]!==s){if(major(a[1])&&Number(a[0])>minimum(o,a[1])&&a[0]==='3')return r('跳叫新高花：六张以上好套，邀请','5.1',len(a[1],6));return r('新花自然逼叫一轮；成局高花为止叫','5.1');}
   if(a==='3NT')return r('自然进局止叫','5.1');
  }
  if(o==='3NT'){
   if(['4C','5C','6C'].includes(a))return r('赌博性无将后低花示选，要求不叫或修正，不保证梅花','8');
   if(a==='4D')return r('已知同伴低花套，询问单缺，不表示方片','8');
   if(a==='4NT')return r('赌博性无将后邀请满贯，不是关键张问叫','8');
   if(a==='4H'||a==='4S')return r('自然高花成局止叫','8');
  }
  if(o==='2NT'&&a==='4S')return r('65 双低花选局；调整点不换算成 HCP','6.1',{...both('C','D'),expression:'c 6+ OR d 6+'});
 }
 if(p.length===3){
  if(o==='1C'&&a==='1D'){
   if(b==='2H'||b==='2S')return r('Walsh 后跳新高花：18+ 点，允许非均型三张高花','1.2',{...points(18),...len(b[1],3)});
   if(b==='3H'||b==='3S')return r('Walsh 后方片支持的 Splinter：18+ 点、所叫高花单缺','1.2',{...points(18),lengths:{D:[4,13],[b[1]]:[0,1]}});
  }
  if(/^1[HS]$/.test(o)&&a==='2NT'&&!passed){
   if(/^4[CDHS]$/.test(b)&&b[1]!==s)return r('杰可贝后跳新花：五张以上 KQ 领头实套','2.5',{...len(b[1],5),expression:`${b[1]} KQ`});
   if(b===`4${s}`)return r('杰可贝后直接进局：低限，无单缺，最多三控制','2.5',{lengths:{C:[2,13],D:[2,13],H:[2,13],S:[2,13]},expression:'controls 0-3'});
  }
  if(/^1[HS]$/.test(o)&&a==='1NT'&&!passed){
   if(b==='3C'||b==='3D')return r('跳新低花逼局，通常 18+，长高花可降低点力；允许三张第二套','2.3',len(b[1],3));
   if(o==='1S'&&b==='3H')return r('18+ 点、54 以上双高，逼局','2.3',{...points(18),...len('H',4)});
   if(o==='1H'&&b==='3S')return r('15+ 点、65 双高，逼局','2.3',{...points(15),lengths:{H:[6,13],S:[5,13]}});
   if(b==='4C'||b==='4D')return r('15+ 点，66 双套，逼局','2.3',{...points(15),...both(s,b[1],6)});
   if(o==='1S'&&b==='4H')return r('16+ 的 65 双高，或 18+ 的 55 双高','2.3',{...points(16),...both('H','S'),expression:'(hcp 16+ AND s 6+) OR hcp 18+'});
   if(b==='3NT')return r('六张以上坚固原高花，边花无单缺','2.3',{...len(s,6),expression:`${s} AKQ, ${SUITS.filter(x=>x!==s).map(x=>`${x} 2+`).join(', ')}`});
  }
  if(/^1[HS]$/.test(o)&&!passed&&['2C','2D',...(o==='1S'?['2H']:[])].includes(a)){
   if(b===`3${a[1]}`)return r('二盖一后支持：四张，或额外实力的三张大牌支持','2.4',len(a[1],3));
   if(b===`4${s}`)return r('二盖一后直接进局：低限、七张以上原高花','2.4',len(s,7));
   if(isSuit(b)&&b[1]!==s&&b[1]!==a[1]){
    if(Number(b[0])>minimum(a,b[1]))return r('二盖一后跳新花 Splinter：四张应叫套支持、所叫单缺','2.4',{lengths:{[a[1]]:[4,13],[b[1]]:[0,1]}});
    return r('二盖一后自然第二套，三阶需额外实力或长度','2.4',len(b[1],4));
   }
  }
  if(/^1[HS]$/.test(o)&&a===`2${s}`){
   if(o==='1S'&&b==='4H')return r('16+ 点，五张以上红心，选局','2.6',{...points(16),...len('H',5)});
   if((b==='4C'||b==='4D'||o==='1H'&&b==='3S'))return r('跳单缺：19+ 点，试探满贯','2.6',{...points(19),...len(b[1],0,1)});
   if(isSuit(b)&&b[1]!==s)return r('帮张邀请或长套满贯试探，不把帮张叫当四张新套','2.6',len(b[1],3));
   if(b===`3${s}`||b===`4${s}`)return r('原将牌邀请 / 成局止叫','2.6');
  }
  if(/^2[DHS]$/.test(o)&&a==='2NT'){
   if(['3C','3D','3H','3S'].includes(b))return r(`奥古斯特：${['3C','3D'].includes(b)?'低限':'高限'}，${['3D','3S'].includes(b)?'好套':'弱套'}；原文未给出硬分界点数`,'5.1');
   if(b==='3NT')return r('奥古斯特：原套坚固，AKQ 领头','5.1',{expression:`${s} AKQ`});
  }
  if(/^1[CD]$/.test(o)&&a==='1NT'){
   if(b===`2${s}`)return r('原低花五张好套或六张以上，非均型','1.4',len(s,5));
   if(o==='1D'&&b==='2C')return r('自然第二套','1.4',len('C',4));
   if(/^2[HS]$/.test(b))return r('逆叫 16+；18+ 非均型允许三张第二套','1.4',{...points(16),...len(b[1],3)});
   if(b==='2NT')return r('邀请：16–17 非均型，或 15–16 均型六张原低花','1.4',{...points(15,17),expression:`hcp 16-17 OR (hcp 15-16 AND ${s} 6 AND balanced)`});
   if(b===`3${s}`)return r('15–17 点，六张以上好套','1.4',{...points(15,17),...len(s,6)});
   if(o==='1D'&&b==='3C')return r('18+ 点，54 非均型，逼局','1.4',{...points(18),lengths:{D:[5,13],C:[4,13]}});
   if(isSuit(b)&&b[0]==='3'&&b[1]!==s)return r('16+ 点，65 双套，逼叫一轮','1.4',{...points(16),lengths:{[s]:[6,13],[b[1]]:[5,13]}});
   if(b==='3NT')return r('18+ 均型或 16+ 六张坚固套无单缺','1.4',points(16));
  }
  if(o==='1D'&&a==='2C'){
   if(b==='2D')return r('二盖一后方片五张以上','1.5',len('D',5));
   if(b==='2H'||b==='2S')return r('五张方片、四张所叫高花','1.5',{lengths:{D:[5,13],[b[1]]:[4,13]}});
   if(b==='2NT')return r('12–14 或 18–19 均型；不接受中间的 15–17 点','1.5',{expression:'balanced, hcp 12-14 OR hcp 18-19'});
   if(b==='3C')return r('四张支持或 14+ 三张带大牌支持；取共同三张下限','1.5',len('C',3));
   if(b==='3D')return r('15+ 点，六张以上好方片','1.5',{...points(15),...len('D',6)});
   if(b==='3H'||b==='3S')return r('14+ 点，四张以上梅花支持，所叫高花单缺','1.5',{...points(14),lengths:{C:[4,13],[b[1]]:[0,1]}});
  }
  if(/^1[CD]$/.test(o)&&a===`2${s}`){
   if(b==='2NT')return r('反加叫后 12–14 或 18–19 均型，逼叫','1.6',{expression:'balanced, hcp 12-14 OR hcp 18-19'});
   if(b==='2H'||b==='2S')return r('自然四张高花，通常五张低花，保留 4441 分支','1.6',len(b[1],4));
   if(o==='1D'&&b==='3C')return r('自然第二套','1.6',len('C',4));
   if(b===`3${s}`)return r('低限；含低限均型弱双张分支，不硬设五张','1.6');
   if(isSuit(b)&&b[1]!==s&&Number(b[0])>minimum(a,b[1]))return r('反加叫后跳叫新花：中高限、所叫单缺','1.6',len(b[1],0,1));
  }
  if(/^1[CD]$/.test(o)&&/^2[DHS]$/.test(a)&&a[1]!==s&&!(o==='1D'&&a==='2C')&&b==='2NT')return r('弱跳应叫后询问短门，不是自然无将','1.7');
  if(o==='2C'&&a==='2D'&&/^3[HS]$/.test(b))return r('22+ 点，四张所叫高花、五张以上方片，逼局','4.2',{...points(22),lengths:{D:[5,13],[b[1]]:[4,4]}});
  if(o==='2C'&&a==='2NT'){
   if(b==='3C')return r('问牌型，或梅花实套逼局，不硬推梅花长度','4.3');
   if(b==='3NT')return r('22–23 点均型，无四张高花','4.3',{...points(22,23),lengths:{H:[0,3],S:[0,3]},expression:'balanced'});
   if(b==='4C')return r('六张以上好梅花，确定将牌','4.3',len('C',6));
   if(/^3[DHS]$/.test(b))return r('自然出套，逼局','4.3');
  }
  if(o==='2NT'&&['3D','3H'].includes(a)){
   const target=a==='3D'?'H':'S';
   if(b==='3NT')return r('目标高花两小，六张好低花','6.3',{...len(target,2,2),expression:`no ${target} AKQJ, c 6 OR d 6`});
   if(isSuit(b)&&b[1]!==target)return r('新花超转移：四张目标高花支持，所叫有大牌控制','6.3',len(target,4));
  }
  if(o==='2NT'&&a==='3S'){
   if(b==='3NT')return r('低花斯台曼后无合适低花；允许高花双止且四张低花例外','6.4');
   if(b==='4C'||b==='4D')return r('低花斯台曼答叫：四张以上所叫低花','6.4',len(b[1],4));
  }
  if(o==='3NT'&&a==='4D'){
   if(b==='4H'||b==='4S')return r('赌博性无将答问：所叫高花单张','8',len(b[1],1,1));
   if(b==='4NT')return r('赌博性无将答问：7222，无单缺','8',{expression:'shape 7222'});
   if(b==='5C'||b==='5D')return r('赌博性无将答问：自然长低花，另一低花单缺','8',{lengths:{[b[1]]:[7,8],[b==='5C'?'D':'C']:[0,1]}});
  }
  if(passed&&/^1[HS]$/.test(o)&&a==='2C'){
   if(b==='2D')return r('逆朱瑞后正常开叫但不足进局，方片人工','2.7',points(11));
   if(o==='1S'&&b==='2H')return r('逆朱瑞后第二红心套，不保证开叫实力','2.7',len('H',4));
   if(b===`2${s}`)return r('逆朱瑞后低限/轻开，止叫','2.7');
  }
 }
 if(p.length===4){
  if(/^1[CD]$/.test(o)&&a==='1H'&&b==='1S'){
   if(c===(o==='1C'?'2D':'2C'))return r('第四花色人工逼局，不表示该低花实套','1.3');
   if(c===`2${s}`)return r('弱牌支持原低花','1.3',len(s,3));
   if(c==='2H')return r('六张红心弱再叫','1.3',len('H',6));
   if(c==='2S')return r('7–9 点，四张黑桃支持','1.3',{...points(7,9),...len('S',4,4)});
   if(c==='2NT')return r('11–12 点自然邀请','1.3',points(11,12));
  }
  if(o==='1C'&&a==='1D'&&(b==='1H'||b==='1S')){
   if(c===(b==='1H'?'1S':'2H'))return r('Walsh 后第四花色人工逼局，不是自然高花','1.2');
   if(c==='1NT')return r('Walsh 后自然无将：8–10 点','1.2',points(8,10));
   if(c==='2C')return r('三张以上梅花弱止叫','1.2',len('C',3));
   if(c==='2D')return r('六张以上方片弱止叫','1.2',len('D',6));
   if(c===`2${b[1]}`)return r('8–10 点、三张高花支持','1.2',{...points(8,10),...len(b[1],3,3)});
  }
  if(o==='1D'&&/^1[HS]$/.test(a)&&b==='2C'){
   if(c===`2${other(a[1])}`)return r('第四花色人工逼局，不表示另一高花长度','1.3');
   if(c===`2${a[1]}`)return r('六张以上原高花弱止叫','1.3',len(a[1],6));
   if(c==='3C'||c==='3D')return r('8–11 点、四张以上低花支持','1.3',{...points(8,11),...len(c[1],4)});
   if(c==='3NT')return r('13–16 点均型、四张应叫高花','1.3',{...points(13,16),...len(a[1],4,4),expression:'balanced'});
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b===`2${s}`){
   if(o==='1C'&&c==='2D'||o==='1D'&&a==='1S'&&c==='2H')return r('重叫低花后的人工新花逼局，不表示所叫花色长度','1.3');
   if(c===`2${a[1]}`)return r('六张原应叫高花，非逼叫','1.3',len(a[1],6));
   if(c===`3${s}`)return r('三张以上原低花支持、四至五张应叫高花','1.3',{lengths:{[s]:[3,13],[a[1]]:[4,5]}});
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b===`2${a[1]}`){
   if(c==='2NT')return r('简单支持后询问牌型，至少邀请，不是自然均型','1.3');
   if(c===`3${a[1]}`)return r('五张应叫高花，邀请','1.3',len(a[1],5));
  }
  if(o==='1NT'&&a==='2S'&&b==='3C'){
   if(c==='P'||c==='3D')return r('低花迫转后六张以上单低花弱止叫','3.4',len(c==='P'?'C':'D',6));
   if(c==='3H'||c==='3S')return r('低花迫转后 55 双低花，所叫高花单缺，逼局','3.4',{...both('C','D'),lengths:{C:[5,13],D:[5,13],[c[1]]:[0,1]}});
   if(c==='3NT'||c==='4NT')return r('54 双低花无单缺；3NT 温和满贯兴趣 / 4NT 示量','3.4',{...points(c==='3NT'?14:16,c==='3NT'?15:17),lengths:{C:[4,5],D:[4,5],H:[2,2],S:[2,2]}});
  }
  if(o==='1NT'&&a==='2C'){
   if(c==='P')return r('斯台曼后弱三套型，7 点以下、短梅花','3.2',{...points(0,7),...len('C',0,1)});
   if(b==='2D'&&(c==='4D'||c==='4H'))return r('斯台曼后德克萨斯：64 高花，转移至对应高花','3.2',{lengths:{[c==='4D'?'H':'S']:[6,6],[c==='4D'?'S':'H']:[4,4]}});
   if(c==='2NT')return r('斯台曼后邀请，四张高花','3.2',{expression:'h 4 OR s 4'});
   if(b==='2H'||b==='2S'){
    if(b==='2H'&&c==='2S')return r('四张黑桃邀请','3.2',len('S',4,4));
    if(c===`3${other(b[1])}`)return r('高花配合的满贯兴趣，不表示所叫高花长度','3.2',len(b[1],4));
    if(c==='3NT')return r('答叫高花不配合，另一门四张高花','3.2',{lengths:{[other(b[1])]:[4,4],[b[1]]:[0,3]}});
    if(c==='4C'||c==='4D'||b==='2S'&&c==='4H')return r('高花配合的 Splinter，所叫单缺','3.2',{lengths:{[b[1]]:[4,13],[c[1]]:[0,1]}});
    if(c===`4${b[1]}`)return r('高花配合进局止叫','3.2',len(b[1],4));
    if(c==='3C'||c==='3D')return r('五张以上低花逼局','3.2',len(c[1],5));
   }
  }
  if(o==='1NT'&&['2D','2H'].includes(a)&&b===(a==='2D'?'2H':'2S')){
   if(c==='3C'||c==='3D')return r('转移后自然第二低花，逼局','3.3',len(c[1],4));
   if(c==='4C'||c==='4D'||a==='2D'&&c==='3S'||a==='2H'&&c==='4H')return r('转移后跳单缺：11–14 点，所叫短门；通常六张目标高花不硬限定','3.3',{...points(11,14),...len(c[1],0,1)});
  }
  if(/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)&&b==='1NT'){
   if(o==='1C'&&a==='1D'&&(c==='3H'||c==='3S'))return r('Walsh 后 54 双低，所叫高花单张、另一高花三张，满贯兴趣','1.2',{lengths:{D:[5,5],C:[4,4],[c[1]]:[1,1],[other(c[1])]:[3,3]}});
   if(c==='2NT')return o==='1C'&&a==='1D'?r('Walsh 后 54 双低花邀请','1.2',{lengths:{D:[5,13],C:[4,13]}}):r('双路重询体系的 2NT：迫转 3C，不是自然邀请','1.3 / 2.2');
   if(o==='1C'&&a==='1D'&&/^2[HS]$/.test(c))return r('Walsh 后五张方片、四张高花，逼局','1.2',{lengths:{D:[5,13],[c[1]]:[4,13]}});
   if(/^3[CDHS]$/.test(c)&&c[1]!==a[1])return r('双路重询体系：55 双套逼局','1.3 / 2.2',both(a[1],c[1]));
   if(c===`3${a[1]}`)return r('原应叫套六张以上，逼局','1.3 / 2.2',len(a[1],6));
   if(major(a[1])&&/^2[HS]$/.test(c)&&c[1]!==a[1])return r('自然第二高花，顺叫弱牌 / 逆叫逼局','1.3',len(c[1],4));
  }
  if(/^1[HS]$/.test(o)&&a==='1NT'&&!passed&&/^2[CDH]$/.test(b)&&b[1]!==s){
   if(c===`2${s}`)return r('示弱示选：两张支持 6–10，或三张支持 7 点以下','2.3',{...points(0,10),...len(s,2,3),expression:`(${s} 2 AND hcp 6-10) OR (${s} 3 AND hcp 0-7)`});
   if(c===`3${s}`)return r('10–12 点、三张原高花支持，邀请','2.3',{...points(10,12),...len(s,3,3)});
   if(o==='1H'&&c==='2S')return r('人工邀请：10–12 点，四张以上第二低花支持，不表示黑桃','2.3',{...points(10,12),...len(b[1],4)});
   if(o==='1H'&&c==='3S')return r('10–12 点，六张以上第二低花支持，黑桃单缺','2.3',{...points(10,12),lengths:{[b[1]]:[6,13],S:[0,1]}});
   if(c===`3${b[1]}`)return r('第二套加叫，低花五张以上；红心支持四张以上','2.3',len(b[1],b[1]==='H'?4:5));
   if(c==='2NT')return r('自然邀请，不强套均型','2.3');
   if(c==='3C'||c==='3D'||c==='3H')return r('自然六张以上套，止叫或邀请','2.3',len(c[1],6));
   if(o==='1S'&&c==='2H')return r('自然红心：六张 5–9 点或五张好套 9–11 点，无三张黑桃','2.3',{...points(5,11),lengths:{H:[5,13],S:[0,2]},expression:'(h 6+ AND hcp 5-9) OR (h 5 AND hcp 9-11)'});
  }
  if(/^1[HS]$/.test(o)&&a==='1NT'&&b===`2${s}`&&o==='1H'&&c==='2S')return r('重叫高花后的人工 2S：55 双低花','2.3',both('C','D'));
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b==='2NT'){
   if(c==='3C')return r('等待：可能五张原高花、四张另一高花或低花满贯兴趣，不表示梅花','1.3');
   if(c==='3D')return r('五张以上方片、四张原高花，温和满贯兴趣','1.3',{lengths:{D:[5,13],[a[1]]:[4,13]}});
   if(c===`3${a[1]}`)return r('原高花六张以上，逼局','1.3',len(a[1],6));
   if(c===`3${other(a[1])}`)return r('再叫另一高花：先黑桃为 55，先红心为 44','1.3',both('H','S',a==='1S'?5:4));
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&/^2[DHS]$/.test(b)&&b[1]!==a[1]&&rank(b)>rank(`2${s}`)){
   if(c===`2${a[1]}`)return r('逆叫后弱再叫：5–7 点，五张好套或六张以上','1.3',{...points(5,7),...len(a[1],5)});
   if(c===`3${a[1]}`)return r('逆叫后原高花六张以上好套，逼局','1.3',len(a[1],6));
   if(c===`3${s}`||c===`3${b[1]}`)return r('逆叫后支持：8+ 点，低花原套三张或第二套四张','1.3',{...points(8),...len(c[1],c[1]===s?3:4)});
   if(c==='2NT')return r(b==='2D'?'8+ 点，有第四花色止张，逼局':'逼叫一轮，可能弱牌或 8+ 均型，不设统一点力下限','1.3',b==='2D'?points(8):{});
   if(isSuit(c)&&![s,a[1],b[1]].includes(c[1]))return r('第四花色人工叫，不表示该花色长度；弱牌或逼局分支依进程','1.3');
  }
  if(o==='2C'&&a==='2D'&&((/^2[HS]$/.test(b)&&c==='3C')||(b==='3C'&&c==='3D')))return r('二度示弱，不表示所叫低花；原文未给出统一硬点数','4.2');
  if(o==='2NT'&&a==='3C'&&b==='3D'){
   if(c==='4C')return r('询问低花，承诺 44 以上低花','6.2',both('C','D',4));
   if(c==='4D')return r('44 以上双高花选局，不是方片套','6.2',both('H','S',4));
   if(c==='4H'||c==='4S')return r('满贯兴趣，六张对应低花，不是自然高花','6.2',len(c==='4H'?'C':'D',6));
   if(c==='4NT')return r('傀儡斯台曼后示量邀请，不是关键张问叫','6.2');
  }
  if(o==='2NT'&&a==='3C'&&b==='3NT'&&(c==='4H'||c==='4S'))return r(c==='4H'?'六黑桃四红心，转移至 4S':'六黑桃四红心，温和满贯兴趣','6.2',{lengths:{S:[6,6],H:[4,4]}});
  if(o==='2NT'&&['3D','3H'].includes(a)&&b===(a==='3D'?'3H':'3S')){
   if(c==='4NT')return r('转移后示量邀请，不是关键张问叫','6.3');
   if(c===`4${b[1]}`)return r('转移后六张以上高花，温和满贯兴趣','6.3',len(b[1],6));
   if(c==='3S'||c==='4H')return r('第二高花：先转红心为 54，先转黑桃为 55','6.3',len(c[1],c==='3S'?4:5));
   if(c==='4C'||c==='4D')return r('自然第二低花，逼局','6.3',len(c[1],4));
  }
  if(o==='2NT'&&a==='3S'&&b==='3NT'){
   if(c==='4C'||c==='4D')return r('低花斯台曼后五张所叫低花，满贯兴趣','6.4',len(c[1],5));
   if(c==='4H'||c==='4S')return r('低花双套，所叫高花单缺','6.4',len(c[1],0,1));
   if(c==='4NT')return r('示量邀请','6.4');
  }
 }
 if(p.length===5&&/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)&&b==='1NT'&&c==='2NT'&&d==='3C'&&!(o==='1C'&&a==='1D'))return r('完成迫转 3C，不保证梅花套','1.3 / 2.2');
 if(p.length===5&&/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b===`2${a[1]}`&&c==='2NT'){
  if(d===`3${s}`)return r('答问：低限四张高花支持、五张以上原低花','1.3',{lengths:{[s]:[5,13],[a[1]]:[4,4]}});
  if(d===`3${a[1]}`||d===`4${a[1]}`)return r('答问：四张高花支持，三阶低限、四阶高限','1.3',len(a[1],4,4));
  if(/^3[CDHS]$/.test(d))return r('答问：三张高花支持、四张所叫花色','1.3',{lengths:{[a[1]]:[3,3],[d[1]]:[4,4]}});
  if(/^4[CDHS]$/.test(d))return r('答问：高限四张高花支持、所叫单缺','1.3',{lengths:{[a[1]]:[4,4],[d[1]]:[0,1]}});
 }
 if(p.length===6&&/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)&&b==='1NT'){
  if(c==='2C'&&d==='2D'){
   if(last===`2${a[1]}`)return r('双路重询后五张原应叫套，邀请','1.3 / 2.2',len(a[1],5));
   if(last==='2NT')return r('双路重询后的自然均型邀请','1.3 / 2.2',{expression:'balanced'});
   if(last===`3${a[1]}`)return r('六张以上原应叫套，强邀请','1.3 / 2.2',len(a[1],6));
  }
  if(c==='2NT'&&d==='3C'&&last==='3D'&&!(o==='1C'&&a==='1D'))return r('迫转梅花后再叫方片：55 双套邀请','1.3 / 2.2',both(a[1],'C'));
 }
 if(p.length===5&&o==='2NT'&&a==='3C'&&b==='3D'){
  if(c==='3H'&&d==='3S')return r('四张黑桃支持','6.2',len('S',4,4));
  if(c==='3H'&&d==='3NT')return r('无四张黑桃，四张红心','6.2',{lengths:{H:[4,4],S:[0,3]}});
  if(c==='3S'&&d==='3NT')return r('无四张红心，四张黑桃','6.2',{lengths:{S:[4,4],H:[0,3]}});
  if(c==='3S'&&['4C','4D','4H'].includes(d))return r('四张红心支持；新低花为扣叫，不是长度','6.2',len('H',4,4));
  if(c==='4C'){
   if(d==='4D')return r('问低花答叫：无四张低花','6.2',{lengths:{C:[0,3],D:[0,3]}});
   if(d==='4H'||d==='4S')return r('问低花答叫：四张以上对应低花','6.2',len(d==='4H'?'C':'D',4));
  }
 }
 // Gerber applies only directly over natural NT, not arbitrary 4C cue bids.
 if(p.length===3&&['1NT','2NT'].includes(o)&&a==='4C'){
  const n=['4D','4H','4S','4NT'].indexOf(b);if(n>=0)return r('戈伯问 A：04 / 1 / 2 / 3','6.1',{expression:n===0?'aces 0 OR aces 4':`aces ${n}`});
 }
 return undefined;
}

/** Direct responder decisions after an opponent's intervention. */
export function competitiveResponse(o:string,enemy:string,a:string):Rule|undefined{
 const s=o.slice(1),e=enemy.slice(1),m=major(s),section=m?'2.8':'1.8';
 if(o==='2C'){
  if(enemy==='X'&&a==='XX')return r('强二被加倍后示强再加倍：7+ 点','4.4',points(7));
  if(/^2[DHS]$/.test(enemy)&&a==='X')return r('强二受干扰后的实力加倍，通常 5+ 点，至少一控制','4.4',{...points(5),expression:'cards SA HA DA CA SK HK DK CK 1+'});
  if(isSuit(a)&&a[1]!==e)return r('强二受干扰后自然出套：6+ 点，三阶需六张套；两大牌条件需核对','4.4',{...points(6),...(a[0]==='3'?len(a[1],6):{})});
  return undefined;
 }
 if(o==='1NT'){
  if(enemy==='X'){
   if(a==='XX')return r('逃叫，迫转 2C：五张梅花、4C+4X 或六张梅花强弱未知','3.7',len('C',4));
   if(['2C','2D','2H'].includes(a))return r('被惩罚加倍后的逃叫转移，不是自然所叫花色','3.7',len(({C:'D',D:'H',H:'S'} as Record<string,string>)[a[1]],5));
   if(a==='2NT')return r('7+ 点，任意 55 双套，逼局','3.7',{...points(7),expression:'(c 5+ AND d 5+) OR (c 5+ AND h 5+) OR (c 5+ AND s 5+) OR (d 5+ AND h 5+) OR (d 5+ AND s 5+) OR (h 5+ AND s 5+)'});
   if(/^3[CDHS]$/.test(a))return r('六至七张套，到位型阻击','3.7',len(a[1],6,7));
  }
  if(a==='4D'||a==='4H')return r('受干扰后的德克萨斯转移','3.7 / 3.8',len(a==='4D'?'H':'S',6));
  if(enemy==='2C'){
   if(a==='X')return r('至少邀请，可惩罚一门高花或准备出套逼局','3.8');
   if(a==='2D')return r('五张以上方片，不逼叫','3.8',len('D',5));
   if(a==='2H'||a==='2S')return r(a==='2H'?'55 双低花竞争':'55 双低花逼局','3.8',both('C','D'));
   if(a==='3H'||a==='3S')return r('所叫高花单缺，通常 54 低花，逼局','3.8',len(a[1],0,1));
   if(a==='3C'||a==='3D')return r('自然低花逼局','3.8',len(a[1],5));
  }
  if(/^2[DHS]$/.test(enemy)){
   if(a==='X')return r('技术性加倍，可竞争或逼局，不是统一惩罚加倍','3.8');
   if(isSuit(a)&&a[1]===e)return r('直接扣叫：敌花无止，至少一门四张高花','3.8',{expression:major(e)?`${other(e)} 4+`:'h 4+ OR s 4+'});
   if(/^2[CDHS]$/.test(a))return r('二阶自然新花，不逼叫，至多邀请','3.8',len(a[1],5));
   if(/^3[CDHS]$/.test(a))return r('三阶自然新花：9+ 点，五张以上，逼叫','3.8',{...points(9),...len(a[1],5)});
   if(a==='3NT')return r('直接 3NT：敌花无止，够进局；与经莱本索尔再叫区别','3.8');
  }
  if(/^2[CDHS]$/.test(enemy)&&a==='2NT')return r('莱本索尔，迫转 3C，不是自然无将','3.8');
  if(enemy==='2NT'){
   if(a==='3C')return r('对双低花：54 以上双高花逼局','3.8',{...both('H','S',4),expression:'h 5+ OR s 5+'});
   if(a==='3D'||a==='4C')return r(a==='3D'?'55 双高花邀请':'55 双高花逼局','3.8',both('H','S'));
   if(a==='X')return r('有实力，至少能惩罚一门低花','3.8');
   if(a==='3H'||a==='3S')return r('高花实套逼局','3.8',len(a[1],5));
   if(a==='3NT')return r('敌方低花有止，进局止叫','3.8');
  }
  return undefined;
 }
 if(!/^1[CDHS]$/.test(o))return undefined;
 if(enemy==='X'){
  if(a==='XX')return r('11+ 大牌点，准备惩罚，不保证支持','防守叫牌 5–6',points(11));
  if(a==='1NT')return m?r('好加叫：三张支持 9–差11，或四张支持 7–差10','防守叫牌 6',{...points(7,11),...len(s,3,4),expression:`(${s} 3 AND hcp 9-11) OR (${s} 4 AND hcp 7-10)`}):r('自然无将：正文 7–10 与防守总则 8–11 有差异，保留并集 7–11','1.8 / 防守叫牌 5',points(7,11));
  if(a==='2NT')return r('限制性加叫或更好；11+ 调整点不换算为 HCP','防守叫牌 5–6',len(s,m?4:5));
  if(a===`2${s}`)return m?r('弱加叫：三张 5–8 或四张 5–7','防守叫牌 6',{...points(5,8),...len(s,3,4),expression:`(${s} 3 AND hcp 5-8) OR (${s} 4 AND hcp 5-7)`}):r('6–9 点，四至五张支持','1.8',{...points(6,9),...len(s,4,5)});
  if(o==='1D'&&a==='2C')return r('被加倍后自然非逼叫：6–8 点，六张梅花','1.8',{...points(6,8),...len('C',6)});
  if(/^1[DHS]$/.test(a))return r('一阶自然新花，四张以上，逼叫一轮','防守叫牌 5–6',len(a[1],4));
  if(/^2[HS]$/.test(a)&&a[1]!==s)return r('弱跳新高花：4–7 点，六张以上','1.8 / 防守叫牌 6',{...points(4,7),...len(a[1],6)});
  if(/^3[HS]$/.test(a)&&a[1]!==s)return r('跳新高花：6–9 点，七张以上，止叫','1.8',{...points(6,9),...len(a[1],7)});
  if(isSuit(a)&&a[1]===s)return r('跳加叫，阻击或有局进攻型，不套用伯根','防守叫牌 5–6',len(s,m?4:5));
  return undefined;
 }
 if(enemy==='1NT'){
  if(a==='X')return r('10+ 大牌点，实力加倍','1.8 / 2.8',points(10));
  if(!m&&a==='2C')return r('对 1NT 的双高花反击，至少 54；局况差异保留共同范围','1.8',{...points(6,11),...both('H','S',4),expression:'h 5+ OR s 5+'});
  if(m&&(a==='2C'||a==='2D'))return r('六张以上低花，无三张开叫高花；局况点力取共同外包','2.8',{...points(6,10),lengths:{[a[1]]:[6,13],[s]:[0,2]}});
  if(m&&a===`2${s}`)return r('7–10 HCP，三张以上支持','2.8',{...points(7,10),...len(s,3)});
  if(m&&(a==='2NT'||a===`3${s}`))return r('四张以上支持，局况相关调整点不当作 HCP','2.8',len(s,4));
  if(!m&&/^2[DHS]$/.test(a))return r('6–10 点自然叫','1.8',points(6,10));
  return undefined;
 }
 if(enemy===`2${s}`){
  if(a==='X')return r('对迈克尔斯的实力加倍：可惩罚或均型逼局','1.8 / 2.8');
  if(a==='2NT')return r('自然邀请，不是杰可贝','1.8 / 2.8',m?{}:points(11,12));
  if(!m&&(a==='2H'||a==='2S')){
   const support=(s==='C'&&a==='2H')||(s==='D'&&a==='2S');
   return r(support?'低级扣叫：原低花配合邀请以上':'扣叫：另一低花逼局，不表示所叫高花','1.8',len(support?s:s==='C'?'D':'C',support?4:5));
  }
  if(m&&a===`${s==='H'?2:3}${other(s)}`)return r('扣叫另一高花：三张以上开叫高花支持，邀请以上','2.8',len(s,3));
  if(a===`3${s}`)return r('竞争性支持','1.8 / 2.8',len(s,m?3:4));
  if(m&&(a==='3C'||a==='3D'))return r('自然新低花，逼叫一轮','2.8',len(a[1],5));
  if(isSuit(a)&&major(a[1])&&Number(a[0])>minimum(enemy,a[1]))return r('跳扣高花显示单缺，开叫花色配合，逼局','1.8 / 2.8',{lengths:{[s]:[4,13],[a[1]]:[0,1]}});
  return undefined;
 }
 if(enemy==='2NT'){
  const mapping:Record<string,Record<string,string>>={C:{'3D':'S','3H':'C'},D:{'3C':'D','3H':'S'},H:{'3C':'H','3D':'S'},S:{'3C':'H','3D':'S'}};
  const target=mapping[s]?.[a];if(target)return r(target===s?'对特殊无将扣叫：原花支持，邀请以上':'对特殊无将扣叫：未叫高花逼局','1.8 / 2.8',len(target,target===s?(m?3:4):5));
  if(a==='X')return r('实力加倍，可惩罚或均型逼局','1.8 / 2.8');
  if(a===`3${s}`)return r('自然竞争性加叫','1.8 / 2.8',len(s,m?3:4));
  if(a===`3${m?other(s):'S'}`)return r('自然高花非逼叫，局况影响邀请含义','1.8 / 2.8',len(a[1],m?5:6));
  if(m&&(a==='4C'||a==='4D'))return r('跳扣低花：四张以上将牌、所叫单缺，逼局','2.8',{lengths:{[s]:[4,13],[a[1]]:[0,1]}});
  return undefined;
 }
 if(!isSuit(enemy))return undefined;
 const jump=Number(enemy[0])>minimum(o,e);
 if(a==='X')return r(m?(jump?'对阻击的消极/技术性加倍，牌型分支不合并成虚假长度':'消极加倍；不保证所叫敌花长度'):'6+ 点消极加倍，多种未叫高花分支',section,m?{}:points(6));
 if(a==='1NT')return r('7–10 点，敌花有止','1.8 / 2.8',points(7,10));
 if(a==='2NT')return r(m&&jump?'10–11 点自然邀请，有敌花止张':'自然邀请，有敌花止张；不是杰可贝支持',section,m&&jump?points(10,11):{});
 if(a==='3NT')return r('自然进局，敌花止张；高花开叫后的明确范围 12–15',section,m?points(12,15):{});
 if(o==='1C'&&enemy==='2D'&&a==='3D')return r('特殊扣叫：55 双高花邀请，不表示梅花支持','1.8',both('H','S'));
 if(isSuit(a)&&a[1]===e){
  const jumped=Number(a[0])>minimum(enemy,e);
  return r(jumped?'跳扣敌花：开叫花色配合，敌花单缺，逼局':'扣叫敌花：开叫花色配合，邀请以上；对阻击为逼局',section,{lengths:{[s]:[m?(jumped?4:3):4,13],...(!m?{H:[0,3] as [number,number],S:[0,3] as [number,number]}:{}),...(jumped?{[e]:[0,1] as [number,number]}:{})}});
 }
 if(isSuit(a)&&a[1]===s)return r('受干扰后自然支持，跳加叫为竞争/阻击；不套无干扰约定',section,len(s,m?(o==='1S'&&enemy==='2H'&&a==='2S'?2:3):4));
 if(isSuit(a)&&a[1]!==s){
  if(o==='1C'&&enemy==='1H'&&a==='1S')return r('自然一黑桃保证五张，不是无干扰的一盖一四张','1.8',len('S',5));
  if(Number(a[0])===minimum(enemy,a[1]))return r('受干扰后非跳新花自然，逼叫一轮',section,len(a[1],a[0]==='1'?4:5));
  if(Number(a[0])<4&&!jump)return r('弱跳新花，阻击性，不套用伯根或 Splinter',section,len(a[1],6));
 }
 return undefined;
}

/** Additional overcalls, independent of responder's system path. */
export function extraIntervention(o:string,a:string,balancing=false):Rule|undefined{
 if(/^1[CDHS]$/.test(o)&&a==='2NT'&&balancing)return r('平衡位置跳 2NT：19–20 点，不是特殊双套无将','附录：跳争叫',points(19,20));
 if(/^[12][CDHS]$/.test(o)&&a==='X')return r('技术性加倍：未叫花色有支持，或 16+ 强牌分支','附录：技术性加倍',{expression:`hcp 16+ OR (${SUITS.filter(s=>s!==o[1]).map(s=>`${s} 3+`).join(' AND ')})`});
 if(o==='1NT'&&a==='2NT')return r('特殊无将争叫：55 双低，12+ HCP；有局原文要求 14+，未提供局况时保留宽范围','3.9',{...points(12),...both('C','D')});
 if(o==='1NT'&&/^3[CDHS]$/.test(a))return r('对强无将三阶阻击：无局六张、有局七张，保留六张下限','3.9',len(a[1],6));
 if(/^1[CDHS]$/.test(o)&&a==='2NT'){
  const unbid=['C','D','H','S'].filter(s=>s!==o[1]);return r('特殊 2NT：最低两门未叫花色各五张，不是自然无将','防守叫牌 7',both(unbid[0],unbid[1]));
 }
 if(/^1[CDHS]$/.test(o)&&isSuit(a)&&a[1]===o[1]&&a[0]==='3')return r('跳扣叫寻求敌花止张，可能低花坚固套或高花赢墩型，不是敌花实套','附录：直接扣叫及跳扣叫');
 if(/^1[CDHS]$/.test(o)&&isSuit(a)&&a[1]!==o[1]&&Number(a[0])>minimum(o,a[1]))return r('自然跳争叫，阻击性；不硬套普通非跳争叫点力','附录：跳争叫',len(a[1],6));
 if(o==='2D'&&a==='4D')return r('跳迈克尔斯：17+ HCP，55 双高，逼局','防守叫牌 7',{...points(17),...both('H','S')});
 if(/^2[HS]$/.test(o)&&(a==='4C'||a==='4D'))return r('跳迈克尔斯：17+ HCP，五张所叫低花和五张另一高花','防守叫牌 7',{...points(17),...both(a[1],other(o[1]))});
 return undefined;
}

export function advanceOvercall(o:string,overcall:string,a:string):Rule|undefined{
 if(overcall==='X'&&/^1[CDHS]$/.test(o)){
  if(a==='1NT'||a==='2NT'||a==='3NT')return r('应叫技术性加倍：自然无将，6–9 / 10–11 / 12–15 点','附录：技术性加倍',a==='1NT'?points(6,9):a==='2NT'?points(10,11):points(12,15));
  if(isSuit(a)&&a[1]!==o[1]){
   const jump=Number(a[0])-minimum(o,a[1]);
   if(jump<=2)return r('应叫技术性加倍：非跳 0–7 / 跳一级 8–10 / 跳两级 10–11','附录：技术性加倍',{...points(jump===0?0:jump===1?8:10,jump===0?7:jump===1?10:11),...(jump===2?len(a[1],5):{})});
  }
 }
 if(o==='1NT'&&overcall==='2C'){
  if(a==='2D'||a==='2NT')return r('兰迪后问叫，不保证所叫低花或均型','3.9');
  if(a==='2H'||a==='2S')return r('兰迪后高花示选，不硬设支持张数','3.9');
  if(a==='3H'||a==='3S')return r('兰迪后四张以上高花支持，邀请','3.9',len(a[1],4));
 }
 if(!isSuit(overcall)||overcall[1]===o[1]||Number(overcall[0])!==minimum(o,overcall[1]))return undefined;
 if(isSuit(a)&&a[1]===o[1])return r('应叫争叫人的扣叫：三张支持邀请以上；跳扣四张支持，不保证短门','防守叫牌 1',len(overcall[1],Number(a[0])>minimum(overcall,a[1])?4:3));
 if(a==='1NT')return r('应叫争叫人的自然 1NT：8–11 点，敌花有止','防守叫牌 1',points(8,11));
 if(a==='2NT')return r('应叫争叫人的自然 2NT：跳叫局况差异取 11–13，平叫好 9–差12','防守叫牌 1',overcall[0]==='1'?points(11,13):points(9,12));
 if(isSuit(a)&&a[1]!==overcall[1])return r('应叫争叫人的自然新花不逼叫；跳叫为六张以上好套邀请','防守叫牌 1',Number(a[0])>minimum(overcall,a[1])?len(a[1],6):{});
 if(isSuit(a)&&a[1]===overcall[1])return r('争叫花色的自然支持','防守叫牌 1');
 return undefined;
}

/** Only call with the actual opening-side path and interference at fourth seat. */
export function fourthSeat(o:string,a:string,enemy:string,b:string):Rule|undefined{
 if((/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)||o==='1H'&&a==='1S')&&(isSuit(enemy)||enemy==='X')){
  if(b==='X'||b==='XX')return r('支持性加倍/再加倍：恰好三张应叫高花，实力不限','1.9 / 2.9',len(a[1],3,3));
  if(b===`2${a[1]}`||b===`3${a[1]}`)return r('直接支持：四张应叫高花，二阶低限、三阶高限','1.9 / 2.9',len(a[1],4,4));
 }
 if(o==='1NT'&&a==='2C'){
  if(enemy==='X'){
   if(b==='P')return r('斯台曼被加倍后不叫：无四张高花','3.6',{lengths:{H:[0,3],S:[0,3]}});
   if(b==='XX')return r('斯台曼被加倍后建议打梅花：四至五张好套','3.6',len('C',4,5));
   if(b==='2D')return r('斯台曼被加倍后自然方片五张，无四张高花','3.6',{lengths:{D:[5,13],H:[0,3],S:[0,3]}});
   if(b==='2H'||b==='2S')return r('受干扰斯台曼后自然四张高花','3.6',len(b[1],4));
  }
  if(enemy==='2D'&&b==='X')return r('斯台曼遭方片争叫后的加倍：44 双高','3.6',both('H','S',4));
  if((enemy==='2H'||enemy==='2S')&&b==='X')return r('对高花争叫的惩罚性加倍，至少好的四张敌花','3.6',len(enemy[1],4));
 }
 if(o==='1NT'&&['2D','2H'].includes(a)&&enemy==='X'){
  const target=a==='2D'?'H':'S';
  if(b==='P')return r('转移被加倍后不叫：少于三张目标高花支持','3.6',len(target,0,2));
  if(b==='XX'||b===`2${target}`)return r(b==='XX'?'三张以上支持，被加倍花色无止':'三张以上支持，被加倍花色有止','3.6',len(target,3));
  if(b===`3${target}`)return r('超转移：高限、四张以上目标高花好支持','3.6',len(target,4));
 }
 return undefined;
}

export function lebensohl(o:string,enemy:string,p:string[]):Rule|undefined{
 if(o!=='1NT'||!/^2[CDHS]$/.test(enemy)||p[1]!=='2NT')return undefined;
 if(p.length===3&&p[2]==='3C')return r('完成莱本索尔迫转 3C，不保证梅花长度','3.8');
 if(p.length!==4||p[2]!=='3C')return undefined;
 const a=p[3];
 if(a==='P')return r('莱本索尔后选择梅花止叫','3.8');
 if(enemy==='2C'){
  if(a==='3D')return r('莱本索尔后方片邀请','3.8',len('D',5));
  if(a==='3H'||a==='3S')return r('所叫高花有止，逼局，不是高花实套','3.8');
  if(a==='3NT')return r('经莱本索尔：双高至少半止，进局','3.8');
 }else{
  if(a==='3NT')return r('经莱本索尔：敌花有止，无四张高花，逼局','3.8',{lengths:{H:[0,3],S:[0,3]}});
  if(a===`3${enemy[1]}`)return r('经莱本索尔扣叫：敌花有止，另一四张高花，逼局','3.8',{expression:major(enemy[1])?`${other(enemy[1])} 4+`:'h 4+ OR s 4+'});
  if(a==='3D'||a==='3H'||a==='3S')return r('经莱本索尔自然止叫或邀请，不逼局','3.8',len(a[1],5));
 }
 return undefined;
}

export function slamRule(p:string[],fit:string|undefined,fitLength=8):Rule|undefined{
 if(!fit)return undefined;
 const voidIndex=fitLength>=9?p.findIndex((b,i)=>i>=2&&isSuit(b)&&b[1]!==fit&&rank(b)>rank('4S')&&Number(b[0])>minimum(p[i-1],b[1])&&!p.slice(0,i).some(x=>isSuit(x)&&x[1]===b[1])):-1;
 if(voidIndex>=0){
  const voidSuit=p[voidIndex][1],count=`cards ${['SA','HA','DA','CA'].filter(c=>c[0]!==voidSuit).concat(`${fit}K`).join(' ')}`;
  if(p.length===voidIndex+1)return r('九张以上配合，跳叫新花的缺门关键张问叫；不计该缺门 A','9.2',len(voidSuit,0,0));
  if(p.length===voidIndex+2){
   const answer=p.at(-1)!,step=rank(answer)-rank(p[voidIndex]);
   const expressions:Record<number,string>={1:`${count} 0`,2:`${count} 1, no ${fit} Q`,3:`${count} 2, no ${fit} Q`,4:`${count} 2, ${fit} Q`};
   if(expressions[step])return r('缺门关键张分级答叫：0–0.5 / 1 / 2 / 2.5；将 Q 计半张','9.2',{expression:expressions[step]});
   if(answer===`7${fit}`)return r('缺门关键张问叫后直接大满贯：至少三个关键张（不计缺门 A）','9.2',{expression:`${count} 3+`});
  }
  return undefined;
 }
 const ask=p.indexOf('4NT');if(ask<0)return undefined;
 // Quantitative NT sequences are explicitly excluded even if length inference
 // happens to show a fit; a fit alone does not turn a quantitative bid into RKCB.
 const superTransfer=p[0]==='1NT'&&['2D','2H'].includes(p[1])&&p[2]===(p[1]==='2D'?'3H':'3S');
 if((['1NT','2NT','3NT'].includes(p[0])&&!superTransfer)||p[0]==='2C'&&p[1]==='2D'&&p[2]?.endsWith('NT'))return undefined;
 if(p.length===ask+1)return r(`罗马关键张问叫，以 ${fit} 为将牌，不是自然无将`,'9.1');
 const answer=p[ask+1];
 if(p.length===ask+2){
  const expressions:Record<string,string>={'5C':`keys ${fit} 1 OR keys ${fit} 4`,'5D':`keys ${fit} 0 OR keys ${fit} 3`,'5H':`(keys ${fit} 2 OR keys ${fit} 5), no ${fit} Q`,'5S':`(keys ${fit} 2 OR keys ${fit} 5), ${fit} Q`};
  if(expressions[answer])return r('关键张答叫：14 / 03 / 25 无将 Q / 25 有将 Q；计数实际参与采样','9.1',{expression:expressions[answer]});
 }
 const next=p[ask+2];
 if(next==='5NT'){
  if(p.length===ask+3)return r('继续问边花 K，承诺联手关键张与将牌 Q 齐全；不误算为个人持全','9.1');
  if(p.length===ask+4&&/^6[CDHS]$/.test(p.at(-1)!)){
   const suit=p.at(-1)![1],denied=['C','D','H','S'].filter(s=>s!==fit&&rank(`6${s}`)<rank(`6${suit}`));
   return r('边花 K 答叫：否认更低级边花 K，所叫非将牌保证 K','9.1',{expression:[...denied.map(s=>`no ${s} K`),...(suit!==fit?[`${suit} K`]:[])].join(', ')});
  }
 }
 if(['5C','5D'].includes(answer)){
  const cheapest=['5C','5D','5H','5S','6C','6D'].find(b=>b[1]!==fit&&rank(b)>rank(answer));
  if(next===cheapest){
   if(p.length===ask+3)return r('最经济非将牌花色询问将牌 Q，不表示该花色套','9.1');
   if(p.length===ask+4){
    const last=p.at(-1)!,high=rank(next)>rank(`5${fit}`);
    if(last===`${high?6:5}${fit}`)return r('问将牌 Q 的否定答叫','9.1',{expression:`no ${fit} Q`});
    if(!high&&last===`6${fit}`)return r('有将牌 Q，无边花 K','9.1',{expression:[`${fit} Q`,...SUITS.filter(s=>s!==fit).map(s=>`no ${s} K`)].join(', ')});
    if(isSuit(last)&&last[1]!==fit)return r('有将牌 Q 及所叫花色 K','9.1',{expression:`${fit} Q, ${last[1]} K`});
   }
  }
 }
 return undefined;
}

export function extraOpening(call:string):Rule|undefined{
 if(/^[34][CDHS]$/.test(call))return r('高阶阻击：5–10 点，通常七张以上，二三法则仍需人工判断','7',{...points(5,10),...len(call[1],7)});
 if(call==='3NT'){
  const branch=(s:string)=>`(${s} 7-8 AND ${s} AKQ AND ${SUITS.filter(x=>x!==s).map(x=>`no ${x} AK`).join(' AND ')} AND cards ${SUITS.filter(x=>x!==s).map(x=>`${x}Q`).join(' ')} 0-1)`;
  return r('赌博性 3NT：七至八张 AKQ 低花，边花无 A/K、至多一个 Q','8',{expression:`${branch('C')} OR ${branch('D')}`});
 }
 return undefined;
}
