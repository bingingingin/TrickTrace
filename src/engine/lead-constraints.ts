import { SEATS, SUITS, type Card, type Constraint, type Seat } from '../core/types';
import { rank, suit } from '../core/cards';

export const hcp = (hand: Card[]) => hand.reduce((n, c) => n + Math.max(0, rank(c) - 10), 0);
export function range(text: string, max: number): [number, number] {
  const t = text.trim();
  if (!t) return [0, max];
  const m = /^(\d+)(?:\s*-\s*(\d+)|(\+))?$/.exec(t);
  const upper = /^-(\d+)$/.exec(t);
  const r: [number, number] = upper ? [0, +upper[1]] : m ? [+m[1], m[3] ? max : +(m[2] ?? m[1])] : [NaN, NaN];
  if (!r.every(Number.isInteger) || r[0] < 0 || r[0] > r[1] || r[1] > max) throw Error(`范围“${text}”无效，请输入 0–${max} 内的数值、12-17 或 5+`);
  return r;
}
const inside = (n: number, r: [number, number]) => n >= r[0] && n <= r[1];
export function compileExpression(text: string): (hand: Card[]) => boolean {
  const clauses = text.trim().toLowerCase().split(/[,，;；\n]+/).filter(x => x.trim()).map(clause => clause.split(/\s+or\s+/i).map(raw => {
    const t = raw.trim();
    if (t === 'balanced' || t === '均型') return (h: Card[]) => ['4333','4432','5332'].includes(SUITS.map(s=>h.filter(c=>suit(c)===s).length).sort((a,b)=>b-a).join(''));
    let m = /^hcp\s+(.+)$/.exec(t);
    if (m) {const r=range(m[1],37); return (h:Card[])=>inside(hcp(h),r);}
    m = /^shape\s+([\d\s]+)$/.exec(t);
    if (m) {const shapes=m[1].trim().split(/\s+/); if(shapes.some(s=>!/^\d{4}$/.test(s)||[...s].reduce((a,b)=>a+ +b,0)!==13))throw Error('shape 需为合计 13 张的四位牌型，如 4432 5332'); const patterns=shapes.map(s=>[...s].sort().join('')); return(h:Card[])=>patterns.includes(SUITS.map(s=>h.filter(c=>suit(c)===s).length).sort().join(''));}
    m = /^(\d+)[=-](\d+)[=-](\d+)[=-](\d+)$/.exec(t);
    if(m){const lengths=m.slice(1).map(Number);if(lengths.reduce((a,b)=>a+b,0)!==13)throw Error('精确牌型须合计 13 张');return(h:Card[])=>SUITS.every((s,i)=>h.filter(c=>suit(c)===s).length===lengths[i]);}
    m = /^(no\s+)?(s|h|d|c|spades|hearts|diamonds|clubs)\s+(?:(hcp)\s+)?(.+)$/.exec(t);
    if(m){const s=m[2][0].toUpperCase(),negative=!!m[1],value=m[4].toUpperCase();
      if(/^[AKQJT23456789]+$/.test(value)&&/[AKQJT]/.test(value)){if(m[3])throw Error('花色点力需为数字范围');return(h:Card[])=>[...value].every(r=>negative?!h.includes(`${s}${r}` as Card):h.includes(`${s}${r}` as Card));}
      if(negative)throw Error('no 后使用花色及牌点，如 no clubs Q');const r=range(value,m[3]?10:13),points=!!m[3];return(h:Card[])=>inside(points?hcp(h.filter(c=>suit(c)===s)):h.filter(c=>suit(c)===s).length,r);
    }
    throw Error(`无法识别条件“${raw}”`);
  }));
  return h => clauses.every(alternatives => alternatives.some(test => test(h)));
}
export function validateConstraints(cs: Constraint[]) {
  if(!Array.isArray(cs))throw Error('约束必须为数组');
  for(const c of cs){
    if(!c||!SEATS.includes(c.seat))throw Error('约束方位必须为 N/E/S/W');
    const lo=c.minHcp??0,hi=c.maxHcp??37;
    if(!Number.isInteger(lo)||!Number.isInteger(hi)||lo<0||hi>37||lo>hi)throw Error(`${c.seat} 大牌点范围无效`);
    let min=0,max=0;
    for(const s of SUITS){const r=c.lengths?.[s]??[0,13];if(!Array.isArray(r)||r.length!==2||!r.every(Number.isInteger)||r[0]<0||r[1]>13||r[0]>r[1])throw Error(`${c.seat} ${s} 长度范围无效`);min+=r[0];max+=r[1];}
    if(min>13||max<13)throw Error(`${c.seat} 四门长度范围无法组成 13 张牌`);
    if(c.partnershipHcp){const [a,b]=c.partnershipHcp;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b>40||a>b)throw Error('联手点力范围无效');}
    compileExpression(c.expression??'');
  }
}

// Limited natural opening inference: never infer conventions or later calls silently.
export function inferOpening(auction: string, dealer: Seat): {constraints: Constraint[]; notes: string[]} {
  const calls=auction.toUpperCase().replace(/PASS/g,'P').replace(/♠/g,'S').replace(/♥/g,'H').replace(/♦/g,'D').replace(/♣/g,'C').split(/[\s,，]+/).filter(Boolean);
  if(!calls.length)throw Error('请先输入叫牌');
  if(calls.some(c=>! /^(P|X|XX|[1-7](S|H|D|C|NT))$/.test(c)))throw Error('叫牌使用 P、X、XX、1C … 7NT，以空格分隔');
  let highest=-1,bidder=-1,doubled=0,passes=0,ended=false;
  calls.forEach((call,i)=>{
    const who=(SEATS.indexOf(dealer)+i)%4;
    if(ended)throw Error('叫牌已结束，后面不能再有叫品');
    if(call==='P'){passes++;if(passes===(highest<0?4:3))ended=true;return;}
    passes=0;
    if(call==='X'||call==='XX'){
      if(highest<0||(call==='X'?(doubled!==0||who%2===bidder%2):(doubled!==1||who%2!==bidder%2)))throw Error('加倍或再加倍不合法');
      doubled=call==='X'?1:2;return;
    }
    const level=(Number(call[0])-1)*5+['C','D','H','S','NT'].indexOf(call.slice(1));
    if(level<=highest)throw Error('定约叫品必须高于此前叫品');highest=level;bidder=who;doubled=0;
  });
  const index=calls.findIndex(c=>c!=='P');if(index<0)return{constraints:[],notes:['全为不叫，未推断点力。']};
  const call=calls[index],seat=SEATS[(SEATS.indexOf(dealer)+index)%4];
  const c:Constraint={seat};
  if(call==='1NT')Object.assign(c,{minHcp:15,maxHcp:17,expression:'balanced'});
  else if(call==='2NT')Object.assign(c,{minHcp:20,maxHcp:21,expression:'balanced'});
  else if(/^1[SH]$/.test(call))Object.assign(c,{minHcp:12,maxHcp:21,lengths:{[call[1]]:[5,13]}});
  else if(/^1[CD]$/.test(call))Object.assign(c,{minHcp:12,maxHcp:21,lengths:{[call[1]]:[3,13]}});
  else throw Error(`当前模板不解释 ${call}，请手动设置，避免误判约定叫`);
  return{constraints:[c],notes:[`${seat} ${call}：按自然制、五张高花、强无将模板推断。`, '仅解释首次开叫；不叫、应叫、再叫、争叫及约定叫均未自动推断，请逐家补充。']};
}
