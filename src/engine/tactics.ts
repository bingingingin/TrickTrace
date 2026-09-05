import {SEATS,SUITS,SYMBOL,LABEL,type Position,type Line,type Tactic,type Card,type Seat,type Suit} from '../core/types';
import {play,side,suit,rank,turn,legalCards,remainingTricks,next} from '../core/cards';
import type {Solver} from './dds';
const describe=(c:Card)=>SYMBOL[suit(c)]+c.slice(1).replace('T','10');
const cardsOf=(p:Position,sideIndex:number,s:Suit)=>SEATS.filter(h=>side(h)===sideIndex).flatMap(h=>(p.hands[h]??[]).filter(c=>suit(c)===s));
// A guard disappearance is a structural fact, not in itself proof of a squeeze.
function released(p:Position,defender:Seat,discard:Card){
 const ds=side(p.contract.declarer),s=suit(discard),attack=cardsOf(p,ds,s),defense=cardsOf(p,1-ds,s);
 if(!attack.length||!defense.length)return false;
 const top=Math.max(...attack.map(rank));
 return rank(discard)>top&&defense.filter(c=>c!==discard).every(c=>rank(c)<top);
}
export function analyseTactics(solver:Solver,start:Position,line:Line,budgetMs=20000):{items:Tactic[];complete:boolean;examined:number}{
 const deadline=Date.now()+budgetMs,items:Tactic[]=[];let p=structuredClone(start),examined=0,complete=true;
 const ds=side(p.contract.declarer);const squeezeEvents:{defender:Seat;trick:number;suits:Suit[]}[]=[];
 const positions:Position[]=[];
 for(const step of line.steps){positions.push(structuredClone(p));p=play(p,step.card);}
 for(let i=0;i<line.steps.length;i++){
  if(Date.now()>deadline){complete=false;break;}
  const step=line.steps[i],before=positions[i],after=play(before,step.card),trick=before.won[0]+before.won[1]+1,s=step.seat;examined++;
  const lead=before.current[0],own=side(s)===ds;
  if(own&&lead&&suit(step.card)===before.contract.strain&&suit(step.card)!==suit(lead.card)){
   items.push({kind:'ruff',title:'将吃',trick,status:'verified',explanation:`${LABEL[s]}家没有${SYMBOL[suit(lead.card)]}，用${describe(step.card)}将吃。`,evidence:[`第 ${i+1} 张，合法跟牌检查通过`,`${step.tricks} 墩路线中的最优选择`]});
  }
  // Verified low-card duck: deliberately choose a losing card when a winning one is available.
  if(own&&lead&&before.current.length===3){const e=solver.solvePosition(before),won=after.history.at(-1)?.winner;if(won&&side(won)!==ds){const winning=e.moves.filter(m=>side(play(before,m.card).history.at(-1)!.winner)===ds);if(winning.length&&e.moves.some(m=>m.card===step.card&&m.optimal))items.push({kind:'duck',title:'忍让',trick,status:'verified',explanation:`${LABEL[s]}家选择${describe(step.card)}让对手赢此墩；立即赢墩并不是必需。`,evidence:[`可立即赢墩的牌：${winning.map(m=>describe(m.card)).join('、')}`,`忍让后仍可取得 ${step.tricks} 墩` ]});}}
  // Finesse candidates include evidence, but position alone does not prove a named tactic.
  if(own&&lead&&before.current.length===2&&side(lead.seat)===ds&&suit(step.card)===suit(lead.card)){
   const h=before.hands[s]!,higher=h.filter(c=>suit(c)===suit(step.card)&&rank(c)>rank(step.card));const missing=cardsOf(before,1-ds,suit(step.card)).filter(c=>rank(c)>rank(step.card)&&higher.some(a=>rank(a)>rank(c)));
   if(higher.length&&missing.length){const optimal=solver.solvePosition(before).moves.find(m=>m.card===step.card)?.optimal;items.push({kind:'finesse',title:'飞牌结构',trick,status:optimal?'conditional':'candidate',explanation:`同伴引${describe(lead.card)}，${LABEL[s]}家出${describe(step.card)}，保留${higher.map(describe).join('、')}，针对对方${missing.map(describe).join('、')}的位置。`,evidence:[`这一步已由 DDS 验证为${optimal?'最优':'非最优'}`,`是否为成功飞牌需结合本墩后手与进手；不代表未知牌下必然成功`]});}
  }
  if(!own&&lead&&suit(step.card)!==suit(lead.card)&&suit(step.card)!==before.contract.strain&&remainingTricks(before)<=7){
   const choices=legalCards(before);if(choices.length<2)continue;
   const e=solver.solvePosition(before),guardChoices=choices.filter(c=>released(before,s,c));
   const guardSuits=[...new Set(guardChoices.map(suit))];
   if(!guardChoices.includes(step.card)||guardSuits.length<2)continue;
   const exhaustive=choices.every(c=>guardChoices.includes(c));
   const optimalChoices=e.moves.filter(m=>m.optimal);const unavoidable=optimalChoices.every(m=>guardChoices.includes(m.card));
   if(!unavoidable)continue;
   // Validate actual accessibility of the released winners by optimal continuation for every best discard.
   const proof:string[]=[];let usable=true;
   for(const m of optimalChoices){if(Date.now()>deadline){complete=false;usable=false;break;}const q=play(before,m.card),continuation=solver.generateLine(q);let r=q;let cash=false;for(const st of continuation.steps){const old=r;r=play(r,st.card);if(r.history.length>old.history.length){const t=r.history.at(-1)!;if(side(t.winner)===ds&&suit(t.cards.find(c=>c.seat===t.winner)!.card)===suit(m.card))cash=true;}}if(!cash)usable=false;proof.push(`${LABEL[s]}垫${describe(m.card)} → 庄家 ${m.tricks} 墩${cash?'，相应花色可兑现':'；进手兑现未证实'}`);}
   const verified=exhaustive&&usable;
   items.push({kind:guardSuits.length>=3?'triple-squeeze':'simple-squeeze',title:guardSuits.length>=3?'三门挤牌':'简单挤牌',trick,status:verified?'verified':'conditional',explanation:`${LABEL[s]}家在${describe(lead.card)}上承受${guardSuits.map(x=>SYMBOL[x]).join('／')}的看守压力，垫${describe(step.card)}释放威胁张。${verified?'每一种合法垫牌都释放可兑现赢张。':'已验证最优垫牌分支；其他结构与进手仍需结合路线检查。'}`,evidence:proof});
   squeezeEvents.push({defender:s,trick,suits:guardSuits});
  }
 }
 // Composite classifications remain conditional unless the full combined strategy has been certified.
 for(let i=0;i<squeezeEvents.length;i++)for(let j=i+1;j<squeezeEvents.length;j++){
  const a=squeezeEvents[i],b=squeezeEvents[j];if(b.trick-a.trick>3)continue;
  const double=a.defender!==b.defender;items.push({kind:double?'double-squeeze':'repeating-squeeze',title:double?'双挤结构':'连续挤牌结构',trick:a.trick,status:'conditional',explanation:double?`第 ${a.trick}–${b.trick} 墩，两名防守方分别受到看守压力。`:`${LABEL[a.defender]}家在第 ${a.trick}、${b.trick} 墩连续被迫处理看守。`,evidence:['组成事件已逐步求解；组合战术的所有分支未穷尽，不作为强制双挤证明']});
 }
 const ruffs=items.filter(x=>x.kind==='ruff');if(ruffs.length>=2){const seats=new Set(line.steps.filter((st,i)=>{const q=positions[i];return side(st.seat)===ds&&q.current.length&&suit(st.card)===q.contract.strain&&suit(st.card)!==suit(q.current[0].card);}).map(st=>st.seat));if(seats.size===2)items.push({kind:'cross-ruff',title:'交叉将吃',trick:ruffs[0].trick,status:'verified',explanation:'庄家和明手在本条最优样例中分别将吃对方花色。',evidence:ruffs.map(t=>`第 ${t.trick} 墩：${t.explanation}`)});}
 return {items,complete,examined};
}
