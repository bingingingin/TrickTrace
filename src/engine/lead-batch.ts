import type {Position,Card} from '../core/types';
import {legalCards} from '../core/cards';
import type {Solver} from './dds';
import type {LeadBatch,LeadMode} from './lead-pool';
export function solveLeadBatch(solver:Solver,samples:Position[],mode:LeadMode):LeadBatch{
 const stats=new Map<Card,{sum:number;success:number}>();
 for(const p of samples){
  for(const card of legalCards(p))if(!stats.has(card))stats.set(card,{sum:0,success:0});
  if(mode==='beat'){for(const card of solver.solveLeadBeat(p))stats.get(card)!.success++;}
  else {for(const m of solver.solvePosition(p).moves){const s=stats.get(m.card)!;s.sum+=m.tricks;s.success+=Number(m.tricks<p.contract.level+6);}}
 }
 return {count:samples.length,moves:[...stats].map(([card,s])=>({card,...s}))};
}
