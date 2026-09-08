import {legalCards,play,rank,remainingTricks,side,suit,turn} from '../core/cards';
import {SUITS,type Card,type Constraint,type Position,type Trick} from '../core/types';
import {twoHandPosition} from '../core/two-hand';
import type {Solver} from './dds';
import {chooseOptimal} from './line-policy';
import {sampleDeals} from './sampling';

export interface TwoHandLineResult {
 samples:number;attempts:number;seed:number;tricks:Trick[];startTrick:number;
 declarerTricks:number;decisions:{seat:string;card:Card;samples:number;success:number;expected:number}[];
}

export function generateTwoHandLine(solver:Solver,source:Position,amount:number,seed:number,constraints:Constraint[],objective:'contract'|'tricks',progress?:(n:number)=>void):TwoHandLineResult {
 if(!Number.isInteger(amount)||amount<16||amount>2000)throw Error('样本数需在 16–2000 之间');
 const hidden=twoHandPosition(source);
 const dealt=sampleDeals(hidden,amount,seed,constraints);
 let particles=dealt.samples,example=structuredClone(particles[0]);
 const decisions:TwoHandLineResult['decisions']=[],declaring=side(source.contract.declarer),target=source.contract.level+6;
 let count=0;
 while(remainingTricks(example)){
  let card:Card;
  if(side(turn(example))===declaring){
   const stats=new Map(legalCards(example).map(c=>[c,{card:c,sum:0,made:0}]));
   for(const p of particles)for(const m of solver.solvePosition(p).moves){const s=stats.get(m.card)!;s.sum+=m.tricks;s.made+=Number(m.tricks>=target);}
   const options=[...stats.values()].sort((a,b)=>(objective==='contract'?b.made-a.made||b.sum-a.sum:b.sum-a.sum||b.made-a.made)||rank(a.card)-rank(b.card)||SUITS.indexOf(suit(a.card))-SUITS.indexOf(suit(b.card)));
   const best=options[0];if(!best)throw Error('路线无法继续');card=best.card;
   decisions.push({seat:turn(example),card,samples:particles.length,success:best.made/particles.length,expected:best.sum/particles.length});
  }else{
   const best=chooseOptimal(example,solver.solvePosition(example).moves);
   if(!best)throw Error('防守路线无法继续');card=best.card;
  }
  // Condition only on the displayed public card, including follow-suit legality.
  particles=particles.filter(p=>legalCards(p).includes(card)).map(p=>play(p,card));
  example=play(example,card);
  progress?.(++count);
 }
 return {samples:dealt.samples.length,attempts:dealt.attempts,seed,tricks:example.history.slice(source.history.length),startTrick:source.history.length+1,declarerTricks:example.won[declaring],decisions};
}
