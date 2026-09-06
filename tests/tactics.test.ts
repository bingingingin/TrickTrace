import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSolver,type Solver} from '../src/engine/dds';
import {analyseTactics} from '../src/engine/tactics';
import {boardFromHands} from '../src/core/cards';
let solver:Solver;
beforeAll(async()=>{const {default:create}=await import(new URL('../public/dds/dds.mjs',import.meta.url).href);solver=createSolver(await create({wasmBinary:readFileSync('public/dds/dds.wasm')}));});
const ending=(hands:string[])=>{const p=boardFromHands(hands).position;p.contract.strain='NT';p.contract.declarer='S';p.leader='S';return p;};
it('verifies an intentional club throw-in against every spade return',()=>{
 const p=ending(['AQ.-.-.2','K2.-.-.A','43.-.-.3','65.-.-.4']);
 const line=solver.generateLine(p);expect(line.initialTricks).toBe(2);expect(line.steps[0].card).toBe('C3');
 const items=analyseTactics(solver,p,line).items;expect(items.some(t=>t.kind==='endplay'&&t.status==='verified'&&t.evidence.length===2)).toBe(true);
});
it('recognizes a simple squeeze with a length guard Kx over AQ',()=>{
 const p=ending(['-.AQ.-.2','-.K2.-.A','-.3.A.K','-.54.-.3']);
 const line=solver.generateLine(p);expect(line.initialTricks).toBe(3);
 const items=analyseTactics(solver,p,line).items;expect(items.some(t=>t.kind==='simple-squeeze'&&t.status==='verified')).toBe(true);
});
it('does not call following suit a squeeze',()=>{
 const p=ending(['-.AQ.-.2','-.K2.2.-','-.3.A.K','-.54.-.3']);
 expect(analyseTactics(solver,p,solver.generateLine(p)).items.filter(t=>t.kind==='simple-squeeze')).toEqual([]);
});
it('does not label a plain cashout as an endplay',()=>{
 const p=ending(['AK.-.-.-','QJ.-.-.-','T9.-.-.-','87.-.-.-']);
 expect(analyseTactics(solver,p,solver.generateLine(p)).items.filter(t=>t.kind==='endplay')).toEqual([]);
});
it('identifies the linked shared-heart guards in a positional double-squeeze ending',()=>{
 const p=ending(['Q.A5.-.-','-.T8.-.J','-.2.9.5','A.K6.-.-']);
 const line=solver.generateLine(p);expect(line.initialTricks).toBe(3);
 const items=analyseTactics(solver,p,line).items;
 expect(items.some(t=>t.kind==='double-squeeze')).toBe(true);
 expect(items.filter(t=>t.kind==='simple-squeeze').every(t=>t.status==='conditional')).toBe(true);
});
