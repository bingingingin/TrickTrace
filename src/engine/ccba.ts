import {SEATS,SUITS,type Board,type Constraint,type Seat,type Suit} from '../core/types';
import {auctionCalls,validateConstraints} from './lead-constraints';
import {extraOpening,extraUncontested,extraIntervention,competitiveResponse,fourthSeat,lebensohl,slamRule,advanceOvercall} from './ccba-extra';

export const CCBA_SOURCE='https://oss.xinruibridge.com/doc/ccba_word_v2.2.zip';
export const CCBA_VERSION='新睿二盖一（CCBA v2.2）';
export interface BidMeaning {index:number;seat:Seat;call:string;description:string;section:string;applied:boolean}
export interface AuctionInference {constraints:Constraint[];meanings:BidMeaning[];error?:string}
type Bounds=[number,number];
type Rule={patch:Omit<Constraint,'seat'>;description:string;section:string};
const r=(description:string,section:string,patch:Rule['patch']={}):Rule=>({description,section,patch});
const points=(min:number,max=37)=>({minHcp:min,maxHcp:max});
const len=(s:string,min:number,max=13)=>({lengths:{[s]:[min,max] as Bounds}});
const major=(s:string)=>s==='H'||s==='S';
const other=(s:string)=>s==='H'?'S':'H';
const ntLengths={S:[0,5],H:[0,5],D:[0,6],C:[0,6]} as Record<Suit,Bounds>;
const noMajor={H:[0,3],S:[0,3]} as Record<Suit,Bounds>;

function opening(call:string,position:number):Rule|undefined {
 const s=call.slice(1);
 if(call==='1NT')return r('15–17 点；允许五张高花、六张低花和部分 5422，不强套普通均型筛选','3',{...points(15,17),lengths:ntLengths});
 if(call==='2NT')return r('20–21 点；19 点必须有五张以上套，不强套普通均型筛选','6',{...points(19,21),lengths:ntLengths,expression:'hcp 20+ OR s 5+ OR h 5+ OR d 5+ OR c 5+'});
 if(/^1[CD]$/.test(call))return r('12–21 点，至少三张所叫低花','1',{...points(12,21),...len(s,3)});
 if(/^1[HS]$/.test(call))return r(position===2?'第三家可轻开叫：至少五张高花，不硬设点力下限':'11–21 点，至少五张高花','2',{...points(position===2?0:11,21),...len(s,5)});
 if(call==='2C')return r('强开叫：非均型可以低于 22 点；仅取各分支共同下限 18，赢墩条件需核对','4',points(18));
 if(/^2[DHS]$/.test(call))return r(position===3?'第四家 9–12 点、六张以上好套':'弱二通常 6–10 点、六张以上套；长套允许降点，保留宽下限','5',{...points(position===3?9:0,position===3?12:10),...len(s,6)});
 return undefined;
}

// Only explicitly matched sequences are interpreted. Artificial bids are never
// handled by a generic "bid suit = held suit" fallback.
function uncontested(path:string[],passed:boolean):Rule|undefined {
 if(path[0]==='2C'&&path[1]==='2D'&&path[2]==='2NT'&&path.length>=4)return uncontested(['2NT',...path.slice(3)],false);
 const extra=extraUncontested(path,passed);if(extra)return extra;
 const [o,a,b,c,d]=path,s=o.slice(1),m=major(s),bid=path.at(-1)!;
 if(path.length===2){
  if(o==='1NT'||o==='2NT'){
   const one=o==='1NT',stay=one?'2C':'3C',section=one?'3.1':'6.1';
   if(a===stay)return r(one?'斯台曼问高花：不保证四张高花，不保证梅花长度':'傀儡斯台曼：不保证四张高花或梅花长度',section);
   if(a===(one?'2D':'3D')||a===(one?'2H':'3H'))return r('高花转移：约束目标花色，不约束所叫花色',section,len(a.endsWith('D')?'H':'S',5));
   if(a==='4D'||a==='4H')return r('德克萨斯转移：目标高花六张以上',section,len(a==='4D'?'H':'S',6));
   if(one&&a==='2S')return r('迫转 3C，含多种低花牌；不能推断有黑桃或固定点力',section);
   if(!one&&a==='3S')return r('低花斯台曼：至少 54 低花；调整点不换算为 HCP',section,{lengths:{C:[4,13],D:[4,13]},expression:'c 5+ OR d 5+'});
   if(one&&/^3[HS]$/.test(a))return r('5431 低花双套，所叫高花单张，10+ 大牌点',section,{...points(10),lengths:{C:[4,5],D:[4,5],[a[1]]:[1,1],[other(a[1])]:[3,3]}});
   if(!one&&a==='3NT')return r('自然进局：5–10 点',section,points(5,10));
   if(!one&&(a==='4NT'||a==='5NT'))return r('无四张高花的示量叫',section,{...points(a==='4NT'?11:13,a==='4NT'?12:14),lengths:noMajor});
   if(['2NT','3NT','4NT','4C'].includes(a))return r(a==='4C'?'戈伯问 A，不代表梅花套':'自然邀请、进局或示量；本条未规定可直接采用的 HCP 范围',section);
   return undefined;
  }
  if(o==='2C'){
   if(a==='2D')return r('示弱或等待：可能有 8+ 点，不设 7 点硬上限，也不保证方片','4.1');
   if(a==='2NT')return r('积极应叫，8+ 点；均型或半均型','4.1',points(8));
   if(/^(2[HS]|3[CD])$/.test(a))return r('自然积极应叫，8+ 点；低限有套质量要求，需人工核对','4.1',points(8));
  }
  if(/^1[CD]$/.test(o)){
   if(/^1[DHS]$/.test(a))return r('一盖一：5+ 点、四张以上；1D 使用 Walsh','1.1',{...points(5),...len(a[1],4)});
   if(a==='1NT')return r('6–10 点，无四张高花','1.1',{...points(6,10),lengths:noMajor});
   if(a===`2${s}`)return r('低花反加叫：10+ 点，至少四张支持（非逼局时五张）；不硬排除逼局四张分支','1.1',{...points(10),...len(s,4)});
   if((o==='1C'&&/^2[DHS]$/.test(a))||(o==='1D'&&/^2[HS]$/.test(a)))return r('弱跳应叫：4–6 点、六张以上套','1.1 / 1.7',{...points(4,6),...len(a[1],6)});
   if(o==='1D'&&a==='2C')return passed?undefined:r('二盖一逼局；与新花弱跳应叫区分，本条未硬设点力下限','1.1');
   if(o==='1D'&&a==='3C')return r('自然邀请：9–11 点、六张以上好梅花','1.1',{...points(9,11),...len('C',6)});
   if(a===`3${s}`)return r('低花阻击加叫：8 点以下、五张以上支持','1.1',{...points(0,8),...len(s,5)});
   if(a==='2NT'||a==='3NT')return r('自然无将应叫，无四张高花；边界“好/差”用宽范围','1.1',{...points(a==='2NT'?11:13,a==='2NT'?13:15),lengths:noMajor});
  }
  if(/^1[HS]$/.test(o)){
   if(passed){
    if(a==='2C')return r('逆朱瑞：三张支持好 9+，或四张以上好 8+ 且至少两控制','2.7',{...points(8),...len(s,3),expression:`(${s} 3 AND hcp 9+) OR (${s} 4+ AND hcp 8+ AND controls 2+)`});
    if(a==='1NT')return r('已不叫方的 1NT：6–11 点，不逼叫','2.7',points(6,11));
    if(o==='1H'&&a==='1S')return r('已不叫方一黑桃：6–11 点、四张黑桃、无三张红心','2.7',{...points(6,11),lengths:{S:[4,13],H:[0,2]}});
    if(a==='2D'||a==='3C')return r('已不叫方自然邀请：9–11 点，六张以上套','2.7',{...points(9,11),...len(a[1],6)});
    if(a===`2${s}`)return r('已不叫方简单加叫：5–差 9 点，三至四张支持','2.7',{...points(5,9),...len(s,3,4)});
    return undefined;
   }
   if(o==='1H'&&a==='1S')return r('6+ 点、四张以上黑桃','2.1',{...points(6),...len('S',4)});
   if(a==='1NT')return r('半逼叫 1NT：6–差 12 点，不承诺均型','2.1',points(6,12));
   if(a==='2C'||a==='2D'||(o==='1S'&&a==='2H'))return r('二盖一逼局：13+ 点；草花三张、方片四张、红心五张起','2.1',{...points(13),...len(a[1],a==='2C'?3:a==='2D'?4:5)});
   if(o==='1H'&&a==='2S')return r('弱跳应叫：4–6 点、六张以上黑桃','2.1',{...points(4,6),...len('S',6)});
   if(a===`2${s}`)return r('简单加叫有三张与均型四张两种分支，取共同外包范围','2.1',{...points(s==='H'?5:6,10),...len(s,3,4)});
   if(a==='2NT')return r('杰可贝 2NT：13+ 点、四张以上将牌支持；不是自然无将','2.1',{...points(13),...len(s,4)});
   if(a==='3C'||a==='3D')return r('伯根加叫：四张以上将牌支持；不表示所叫低花套','2.1 / 2.6',{...points(a==='3C'?7:9,a==='3C'?9:12),...len(s,4)});
   if(a===`3${s}`)return r('阻击性跳加叫：四张以上支持，点力随局况/牌型变化，不硬设上限','2.6',len(s,4));
   if(a===`3${other(s)}`)return r('Mini-Splinter：10–12 HCP、四张以上支持；至少一门边花单缺，具体短门未确定','2.1', {...points(10,12),...len(s,4),expression:SUITS.filter(x=>x!==s).map(x=>`${x} 0-1`).join(' OR ')});
   if(a==='3NT'||a==='4C'||a==='4D')return r('Splinter：13–15 HCP、四张以上将牌、所示花色单缺','2.1',{...points(13,15),lengths:{[s]:[4,13],[a==='3NT'?other(s):a[1]]:[0,1]}});
  }
 }
 if(path.length===3){
  if(o==='1NT'&&a==='2C'){
   if(b==='2D')return r('斯台曼答叫：无四张高花，不表示方片套','3.2',{lengths:noMajor});
   if(b==='2H'||b==='2S')return r('斯台曼答叫：所叫高花四至五张；不额外猜测另一高花','3.2',len(b[1],4,5));
  }
  if((o==='1NT'&&['2D','2H'].includes(a))||(o==='2NT'&&['3D','3H'].includes(a))){
   const target=a.endsWith('D')?'H':'S';
   if(b===`${o==='1NT'?2:3}${target}`)return r('正常接受转移：不额外保证支持张数',o==='1NT'?'3.3':'6.3');
   if(b===`${o==='1NT'?3:4}${target}`)return r('超转移：四张以上目标高花支持，不保证所叫花色以外的长度',o==='1NT'?'3.3':'6.3',len(target,4));
  }
  if(o==='2NT'&&a==='3C'){
   if(b==='3D')return r('傀儡斯台曼答叫：至少一门四张高花，不表示方片','6.2',{expression:'h 4 OR s 4'});
   if(b==='3H'||b==='3S')return r('傀儡斯台曼答叫：五张所叫高花','6.2',len(b[1],5,5));
   if(b==='3NT')return r('傀儡斯台曼答叫：无四张高花','6.2',{lengths:noMajor});
  }
  if(o==='1NT'&&a==='2S'&&b==='3C')return r('完成强制转移，不承诺梅花长度','3.4');
  if(o==='2C'&&a==='2D'){
   if(['2NT','3NT','4NT'].includes(b)){const lo=b==='2NT'?22:b==='3NT'?25:28;return r('强二等待后无将再叫：CCBA v2.2 点力档位','4.2',{...points(lo,lo+2),lengths:ntLengths});}
   if(b==='2H'||b==='2S'||b==='3C'||b==='3D')return r('强二等待后自然实套，逼叫一轮；不设未明确的长度下限','4.2');
  }
  if(/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)){
   if(o==='1C'&&a==='1D'&&(b==='2D'||b==='3D'))return r('Walsh 方片应叫后支持方片：四张支持','1.2',{...points(b==='2D'?12:16,b==='2D'?15:17),...len('D',4,4)});
   if(b==='2NT')return r('跳再叫无将：18–19 点，相对均型','1.3 / 2.2',points(18,19));
   if(b===`2${s}`)return r('重叫原花：六张以上，低限','1.2 / 1.3 / 2.2',{...points(m?11:12,15),...len(s,6)});
   if(b===`3${s}`)return r('跳再叫原花：15–17 点、六张以上好套','1.3 / 2.2',{...points(15,17),...len(s,6)});
   if(b==='1NT')return r('低限无将再叫；1C–1D 的 Walsh 再叫不否认四张高花','1.2 / 1.3 / 2.2',points(m?11:12,14));
   if(major(a[1])&&b===`2${a[1]}`)return r('简单支持应叫高花：允许低限 5431 三张支持','1.3 / 2.2',{...points(m?11:12,m?13:14),...len(a[1],3,4)});
   if(major(a[1])&&b===`3${a[1]}`)return r('邀请支持：四张应叫高花','1.3 / 2.2',{...points(m?14:15,m?16:17),...len(a[1],4,4)});
   if(!m&&major(a[1])&&b===`4${a[1]}`)return r('CCBA v2.2：18–19 点均型、四张应叫高花支持','1.3',{...points(18,19),...len(a[1],4,4)});
   if(o==='1C'&&a==='1D'&&/^1[HS]$/.test(b))return r('Walsh 后自然高花再叫：12–17 点、四张高花，非均型','1.2',{...points(12,17),...len(b[1],4,4)});
   if(a==='1H'&&b==='1S')return r('自然显示四张黑桃','1.3',len('S',4,4));
   if(o==='1D'&&b==='2C')return r('顺叫第二套，12–17 点','1.3',{...points(12,17),...len('C',4)});
   if(!m&&/^2[DHS]$/.test(b)&&'CDHS'.indexOf(b[1])>'CDHS'.indexOf(s))return r('逆叫 16+ 点；保留 18+ 点非均型三张第二套例外','1.3',{...points(16),...len(b[1],3)});
  }
  if(/^1[HS]$/.test(o)&&a==='1NT'&&!passed){
   if(b==='2NT')return r('18–19 点均型再叫','2.3',points(18,19));
   if(b===`2${s}`)return r('12–15 点，重叫高花通常六张，但五张例外不硬排除','2.3',points(12,15));
   if(b===`3${s}`)return r('15–17 点、六张以上原高花','2.3',{...points(15,17),...len(s,6)});
   if(b==='2C'||b==='2D'||(o==='1S'&&b==='2H'))return r('平叫第二套；1H–1NT–2C 可仅两张草花','2.3',{...points(12,17),...len(b[1],b==='2H'?4:o==='1H'&&b==='2C'?2:3)});
   if(o==='1H'&&b==='2S')return r('逆叫：16+ 点，第二套','2.3',{...points(16),...len('S',4)});
  }
  if(/^1[HS]$/.test(o)&&a==='2NT'&&!passed){
   if(/^3[CDHS]$/.test(b)&&b[1]!==s)return r('杰可贝后显示单缺，不表示第二长套','2.5',len(b[1],0,1));
   if(b===`3${s}`)return r('杰可贝后高限：16+ 点、无单缺','2.5',{...points(16),lengths:{S:[2,13],H:[2,13],D:[2,13],C:[2,13]}});
   if(b==='3NT')return r('杰可贝后 3NT：14–15 点或至少四控制，无单缺','2.5',{lengths:{S:[2,13],H:[2,13],D:[2,13],C:[2,13]},expression:'hcp 14-15 OR controls 4+'});
  }
  if(/^1[HS]$/.test(o)&&['2C','2D',...(o==='1S'?['2H']:[])].includes(a)&&!passed){
   if(b==='2NT')return r('二盖一后再叫 2NT：14+ 点，允许部分非典型均型牌','2.4',points(14));
   if(b===`2${s}`)return r('二盖一后重叫高花有低限差套分支，不硬推六张','2.4');
   if(b===`3${s}`)return r('二盖一后跳再叫高花：14+ 点、六张以上半坚固套','2.4',{...points(14),...len(s,6)});
  }
 }
 if(path.length===4){
  if(o==='1NT'&&a==='2C'&&b==='2D'){
   if(c==='2H'||c==='2S')return r('斯台曼后双高邀请：所叫五张、另一高花四张','3.2',{lengths:{[c[1]]:[5,5],[other(c[1])]:[4,4]}});
   if(c==='3H'||c==='3S')return r('Smolen：所叫高花四张，另一高花五张；不是自然五张套','3.2',{lengths:{[c[1]]:[4,4],[other(c[1])]:[5,5]}});
   if(c==='3C'||c==='3D')return r('斯台曼后的自然低花逼局：五张以上','3.2',len(c[1],5));
  }
  if(o==='1NT'&&['2D','2H'].includes(a)&&b===(a==='2D'?'2H':'2S')){
   if(c===`4${b[1]}`)return r('转移后加叫进局：12–14 点、六张以上高花，温和满贯兴趣','3.3',{...points(12,14),...len(b[1],6)});
   if(a==='2D'&&c==='2S')return r('转移后双高邀请：55 高花','3.3',{lengths:{H:[5,13],S:[5,13]}});
   if(a==='2H'&&c==='3H')return r('转移后双高逼局：55 高花','3.3',{lengths:{H:[5,13],S:[5,13]}});
   if(c==='4NT')return r('转移后 4NT 为 5332 示量，不作问关键张','3.3',{expression:'shape 5332'});
   if(c==='3NT'||c==='2NT'||c===`3${b[1]}`)return r('转移后自然进局/邀请，保留原转移的长度；不臆造 HCP 档位','3.3');
  }
  if(o==='2NT'&&a==='3C'&&b==='3D'){
   if(c==='3H'||c==='3S')return r('傀儡斯台曼：叫出另一门高花，实际四张在对应高花','6.2',len(other(c[1]),4,4));
   if(c==='3NT')return r('傀儡斯台曼后无四张高花，止叫','6.2',{lengths:noMajor});
  }
  if(/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)&&b==='1NT'){
   if(c==='2C'||c==='2D')return r(c==='2C'?'双路重询：转移至 2D，可弱方片或任意邀请，不保证草花':'双路重询：人工逼局，不保证方片','1.3 / 2.2');
   if(c===`2${a[1]}`)return r('六张以上应叫高花，弱止叫','1.3',len(a[1],6));
  }
 }
 if(path.length===5&&/^1[CDHS]$/.test(o)&&/^1[DHS]$/.test(a)&&b==='1NT'&&c==='2C'&&d==='2D')return r('按双路重询完成强制转移，不保证方片长度','1.3');
 return undefined;
}

function intervention(open:string,call:string,balancing:boolean):Rule|undefined {
 if(open==='1NT'){
  if(call==='2C')return r('兰迪：至少 54 双高，不表示草花','3.9',{lengths:{H:[4,13],S:[4,13]},expression:'h 5+ OR s 5+'});
  if(/^2[DHS]$/.test(call))return r('对强无将自然争叫：9–16 点、六张以上套','3.9',{...points(9,16),...len(call[1],6)});
  if(call==='X')return r('惩罚性加倍：15+ 单套或 18+ 任意牌，只取共同点力下限','3.9',points(15));
 }
 if(/^1[CDHS]$/.test(open)){
  if(call==='1NT')return r(balancing?'平衡位置无将：12–15 点':'直接无将争叫：15–18 点','附录：1NT 争叫',points(balancing?12:15,balancing?15:18));
  if(call===`2${open[1]}`){
   if(major(open[1]))return r('迈克尔斯：另一高花五张以上，另有五张以上低花；调整点不直接转 HCP','防守叫牌 7',{...len(other(open[1]),5),expression:'c 5+ OR d 5+'});
   return r('迈克尔斯：55 双高；调整点不直接转 HCP','防守叫牌 7',{lengths:{H:[5,13],S:[5,13]}});
  }
  if(/^[12][CDHS]$/.test(call)&&call[1]!==open[1]){
   const minimum='CDHS'.indexOf(call[1])>'CDHS'.indexOf(open[1])?1:2;
   if(Number(call[0])===minimum)return r('自然争叫通常五张以上，按常规五张建模；特殊四张争叫可手动放宽','附录：争叫',{...(balancing?{}:points(minimum===1?8:11,16)),...len(call[1],5)});
  }
 }
 return undefined;
}

function intersect(old:Constraint|undefined,seat:Seat,patch:Rule['patch']):Constraint{
 const out:Constraint={...old,seat};
 if(patch.minHcp!==undefined)out.minHcp=Math.max(old?.minHcp??0,patch.minHcp);
 if(patch.maxHcp!==undefined)out.maxHcp=Math.min(old?.maxHcp??37,patch.maxHcp);
 if(patch.lengths){out.lengths={...old?.lengths};for(const s of SUITS)if(patch.lengths[s]){const [a,b]=patch.lengths[s]!;out.lengths[s]=[Math.max(old?.lengths?.[s]?.[0]??0,a),Math.min(old?.lengths?.[s]?.[1]??13,b)];}}
 if(patch.expression)out.expression=[old?.expression,patch.expression].filter(Boolean).join(', ');
 return out;
}
export function inferCCBA(text:string,dealer:Seat,vulnerability?:Board['vulnerability']):AuctionInference{
 if(!text.trim())return {constraints:[],meanings:[]};
 let calls:string[];try{calls=auctionCalls(text,dealer);}catch(e){return {constraints:[],meanings:[],error:(e as Error).message};}
 const constraints=new Map<Seat,Constraint>(),meanings:BidMeaning[]=[];
 const start=calls.findIndex(c=>c!=='P');if(start<0)return {constraints:[],meanings:[]};
 const opener=SEATS[(SEATS.indexOf(dealer)+start)%4],side=SEATS.indexOf(opener)%2;
 const path:string[]=[];let contested=false;
 const opponents:{call:string;index:number}[]=[];
 calls.forEach((call,index)=>{
  if(index<start)return;
  const seat=SEATS[(SEATS.indexOf(dealer)+index)%4];let rule:Rule|undefined;
  if(index===start){path.push(call);rule=opening(call,start)??extraOpening(call);}
  else if(SEATS.indexOf(seat)%2!==side){
   if(call==='P')return;
   if(!contested&&path.length===1)rule=intervention(calls[start],call,index-start===3)??extraIntervention(calls[start],call,index-start===3);
   else if(path.length===1&&opponents.length){
    if(opponents[0].call==='1NT')rule=uncontested([...opponents.map(x=>x.call),call],false);
    else if(opponents.length===1&&index===opponents[0].index+2)rule=advanceOvercall(calls[start],opponents[0].call,call);
   }
   opponents.push({call,index});
   contested=true;
  }else if(!contested){
   if(call==='P'){
    rule=extraUncontested([...path,call],start>=2);
    if(!rule)return;
   }else{
   path.push(call);
   const partner=SEATS[(SEATS.indexOf(seat)+2)%4];
   const fits=SUITS.filter(s=>(constraints.get(seat)?.lengths?.[s]?.[0]??0)>=3&&(constraints.get(partner)?.lengths?.[s]?.[0]??0)>=3&&(constraints.get(seat)!.lengths![s]![0]+constraints.get(partner)!.lengths![s]![0])>=8);
   const fit=fits.length===1?fits[0]:undefined;
   rule=uncontested(path,start>=2)??slamRule(path,fit,fit?(constraints.get(seat)!.lengths![fit]![0]+constraints.get(partner)!.lengths![fit]![0]):0);
   }
  }else{
   const enemy=opponents[0];
   if(opponents.length===1){
    if(enemy.index===start+1&&index===start+2)rule=competitiveResponse(calls[start],enemy.call,call);
    if(enemy.index===start+3&&index===start+4)rule=fourthSeat(calls[start],path[1],enemy.call,call);
    if(enemy.index===start+1&&index>start+2)rule=lebensohl(calls[start],enemy.call,[...path,call]);
   }
   if(call!=='P')path.push(call);
  }
  if(call==='P'&&!rule)return;
  if(rule&&vulnerability!==undefined){
   const vulnerable=vulnerability==='All'||vulnerability===(SEATS.indexOf(seat)%2===0?'NS':'EW');
   // Apply only at the exact auction role, never by bid name alone.
   if(!contested&&start<2&&path.length===2&&/^1[HS]$/.test(path[0])){
    if(call==='3D')rule={...rule,description:rule.description+`；${vulnerable?'有局 11–12':'无局 9–12'} HCP`,patch:{...rule.patch,...points(vulnerable?11:9,12)}};
    if(call===`3${path[0][1]}`&&!vulnerable)rule={...rule,description:rule.description+'；无局 3–6 HCP',patch:{...rule.patch,...points(3,6)}};
   }
   if(index===start+1&&calls[start]==='1NT'&&call==='2NT')rule={...rule,description:`特殊无将：55 双低，${vulnerable?'有局 14+':'无局 12+'} HCP`,patch:{...rule.patch,...points(vulnerable?14:12)}};
   if(index===start+1&&calls[start]==='1NT'&&/^3[CDHS]$/.test(call))rule={...rule,patch:{...rule.patch,...{lengths:{[call[1]]:[vulnerable?7:6,13]}}}};
   if(index===start+2&&calls[start+1]==='1NT'){
    if(/^1[HS]$/.test(calls[start])&&(call==='2C'||call==='2D'))rule={...rule,patch:{...rule.patch,...points(vulnerable?8:6,vulnerable?10:9)}};
    if(/^1[CD]$/.test(calls[start])&&call==='2C')rule={...rule,patch:{...rule.patch,...points(6,vulnerable?11:9),...(vulnerable?{lengths:{H:[5,13],S:[5,13]}}:{})}};
   }
  }
  if(rule){if(Object.keys(rule.patch).length)constraints.set(seat,intersect(constraints.get(seat),seat,rule.patch));meanings.push({index,seat,call,description:rule.description,section:rule.section,applied:true});}
  else meanings.push({index,seat,call,description:contested?'竞争叫牌后续尚未覆盖，请手动补充；不套用无干扰规则':'此进程尚未覆盖，请手动补充；不会把约定叫当自然套',section:'',applied:false});
 });
 const result={constraints:[...constraints.values()],meanings};
 try{validateConstraints(result.constraints);}catch(e){return {...result,error:`叫牌推断存在冲突：${(e as Error).message}`};}
 return result;
}

// Manual fields replace only that field; changing one suit must not pin the other
// three inferred suits. Empty/unrestricted fields are explicit overrides.
export function applyOverrides(inferred:Constraint[],overrides:Constraint[]):Constraint[]{
 const map=new Map(inferred.map(c=>[c.seat,structuredClone(c)]));
 for(const c of overrides){const old=map.get(c.seat);map.set(c.seat,{...old,...c,...(c.lengths?{lengths:{...old?.lengths,...c.lengths}}:{})});}
 return [...map.values()];
}
