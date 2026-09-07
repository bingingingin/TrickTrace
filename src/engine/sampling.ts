import {SEATS,SUITS,type Position,type Constraint,type SampleResult,type Seat,type Card} from '../core/types';
import {deck,validate,turn,side,suit,rank,legalCards,remainingTricks,next} from '../core/cards';
import type {Solver} from './dds';
import {compileExpression,validateConstraints,hcp} from './lead-constraints';
export function randomSource(seed:number){let a=seed|0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function sampleDeals(p:Position,amount:number,seed:number,constraints:Constraint[],progress?:(n:number)=>void,minimumKnown=2){
 validateConstraints(constraints);
 const predicates=constraints.map(c=>compileExpression(c.expression??''));
 const errors=validate(p,false);if(errors.length)throw Error(errors.join('；'));
 const unknown=SEATS.filter(s=>p.hands[s]===null);if(!unknown.length)throw Error('没有未知手牌，请使用四明手精确分析');
 const known=SEATS.filter(s=>p.hands[s]!==null);if(known.length<minimumKnown)throw Error(minimumKnown===1?'单明手首攻分析需要录入首攻方手牌':'实验分析至少需要两家可见手牌');
 const cardsPerHand=p.hands[known[0]]!.length+p.current.filter(c=>c.seat===known[0]).length;
 const knownCards=[...SEATS.flatMap(s=>p.hands[s]??[]),...p.current.map(c=>c.card),...p.history.flatMap(t=>t.cards.map(c=>c.card))];
 const pool=deck().filter(c=>!knownCards.includes(c));
 const needed=unknown.reduce((n,s)=>n+cardsPerHand-p.current.filter(c=>c.seat===s).length,0);
 if(pool.length!==needed)throw Error('未知牌池无法确定：残局需补齐此前所有已出牌记录，或输入完整初始牌局后回放');
 const voids:Record<Seat,Set<string>>={N:new Set(),E:new Set(),S:new Set(),W:new Set()};
 for(const cs of [...p.history.map(t=>t.cards),p.current])if(cs.length)for(const c of cs.slice(1))if(suit(c.card)!==suit(cs[0].card))voids[c.seat].add(suit(cs[0].card));
 const rng=randomSource(seed),samples:Position[]=[];let attempts=0;
 const limit=Math.max(10000,amount*1000);
 while(samples.length<amount&&attempts<limit){attempts++;const shuffled=[...pool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const q=structuredClone(p);let offset=0;for(const s of unknown){const n=cardsPerHand-p.current.filter(c=>c.seat===s).length;q.hands[s]=shuffled.slice(offset,offset+n);offset+=n;}
  if(unknown.some(s=>q.hands[s]!.some(c=>voids[s].has(suit(c)))))continue;
  // HCP and length constraints describe the original hand, including cards already played.
  if(constraints.some(c=>{const h=[...q.hands[c.seat]!,...p.current.filter(x=>x.seat===c.seat).map(x=>x.card),...p.history.flatMap(t=>t.cards.filter(x=>x.seat===c.seat).map(x=>x.card))];const hcp=h.reduce((n,x)=>n+Math.max(0,rank(x)-10),0);return hcp<(c.minHcp??0)||hcp>(c.maxHcp??37)||SUITS.some(s=>{const length=h.filter(x=>suit(x)===s).length,range=c.lengths?.[s];return range&&(length<range[0]||length>range[1]);});}))continue;
  if(constraints.some((c,i)=>{const hand=[...q.hands[c.seat]!,...p.current.filter(x=>x.seat===c.seat).map(x=>x.card),...p.history.flatMap(t=>t.cards.filter(x=>x.seat===c.seat).map(x=>x.card))];if(!predicates[i](hand))return true;if(c.partnershipHcp){const partner=next(c.seat,2),other=[...q.hands[partner]!,...p.current.filter(x=>x.seat===partner).map(x=>x.card),...p.history.flatMap(t=>t.cards.filter(x=>x.seat===partner).map(x=>x.card))],points=hcp(hand)+hcp(other);return points<c.partnershipHcp[0]||points>c.partnershipHcp[1];}return false;}))continue;
  samples.push(q);progress?.(samples.length);
 }
 if(!samples.length)throw Error('没有找到符合条件的分布，请检查大牌点、牌型、缺门与历史记录的约束');
 return {samples,attempts};
}
export function analyseSamples(solver:Solver,p:Position,amount:number,seed:number,constraints:Constraint[],objective:'contract'|'tricks',progress?:(n:number)=>void):SampleResult{
 if(!Number.isInteger(amount)||amount<16||amount>2000)throw Error('样本数需在 16–2000 之间');
 if(p.hands[turn(p)]===null)throw Error('当前轮到未知方；请先录入该方实际出牌再分析');
 const {samples,attempts}=sampleDeals(p,amount,seed,constraints);const target=p.contract.level+6,declarerTurn=side(turn(p))===side(p.contract.declarer);
 const stats=new Map<Card,{sum:number;success:number}>();legalCards(p).forEach(c=>stats.set(c,{sum:0,success:0}));
 samples.forEach((q,i)=>{const e=solver.solvePosition(q);for(const m of e.moves){const stat=stats.get(m.card)!;stat.sum+=m.tricks;stat.success+=(declarerTurn?m.tricks>=target:m.tricks<target)?1:0;}progress?.(i+1);});
 const n=samples.length;const moves=[...stats.entries()].map(([card,s])=>{const success=s.success/n,z=1.96,denom=1+z*z/n,center=(success+z*z/(2*n))/denom,half=z*Math.sqrt(success*(1-success)/n+z*z/(4*n*n))/denom;return {card,expected:s.sum/n,success,interval:[Math.max(0,center-half),Math.min(1,center+half)] as [number,number]};});
 moves.sort((a,b)=>objective==='contract'?b.success-a.success||(declarerTurn?b.expected-a.expected:a.expected-b.expected):declarerTurn?b.expected-a.expected:a.expected-b.expected);
 return {samples:n,attempts,seed,moves};
}
export function analyseOpeningLeads(solver:Solver,p:Position,amount:number,seed:number,constraints:Constraint[],objective:'contract'|'tricks',progress?:(n:number)=>void):SampleResult{
 if(p.current.length||p.history.length||p.won[0]+p.won[1])throw Error('单明手首攻分析只适用于未出牌的初始局面');
 if(p.leader!==next(p.contract.declarer))throw Error('首攻方必须是庄家的下家');
 const known=SEATS.filter(s=>p.hands[s]!==null);
 if(known.length!==1||known[0]!==p.leader||p.hands[p.leader]?.length!==13)throw Error('请只保留首攻方的 13 张手牌，其余三家设为 ?');
 if(!Number.isInteger(amount)||amount<16||amount>5000)throw Error('模拟次数需在 16–5000 之间');
 const {samples,attempts}=sampleDeals(p,amount,seed,constraints,undefined,1),target=p.contract.level+6;
 const stats=new Map<Card,{sum:number;success:number}>();legalCards(p).forEach(c=>stats.set(c,{sum:0,success:0}));
 samples.forEach((q,i)=>{const e=solver.solvePosition(q);for(const m of e.moves){const stat=stats.get(m.card)!;stat.sum+=m.tricks;stat.success+=m.tricks<target?1:0;}progress?.(i+1);});
 const n=samples.length,moves=[...stats.entries()].map(([card,s])=>{const success=s.success/n,z=1.96,denom=1+z*z/n,center=(success+z*z/(2*n))/denom,half=z*Math.sqrt(success*(1-success)/n+z*z/(4*n*n))/denom;return {card,expected:s.sum/n,success,interval:[Math.max(0,center-half),Math.min(1,center+half)] as [number,number]};});
 moves.sort((a,b)=>objective==='contract'?b.success-a.success||a.expected-b.expected:a.expected-b.expected||b.success-a.success);
 return {samples:n,attempts,seed,moves};
}
