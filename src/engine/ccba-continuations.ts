import {type Constraint} from '../core/types';

type Rule={patch:Omit<Constraint,'seat'>;description:string;section:string};
const r=(description:string,section:string,patch:Rule['patch']={}):Rule=>({description,section,patch});
const len=(s:string,min:number,max=13)=>({lengths:{[s]:[min,max] as [number,number]}});
const points=(minHcp:number,maxHcp=37)=>({minHcp,maxHcp});
const other=(s:string)=>s==='H'?'S':'H';
const isSuit=(s:string)=>/^[1-7][CDHS]$/.test(s);
const rank=(s:string)=>Number(s[0])*5+['C','D','H','S','NT'].indexOf(s.slice(1));

/** Later branches transcribed from CCBA v2.2 §§1–8. No natural-bid fallback. */
export function continuations(p:string[],passed:boolean):Rule|undefined {
 const [o,a,b,c,d]=p,last=p.at(-1)!,s=o.slice(1);
 if(o==='2C'&&a==='2D'&&b==='2NT'&&p.length>=4)return continuations(['2NT',...p.slice(3)],false);
 if(p.length===2){
  if(/^1[HS]$/.test(o)&&a===`4${s}`)return r('跳加叫进局：阻击或进攻型，局况及牌型决定实力','2.6 / 2.7',len(s,4));
  if(/^[34][CDHS]$/.test(o)){
   if(a==='3NT'||/^4[HS]$/.test(a))return r('阻击开叫后自然进局止叫','7 / 附录');
   if(isSuit(a)&&a[1]===s)return r('阻击开叫后的加深阻击或进局','7 / 附录');
   if(isSuit(a))return r('阻击后新花逼叫；四阶低花可能有配合的提前扣叫，不保证实套','7 / 附录');
  }
 }
 if(p.length===3){
  if(o==='1C'&&a==='1D'&&b==='3NT')return r('Walsh 后坚固梅花 3NT：六至七张梅花，未叫花色有止；赢墩要求保留说明','1.2',{...len('C',6,7),expression:'C AKQ'});
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)){
   if(o==='1D'&&b==='3C')return r('跳顺叫：18+ 点，梅花第二套，逼局','1.3',{...points(18),...len('C',4)});
   if(b==='3NT')return r('七张以上原低花坚固套，未叫花色有止','1.3',{...len(s,7),expression:`${s} AKQ`});
   if(b===`4${s}`)return r('16+ 点，六张好原低花、四张应叫高花支持','1.3',{...points(16),lengths:{[s]:[6,13],[a[1]]:[4,4]}});
   if(isSuit(b)&&b[1]!==s&&b[1]!==a[1]&&rank(b)>rank(`2${b[1]}`))return r('跳逆叫或双跳新花 Splinter：四张高花支持，所叫单缺；调整点不转 HCP','1.3',{lengths:{[a[1]]:[4,4],[b[1]]:[0,1]}});
  }
  if(o==='1H'&&a==='1S'){
   if(b==='2C'||b==='2D')return r('11–17 点，自然低花第二套','2.2',{...points(11,17),...len(b[1],4)});
   if(b==='3C'||b==='3D')return r('18+ 点，低花第二套逼局','2.2',{...points(18),...len(b[1],4)});
   if(b==='3NT')return r('六张以上红心半坚固套、四张小黑桃','2.2',{lengths:{H:[6,13],S:[4,4]},expression:'no S AKQJ'});
   if(b==='4C'||b==='4D')return r('黑桃配合的 Splinter，所叫单缺','2.2',{lengths:{S:[4,4],[b[1]]:[0,1]}});
   if(b==='4H')return r('红心单套进局，通常七张以上、15–17 点；保留例外','2.2');
  }
  if(passed&&/^1[HS]$/.test(o)&&a==='2C'){
   if(o==='1S'&&b==='4H')return r('逆朱瑞后 55 双高花选局','2.7',{lengths:{H:[5,13],S:[5,13]}});
   if(b===`4${s}`)return r('逆朱瑞后有额外牌型或实力，进局止叫','2.7');
   if(isSuit(b)&&b[1]!==s&&rank(b)>rank(`3${b[1]}`))return r('逆朱瑞后双跳 Splinter：19+ 点，所叫单缺','2.7',{...points(19),...len(b[1],0,1)});
   if(isSuit(b)&&rank(b)>rank(`2${s}`))return r('逆朱瑞后自然邀请或开始满贯试探','2.7');
  }
  if(o==='1NT'&&(a==='3H'||a==='3S')){
   if(b==='3NT')return r('低花 5431 应叫后选择无将，短门有浪费或低限无低花配合','3.5');
   if(b==='4C'||b==='4D')return r('四张低花配合','3.5',len(b[1],4));
   if(a==='3H'&&b==='3S')return r('四张好黑桃，红心止张不足','3.5',len('S',4,4));
   if(a==='3S'&&b==='4H')return r('四至五张红心，黑桃止张不足','3.5',len('H',4,5));
   if(a==='3H'&&b==='4S')return r('五张黑桃，建议成局止叫','3.5',len('S',5,5));
   if(b===`4${a[1]}`)return r('扣叫同伴单张：高限、有四张低花配合、满贯兴趣','3.5',{expression:'c 4+ OR d 4+'});
  }
  if(['1NT','2NT'].includes(o)&&['4D','4H'].includes(a)&&b===`4${a==='4D'?'H':'S'}`)return r('完成德克萨斯转移，不额外保证支持张数','3.1 / 6.1');
  if(['1NT','2NT'].includes(o)&&a==='4S'&&(b==='5C'||b==='5D'))return r('65 双低花选局后选择低花定约','3.1 / 6.1');
  if(o==='3NT'&&['4C','5C','6C'].includes(a)){
   if(b==='P'||b===`${a[0]}D`)return r('赌博性无将后不叫或修正，确认坚固低花所在','8',len(b==='P'?'C':'D',7,8));
  }
 }
 if(p.length===4){
  if(o==='1C'&&a==='1D'&&(b==='1H'||b==='1S')){
   if(c==='P')return r('Walsh 后选择不叫：5–7 点、三张高花支持，无四张梅花','1.2',{...points(5,7),lengths:{[b[1]]:[3,3],C:[0,3]}});
   if(c==='2NT')return r('Walsh 后自然无将邀请：11–12 点','1.2',points(11,12));
   if(b==='1H'&&c==='2S')return r('Walsh 后自然双套逼局：五张以上方片、四张黑桃','1.2',{lengths:{D:[5,13],S:[4,4]}});
   if(c==='3C'||c==='3D')return r('Walsh 后自然低花邀请；原文未明确统一点力和长度','1.2');
   if(c===`3${b[1]}`)return r('Walsh 后高花配合逼局：四张高花支持、五张以上方片','1.2',{lengths:{[b[1]]:[4,4],D:[5,13]}});
   if(c===`3${other(b[1])}`)return r('Walsh 后高花配合 Splinter：四张支持、五张以上方片、另一高花单缺','1.2',{lengths:{[b[1]]:[4,4],D:[5,13],[other(b[1])]:[0,1]}});
   if(c==='3NT')return r('Walsh 后自然无将进局止叫','1.2');
  }
  if(o==='1C'&&a==='1D'&&b==='1NT'&&c==='3NT')return r('Walsh 无将再叫后自然进局止叫','1.2');
  if(/^1[CD]$/.test(o)&&a==='1H'&&b==='1S'){
   if(c==='P')return r('三张黑桃 5–7 点或四张黑桃 5–6 点，选择不叫','1.3',{...points(5,7),...len('S',3,4),expression:'(s 3 AND hcp 5-7) OR (s 4 AND hcp 5-6)'});
   if(c==='1NT')return r('6–10 点自然无将，不保证均型','1.3',points(6,10));
   if(c==='3C'||c==='3D')return r('原低花四张支持邀请，或 55 红心加新低花邀请','1.3',c[1]===s?len(s,4):{lengths:{H:[5,13],[c[1]]:[5,13]}});
   if(c==='3H')return r('六张以上好红心，邀请','1.3',len('H',6));
   if(c==='3S')return r('四至五张红心、四张黑桃支持，邀请','1.3',{lengths:{H:[4,5],S:[4,4]}});
   if(c==='3NT')return r('四张红心或五张均型红心，第四花色有止，进局','1.3',len('H',4,5));
   if(c==='4H')return r('七张以上红心，凭牌型进局','1.3',len('H',7));
   if(c==='4S')return r('10+ 点、四张黑桃支持进局','1.3',{...points(10),...len('S',4,4)});
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&(b===`2${s}`||o==='1D'&&b==='2C')){
   if(c==='2NT')return r('自然邀请，不保证均型','1.3');
   if(c==='3NT')return r('自然进局止叫，无满贯兴趣','1.3');
   if(c===`3${a[1]}`)return r('六张以上原高花，邀请','1.3',len(a[1],6));
   if(o==='1D'&&b==='2C'&&c==='2D')return r('弱牌示选原方片，不推定额外支持长度','1.3');
   if(o==='1C'&&b==='2C'&&a==='1S'&&c==='2H')return r('五张黑桃、四张红心，非逼叫','1.3',{lengths:{S:[5,13],H:[4,13]}});
   if(o==='1D'&&b==='2D'&&c==='3C')return r('五张应叫高花、四张以上梅花，逼局','1.3',{lengths:{[a[1]]:[5,13],C:[4,13]}});
   if(isSuit(c)&&c[0]==='3'&&c[1]!==s&&c[1]!==a[1]&&c[1]!==b[1])return r('55 双套邀请','1.3',{lengths:{[a[1]]:[5,13],[c[1]]:[5,13]}});
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b===`2${a[1]}`){
   if(c==='3NT'||c===`4${a[1]}`)return r('支持后选择成局定约','1.3');
   if(isSuit(c)&&c[1]!==a[1])return rank(c)>rank(`3${c[1]}`)?r('支持后跳新花显示单缺','1.3',len(c[1],0,1)):r('支持后边花邀请以上，三张以上边花','1.3',len(c[1],3));
  }
  if(/^1[CDH]$/.test(o)&&/^1[HS]$/.test(a)&&b==='1NT'){
   if(c==='3NT')return r('无将再叫后自然进局止叫','1.3 / 2.2');
   if(o==='1H'&&c==='2H')return r('三张红心支持，弱牌示选','2.2',len('H',3,3));
  }
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b==='2NT'&&(c==='3NT'||c===`4${a[1]}`))return r('18–19 无将再叫后选择成局定约','1.3');
  if(['1NT','2NT'].includes(o)&&['2D','2H','3D','3H'].includes(a)&&b===`${o==='1NT'?3:4}${/[DH]$/.test(a)&&a[1]==='D'?'H':'S'}`){
   if(c===`4${b[1]}`)return r('超转移后加叫进局止叫','3.3 / 6.3');
   if(c==='3NT')return r('超转移后等待，要求同伴扣叫','3.3');
   if(isSuit(c)&&c[1]!==b[1])return r('超转移确认配合后扣叫，满贯兴趣，不表示实套','3.3');
  }
  if(o==='2NT'&&a==='3C'&&['3H','3S','3NT'].includes(b)){
   if(c==='4C'||c==='4D')return r('傀儡斯台曼后自然低花，满贯兴趣','6.2');
   if(b!=='3NT'){
    if(c==='3NT')return r('五张高花答叫后无三张配合，止叫','6.2',len(b[1],0,2));
    if(c===`4${b[1]}`)return r('五张高花配合进局','6.2',len(b[1],3));
    if(isSuit(c)&&c[1]===other(b[1]))return r('用另一高花表示配合和满贯兴趣','6.2',len(b[1],3));
    if(c==='4NT')return r('傀儡斯台曼后示量邀请','6.2');
   }
  }
 }
 if(p.length===5){
  if(/^1[CD]$/.test(o)&&/^1[HS]$/.test(a)&&b==='2NT'&&c==='3C'){
   if(d==='4C'||d==='4D')return r('等待后四张应叫高花支持，满贯兴趣，不保证低花套','1.3',len(a[1],4,4));
   if(d==='3H')return r(a==='1H'?'等待后至少三张红心支持':'等待后优先显示四张红心','1.3',len('H',a==='1H'?3:4));
   if(d==='3S'&&a==='1S')return r('等待后至少三张黑桃支持，无四张红心','1.3',{lengths:{S:[3,13],H:[0,3]}});
   if(d==='3D')return r('等待后无三张支持、无四张另一高花，方片人工','1.3',{lengths:{[a[1]]:[0,2],[other(a[1])]:[0,3]}});
  }
  if(o==='1H'&&a==='1S'&&b==='1NT'&&c==='2D'){
   if(d==='2H')return r('双路逼局重询后五张半坚固或六张红心','2.2',len('H',5));
   if(d==='2S')return r('双路逼局重询后三张黑桃支持','2.2',len('S',3,3));
   if(d==='2NT')return r('双路逼局重询后自然无将','2.2');
   if(d==='3C'||d==='3D')return r('双路逼局重询后四张自然低花','2.2',len(d[1],4,4));
  }
  if(o==='1NT'&&a==='2S'&&b==='3C'&&['3H','3S'].includes(c)){
   if(d==='3NT')return r('双低花短门显示后，短门有足够止张，选择无将','3.4');
   if(d==='4NT')return r('双低花短门显示后，低花等长，选局','3.4',{expression:'(c 2 AND d 2) OR (c 3 AND d 3) OR (c 4 AND d 4)'});
   if(d==='4C'||d==='4D')return r('双低花短门显示后选择低花，通常四张支持，不硬排除例外','3.4');
   if(d==='3S')return r('低花无良好配合，四至五张黑桃','3.4',len('S',4,5));
   if(d==='4H'||d==='4S')return r('五张好高花，建议打高花成局','3.4',len(d[1],5,5));
  }
 }
 if(p.length===6&&/^1[CDH]$/.test(o)&&/^1[HS]$/.test(a)&&b==='1NT'){
  if(c==='2C'&&d==='2D'){
   if(last==='P')return r('双路重询迫转后选择方片弱止叫','1.3 / 2.2');
   if(o==='1H'&&last==='2H')return r('三张红心支持，邀请','2.2',len('H',3,3));
   if(o==='1H'&&last==='3H')return r('五张黑桃、四张红心，强邀请','2.2',{lengths:{S:[5,13],H:[4,4]}});
   if(o==='1H'&&(last==='3C'||last==='3D'))return r('六张低花、四张黑桃，邀请','2.2',{lengths:{S:[4,4],[last[1]]:[6,13]}});
   if(o==='1H'&&last==='3NT')return r('五张黑桃 5332，选局','2.2',{...len('S',5,5),expression:'shape 5332'});
  }
  if(c==='2NT'&&d==='3C'&&last==='P')return r('迫转梅花后弱牌止叫','1.3 / 2.2',o==='1H'?len('C',6):{});
 }
 if(p.length===6&&o==='2NT'&&a==='3C'&&b==='3D'&&['3H','3S'].includes(c)){
  const target=other(c[1]);
  if(d==='3NT'){
   if(last==='4C'||last==='4D')return r('未找到高花配合后自然低花，满贯兴趣','6.2');
   if(c==='3H'&&last==='4H')return r('44 双高，温和满贯兴趣','6.2',{lengths:{H:[4,13],S:[4,13]}});
  }else if(d===`3${target}`||d===`4${target}`){
   if(last===`4${target}`)return r('傀儡斯台曼找到配合后进局','6.2');
   if(isSuit(last)&&last[1]!==target&&last[0]==='4')return r('傀儡斯台曼找到配合后扣叫，不表示边花长度','6.2');
  }
 }
 return undefined;
}

/** Opponents' bids are supplied with exact seats/rounds by the dispatcher. */
export function contestedContinuation(o:string,overcall:string,response:string,p:string[]):Rule|undefined {
 const last=p.at(-1)!;
 if(p.length===2){
  if(o==='1NT'&&overcall==='2C'){
   if(last==='P')return r('兰迪后选择梅花：六张以上好梅花','3.9',len('C',6));
   if(response==='X'){
    if(last==='2D')return r('兰迪被加倍后六张以上半坚固方片，建议打','3.9',len('D',6));
    if(last==='XX')return r('兰迪被加倍后再加倍要求示选，高花等长','3.9',{expression:'(h 0 AND s 0) OR (h 1 AND s 1) OR (h 2 AND s 2) OR (h 3 AND s 3) OR (h 4 AND s 4) OR (h 5 AND s 5) OR (h 6 AND s 6)'});
    if(/^[23][HS]$/.test(last))return r('兰迪被加倍后高花示选，三阶跳叫为牌型牌','3.9');
   }
  }
  if(/^1[CDHS]$/.test(o)&&isSuit(overcall)&&response==='X'){
   if(last==='XX')return r('争叫被加倍后实力再加倍，通常无三张支持；不硬设长度','防守叫牌 2');
   if(last==='1NT')return r('争叫被加倍后自然 1NT：9–11 点','防守叫牌 2',points(9,11));
   if(last==='2NT'&&overcall[0]==='1')return r('争叫被加倍后跳 2NT：限制性加叫，四张以上支持','防守叫牌 2',len(overcall[1],4));
   if(isSuit(last)&&last[1]!==o[1])return r(last[1]===overcall[1]?'争叫被加倍后竞争性支持':'争叫被加倍后自然新花，跳叫为邀请','防守叫牌 2');
  }
  if(overcall==='X'&&isSuit(response)&&response[1]===o[1]&&last==='X')return r('应叫性加倍：均型有实力，未叫花色有配合','附录：特殊加倍');
 }
 if(o==='1NT'&&overcall==='2C'&&response==='P'&&p.length===3){
  if(p[1]==='2D'&&/^2[HS]$/.test(last))return r('兰迪问叫后示选较长或较好高花','3.9');
  if(p[1]==='2NT'){
   const longer=(s:string,t:string)=>Array.from({length:9},(_,i)=>i+5).map(n=>`(${s} ${n} AND ${t} 4-${n-1})`).join(' OR ');
   if(last==='3C'||last==='3D')return r('兰迪问叫答叫：梅花表示红心较长，方片表示黑桃较长','3.9',{expression:last==='3C'?longer('H','S'):longer('S','H')});
   if(last==='3H'||last==='3S')return r('兰迪问叫答叫：双高等长，红心低限、黑桃高限','3.9',{expression:'(h 5 AND s 5) OR (h 6 AND s 6)'});
  }
 }
 return undefined;
}

export function forcingCompetition(o:string,a:string,call:string):Rule|undefined {
 const twoOverOne=o==='1D'&&a==='2C'||/^1[HS]$/.test(o)&&['2C','2D',...(o==='1S'?['2H']:[])].includes(a);
 if(twoOverOne&&(call==='P'||call==='X'))return r(call==='P'?'二盖一逼局后逼叫性不叫':'二盖一逼局后惩罚性加倍','1.9 / 2.9');
 return undefined;
}

export function escapeContinuation(o:string,enemy:string,p:string[]):Rule|undefined {
 if(o!=='1NT'||enemy!=='X'||p.length!==3)return undefined;
 const [,response,call]=p;
 const target:Record<string,string>={XX:'2C','2C':'2D','2D':'2H','2H':'2S'};
 if(target[response]===call)return r('惩罚加倍后完成同伴的逃叫转移，不保证所叫花色支持','3.7');
 return undefined;
}
