import {it,expect,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSolver,type Solver} from '../src/engine/dds';
import {sampleDeals,randomSource} from '../src/engine/sampling';
import {constrainedDealer} from '../src/engine/constrained-dealer';
import {solveLeadBatch} from '../src/engine/lead-batch';
import {mergeLeadBatches} from '../src/engine/lead-pool';
import {boardFromHands,next} from '../src/core/cards';
import {SEATS,STRAINS,type Card} from '../src/core/types';
let solver:Solver;
beforeAll(async()=>{const {default:create}=await import(/* @vite-ignore */new URL('../public/dds/dds.mjs',import.meta.url).href);solver=createSolver(await create({wasmBinary:readFileSync('public/dds/dds.wasm')}));},60000);
it('threshold solving matches exact outcomes for every lead across strains, levels and seats',()=>{
 const text=readFileSync('vendor/dds/hands/list10.txt','utf8');const deals=[...text.matchAll(/PBN[^\n]*"N:([^"\n]+)"/g)];
 for(let i=0;i<10;i++){
  const p=boardFromHands(deals[i][1].split(/\s+/)).position;p.contract.strain=STRAINS[i%5];p.contract.declarer=SEATS[i%4];p.leader=next(p.contract.declarer);
  const exact=solver.solvePosition(p);
  for(const level of [1,3,5,7]){p.contract.level=level;expect(solver.solveLeadBeat(p).sort()).toEqual(exact.moves.filter(m=>m.tricks<level+6).map(m=>m.card).sort());}
 }
},120000);
it('weighted shape construction is uniform over labelled deals, with impossible bounds rejected',()=>{
 const played={N:[],E:[],S:[],W:[]},voids={N:new Set<string>(),E:new Set<string>(),S:new Set<string>(),W:new Set<string>()};
 const deal=constrainedDealer(['SA','SK','HA','HK'],['N','E'],[2,2],[],played,voids,randomSource(42));
 const counts=new Map<string,number>();for(let i=0;i<6000;i++){const h=deal()[0].sort().join(',');counts.set(h,(counts.get(h)??0)+1);}
 expect(counts.size).toBe(6);for(const n of counts.values())expect(n).toBeGreaterThan(850);
 expect(()=>constrainedDealer(['SA','SK','HA','HK'],['N','E'],[2,2],[{seat:'N',lengths:{S:[3,3]}}],played,voids,randomSource(42))).toThrow('冲突');
});
it('length constrained samples meet bounds and batch merging is order independent',()=>{
 const text=readFileSync('vendor/dds/hands/list10.txt','utf8');const m=/PBN[^\n]*"N:([^"\n]+)"/.exec(text)!;
 const p=boardFromHands(m[1].split(/\s+/)).position;p.contract.declarer='N';p.leader='E';p.hands.N=null;p.hands.S=null;p.hands.W=null;
 const cs=[{seat:'S' as const,lengths:{S:[5,5] as [number,number]}}];
 const result=sampleDeals(p,24,42,cs,undefined,1);expect(result.attempts).toBe(24);
 for(const q of result.samples){expect(q.hands.S!.filter(c=>c[0]==='S')).toHaveLength(5);expect(new Set(SEATS.flatMap(s=>q.hands[s] as Card[])).size).toBe(52);}
 expect(sampleDeals(p,24,42,cs,undefined,1)).toEqual(result);
 const a=solveLeadBatch(solver,result.samples.slice(0,12),'beat'),b=solveLeadBatch(solver,result.samples.slice(12),'beat');
 expect(mergeLeadBatches([a,b],24,42,'beat','contract')).toEqual(mergeLeadBatches([b,a],24,42,'beat','contract'));
 expect(mergeLeadBatches([a,b],24,42,'beat','contract').moves.every(m=>m.expected===null)).toBe(true);
},120000);
