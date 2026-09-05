import {SEATS,SUITS,type Seat,type Card,type Suit,type Position,type Played,type Board,type Strain} from './types';
export const RANKS='23456789TJQKA';
export const next=(s:Seat,n=1):Seat=>SEATS[(SEATS.indexOf(s)+n)%4];
export const side=(s:Seat):0|1=>SEATS.indexOf(s)%2 as 0|1;
export const rank=(c:Card)=>RANKS.indexOf(c[1])+2;
export const suit=(c:Card)=>c[0] as Suit;
export const deck=():Card[]=>SUITS.flatMap(s=>[...RANKS].map(r=>`${s}${r}` as Card));
export const sortCards=(cards:Card[])=>[...cards].sort((a,b)=>SUITS.indexOf(suit(a))-SUITS.indexOf(suit(b))||rank(b)-rank(a));
export function parseHand(text:string):Card[]|null {
 if(text.trim()==='?')return null;
 const parts=text.toUpperCase().replace(/10/g,'T').replace(/[♠]/g,'S').replace(/[♥]/g,'H').replace(/[♦]/g,'D').replace(/[♣]/g,'C').trim();
 const tokens=parts.includes('.')?parts.split('.'):parts.replace(/[SHDC]/g,' ').trim().split(/\s+/);
 if(tokens.length!==4)throw Error('每手牌按 ♠ ♥ ♦ ♣ 顺序输入四组，以点或空格分隔，缺门用 -，未知整手用 ?');
 return tokens.flatMap((t,i)=>[...t.replace(/-/g,'')].map(r=>{if(!RANKS.includes(r))throw Error(`无效点数：${r}`);return `${SUITS[i]}${r}` as Card;}));
}
export function handText(cards:Card[]|null){return cards===null?'?':SUITS.map(s=>sortCards(cards).filter(c=>suit(c)===s).map(c=>c[1]).join('')||'-').join('.');}
export const turn=(p:Position)=>next(p.leader,p.current.length);
export function winner(cards:Played[],trump:Strain):Seat{
 let w=cards[0];for(const c of cards.slice(1)){if(suit(c.card)===suit(w.card)?rank(c.card)>rank(w.card):suit(c.card)===trump)w=c;}return w.seat;
}
export function legalCards(p:Position):Card[]{const h=p.hands[turn(p)];if(h===null)throw Error('轮到未知手牌：请录入实际出牌，或先补齐四家牌');const follows=p.current.length?h.filter(c=>suit(c)===suit(p.current[0].card)):[];return sortCards(follows.length?follows:h);}
export function validate(p:Position,full=true):string[]{
 const errors:string[]=[];const seen=new Set<string>();
 if(!SEATS.includes(p.leader)||!SEATS.includes(p.contract.declarer))errors.push('方位无效');
 if(!['S','H','D','C','NT'].includes(p.contract.strain)||!Number.isInteger(p.contract.level)||p.contract.level<1||p.contract.level>7)errors.push('定约无效');
 if(p.current.length>3)errors.push('当前墩最多三张牌');
 const entries=[...SEATS.flatMap(seat=>(p.hands[seat]??[]).map(card=>({seat,card}))),...p.current,...p.history.flatMap(t=>t.cards)];
 for(const {card} of entries){if(!/^[SHDC][2-9TJQKA]$/.test(card))errors.push(`无效牌：${card}`);if(seen.has(card))errors.push(`重复牌：${card}`);seen.add(card);}
 for(const [i,c] of p.current.entries())if(c.seat!==next(p.leader,i))errors.push('当前墩出牌方位不连续');
 const counts=SEATS.map(s=>p.hands[s]===null?null:p.hands[s]!.length+p.current.filter(c=>c.seat===s).length);
 const known=counts.filter(c=>c!==null) as number[];
 if(full&&counts.includes(null))errors.push('精确求解需要四家手牌，请切换两家牌实验分析或补齐未知手牌');
 if(new Set(known).size>1)errors.push('各家剩余张数与当前墩不一致');
 if(known.some(c=>c>13))errors.push('每家最多 13 张牌');
 if(p.won.some(n=>!Number.isInteger(n)||n<0)||p.won[0]+p.won[1]+Math.max(0,...known)>13)errors.push('已得墩数与剩余张数冲突');
 if(p.history.length>p.won[0]+p.won[1])errors.push('历史墩数超过累计墩数');
 return [...new Set(errors)];
}
export function play(p:Position,card:Card,observed=false):Position{
 const q=structuredClone(p),s=turn(q),h=q.hands[s];
 if(h===null){if(!observed)throw Error('不能替未知手牌决定出牌');if([...SEATS.flatMap(x=>q.hands[x]??[]),...q.current.map(x=>x.card),...q.history.flatMap(t=>t.cards.map(x=>x.card))].includes(card))throw Error('这张牌已经出现或属于已知手牌');}
 else{if(!legalCards(q).includes(card))throw Error('该牌不在手中，或必须跟出首引花色');q.hands[s]=h.filter(c=>c!==card);}
 q.current.push({seat:s,card});
 if(q.current.length===4){const w=winner(q.current,q.contract.strain);q.history.push({cards:q.current,winner:w});q.won[side(w)]++;q.leader=w;q.current=[];}
 return q;
}
export const remainingTricks=(p:Position)=>Math.ceil((SEATS.reduce((n,s)=>n+(p.hands[s]?.length??0),0)+p.current.length)/4);
export function boardFromHands(texts:string[],name='新牌局'):Board{
 const hands=Object.fromEntries(SEATS.map((s,i)=>[s,parseHand(texts[i])])) as Position['hands'];
 return {id:crypto.randomUUID(),name,dealer:'N',vulnerability:'None',auction:[],record:[],warnings:[],position:{hands,contract:{level:3,strain:'NT',declarer:'S',doubled:0},leader:'W',current:[],won:[0,0],history:[]}};
}
export function score(level:number,strain:Strain,doubled:0|1|2,vulnerable:boolean,tricks:number):number{
 const over=tricks-level-6,mult=2**doubled;if(over<0){const down=-over;if(!doubled)return -down*(vulnerable?100:50);const penalty=vulnerable?200+(down-1)*300:100+Math.min(2,down-1)*200+Math.max(0,down-3)*300;return -penalty*(doubled===2?2:1);}
 const base=(strain==='NT'?40+(level-1)*30:level*(strain==='C'||strain==='D'?20:30))*mult;
 return base+(base>=100?(vulnerable?500:300):50)+(level===6?(vulnerable?750:500):level===7?(vulnerable?1500:1000):0)+(doubled?50*(doubled===2?2:1):0)+over*(doubled?(vulnerable?200:100)*(doubled===2?2:1):(strain==='C'||strain==='D'?20:30));
}
