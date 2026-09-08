import {describe,it,expect} from 'vitest';
import {inferCCBA} from '../src/engine/ccba';
import {compileExpression,hcp} from '../src/engine/lead-constraints';
import {sampleDeals} from '../src/engine/sampling';
import {boardFromHands} from '../src/core/cards';
import type {Board,Card,Constraint,Seat} from '../src/core/types';

function check(text:string,seat:Seat,patch:Partial<Constraint>,vulnerability?:Board['vulnerability']){
 const result=inferCCBA(text,'N',vulnerability);
 expect(result.error,text).toBeUndefined();
 expect(result.meanings.at(-1)?.applied,text).toBe(true);
 expect(result.constraints.find(c=>c.seat===seat),text).toMatchObject(patch);
}
const natural=(...calls:string[])=>calls.join(' P ');
describe('CCBA v2.2 extended source fixtures',()=>{
 const fixtures:[string,Seat,Partial<Constraint>][]=[
  ['1C 1H 1S','S',{lengths:{S:[5,13]}}],
  ['1C 1H X','S',{minHcp:6}],
  ['1C 2D 3D','S',{lengths:{H:[5,13],S:[5,13]}}],
  ['1S 2H 2S','S',{lengths:{S:[2,13]}}],
  ['1H 1S 2S','S',{lengths:{H:[3,13]}}],
  ['1H 1S 3S','S',{lengths:{H:[4,13],S:[0,1]}}],
  ['1C X XX','S',{minHcp:11}],
  ['1H X 1NT','S',{minHcp:7,maxHcp:11,lengths:{H:[3,4]}}],
  ['1S X 2S','S',{minHcp:5,maxHcp:8,lengths:{S:[3,4]}}],
  ['1C X 2NT','S',{lengths:{C:[5,13]}}],
  ['1D X 2C','S',{minHcp:6,maxHcp:8,lengths:{C:[6,13]}}],
  ['1S 1NT X','S',{minHcp:10}],
  ['1H 1NT 2C','S',{minHcp:6,maxHcp:10,lengths:{C:[6,13],H:[0,2]}}],
  ['1C 1NT 2C','S',{lengths:{H:[4,13],S:[4,13]}}],
  ['1C 2C 2H','S',{lengths:{C:[4,13]}}],
  ['1C 2C 2S','S',{lengths:{D:[5,13]}}],
  ['1D 2D 2H','S',{lengths:{C:[5,13]}}],
  ['1D 2D 2S','S',{lengths:{D:[4,13]}}],
  ['1H 2H 2S','S',{lengths:{H:[3,13]}}],
  ['1S 2S 3H','S',{lengths:{S:[3,13]}}],
  ['1H 2NT 3D','S',{lengths:{S:[5,13]}}],
  ['1S 2NT 3C','S',{lengths:{H:[5,13]}}],
  ['1C 2NT 3D','S',{lengths:{S:[5,13]}}],
  ['1D 2NT 3C','S',{lengths:{D:[4,13]}}],
  ['1S 2NT','E',{lengths:{C:[5,13],D:[5,13]}}],
  ['1C 2NT','E',{lengths:{D:[5,13],H:[5,13]}}],
  ['1C P P 2NT','W',{minHcp:19,maxHcp:20}],
  ['1C X P 1NT','W',{minHcp:6,maxHcp:9}],
  ['1C X P 2H','W',{minHcp:8,maxHcp:10}],
  ['1C 1H P 2C','W',{lengths:{H:[3,13]}}],
  ['1C 1H P 3C','W',{lengths:{H:[4,13]}}],
  ['1C 1NT P 2D','W',{lengths:{H:[5,13]}}],
  ['1NT 2C P 3H','W',{lengths:{H:[4,13]}}],
  ['2D 4D','E',{minHcp:17,lengths:{H:[5,13],S:[5,13]}}],
  ['2H 4C','E',{minHcp:17,lengths:{C:[5,13],S:[5,13]}}],
  ['2S 4D','E',{minHcp:17,lengths:{D:[5,13],H:[5,13]}}],
  ['1NT X 2C','S',{lengths:{D:[5,13]}}],
  ['1NT X 2D','S',{lengths:{H:[5,13]}}],
  ['1NT X 2H','S',{lengths:{S:[5,13]}}],
  ['1NT X XX','S',{lengths:{C:[4,13]}}],
  ['1NT 2C 2H','S',{lengths:{C:[5,13],D:[5,13]}}],
  ['1NT 2C 2S','S',{lengths:{C:[5,13],D:[5,13]}}],
  ['1NT 2H 3C','S',{minHcp:9,lengths:{C:[5,13]}}],
  ['1NT 2H 3H','S',{expression:'S 4+'}],
  ['1NT 2NT 3C','S',{lengths:{H:[4,13],S:[4,13]}}],
  ['1NT 2NT 3D','S',{lengths:{H:[5,13],S:[5,13]}}],
  ['1NT 2NT','E',{minHcp:12,lengths:{C:[5,13],D:[5,13]}}],
  ['1NT 2H 2NT P 3C P 3NT','S',{lengths:{H:[0,3],S:[0,3]}}],
  ['1NT 2S 2NT P 3C P 3S','S',{expression:'H 4+'}],
  ['1C P 1H X XX','N',{lengths:{H:[3,3]}}],
  ['1D P 1S 2C X','N',{lengths:{S:[3,3]}}],
  ['1NT P 2D X P','N',{lengths:{H:[0,2]}}],
  ['1NT P 2H X XX','N',{lengths:{S:[3,5]}}],
  ['1NT P 2C X 2D','N',{lengths:{D:[5,6],H:[0,3],S:[0,3]}}],
  ['1NT P 2C 2D X','N',{lengths:{H:[4,5],S:[4,5]}}],
  ['2C X XX','S',{minHcp:7}],
  ['2C 2S 3D','S',{minHcp:6,lengths:{D:[6,13]}}],
  ['3H','N',{minHcp:5,maxHcp:10,lengths:{H:[7,13]}}],
  ['4D','N',{minHcp:5,maxHcp:10,lengths:{D:[7,13]}}],
  [natural('1D','2C','2NT'),'N',{expression:'balanced, hcp 12-14 OR hcp 18-19'}],
  [natural('1C','2C','2NT'),'N',{expression:'balanced, hcp 12-14 OR hcp 18-19'}],
  [natural('1D','2C','3H'),'N',{minHcp:14,lengths:{C:[4,13],H:[0,1]}}],
  [natural('1C','1NT','3D'),'N',{minHcp:16,lengths:{C:[6,13],D:[5,13]}}],
  [natural('1C','1D','2H'),'N',{minHcp:18,lengths:{H:[3,13]}}],
  [natural('1C','1D','3H'),'N',{minHcp:18,lengths:{D:[4,13],H:[0,1]}}],
  [natural('1C','1H','2NT','3D'),'S',{lengths:{D:[5,13],H:[4,13]}}],
  [natural('1D','1S','2NT','3H'),'S',{lengths:{H:[5,13],S:[5,13]}}],
  [natural('1C','1H','2D','2H'),'S',{minHcp:5,maxHcp:7,lengths:{H:[5,13]}}],
  [natural('1D','1H','2C','3C'),'S',{minHcp:8,maxHcp:11,lengths:{C:[4,13]}}],
  [natural('1C','1H','1S','2S'),'S',{minHcp:7,maxHcp:9,lengths:{S:[4,4]}}],
  [natural('1C','1H','2H','2NT','3D'),'N',{lengths:{H:[3,3],D:[4,4]}}],
  [natural('1S','2NT','4C'),'N',{lengths:{C:[5,13]},expression:'C KQ'}],
  [natural('1H','1NT','2C','2S'),'S',{minHcp:10,maxHcp:12,lengths:{C:[4,13]}}],
  [natural('1H','1NT','2H','2S'),'S',{lengths:{C:[5,13],D:[5,13]}}],
  [natural('1S','1NT','2C','3S'),'S',{minHcp:10,maxHcp:12,lengths:{S:[3,3]}}],
  [natural('1NT','2S','3C','3D'),'S',{lengths:{D:[6,13]}}],
  [natural('1NT','2S','3C','3H'),'S',{lengths:{C:[5,13],D:[5,13],H:[0,1]}}],
  [natural('1NT','2S','3C','3NT'),'S',{minHcp:14,maxHcp:15,lengths:{H:[2,2],S:[2,2]}}],
  [natural('1NT','2C','2H','3NT'),'S',{lengths:{S:[4,4],H:[0,3]}}],
  [natural('1NT','2C','2S','4C'),'S',{lengths:{S:[4,13],C:[0,1]}}],
  [natural('2C','2D','3S'),'N',{minHcp:22,lengths:{S:[4,4],D:[5,13]}}],
  [natural('2C','2NT','3NT'),'N',{minHcp:22,maxHcp:23,lengths:{H:[0,3],S:[0,3]}}],
  [natural('2C','2D','2NT','3D'),'S',{lengths:{H:[5,13]}}],
  [natural('2H','2NT','3NT'),'N',{expression:'H AKQ'}],
  [natural('2NT','3C','3D','4C'),'S',{lengths:{C:[4,13],D:[4,13]}}],
  [natural('2NT','3C','3D','4H'),'S',{lengths:{C:[6,13]}}],
  [natural('2NT','3C','3D','3H','3NT'),'N',{lengths:{S:[0,3],H:[4,4]}}],
  [natural('2NT','3C','3NT','4H'),'S',{lengths:{S:[6,6],H:[4,4]}}],
  [natural('2NT','3S','3NT','4H'),'S',{lengths:{H:[0,1]}}],
  [natural('2NT','3D','3H','3S'),'S',{lengths:{H:[5,13],S:[4,13]}}],
  [natural('3NT','4D','4NT'),'N',{}],
 ];
 it.each(fixtures)('%s interprets the actual auction role',(text,seat,patch)=>check(text,seat,patch));
 it('uses vulnerability and the actual seat side, not dealer side',()=>{
  check('1S P 3D','S',{minHcp:11,maxHcp:12},'NS');
  check('1S P 3D','S',{minHcp:9,maxHcp:12},'EW');
  check('1H P 3H','S',{minHcp:3,maxHcp:6},'None');
  check('1NT 2NT','E',{minHcp:14},'EW');
  check('1NT 2NT','E',{minHcp:12},'NS');
  check('1C 1NT 2C','S',{lengths:{H:[5,13],S:[5,13]}},'NS');
 });
 it('does not guess after multiple interventions or turn cue bids into natural suits',()=>{
  const result=inferCCBA('1H 1S 2C 2S 3D','N');expect(result.meanings.at(-1)?.applied).toBe(false);
  expect(inferCCBA('1H 2NT 3D','N').constraints.find(c=>c.seat==='S')?.lengths?.D).toBeUndefined();
  expect(inferCCBA('1NT 2H 2NT','N').constraints.find(c=>c.seat==='S')).toBeUndefined();
 });
 it('only infers specific artificial pass sequences, not every pass',()=>{
  expect(inferCCBA('1NT P 2S P 3C P P','N').constraints.find(c=>c.seat==='S')?.lengths?.C).toEqual([6,13]);
  expect(inferCCBA('1C P P','N').constraints.find(c=>c.seat==='S')).toBeUndefined();
 });
 it.each([['1D','1H','2C','2S'],['1C','1H','1S','2D'],['1D','1H','1S','2C'],['1C','1D','1H','1S']])('recognizes fourth-suit forcing without assigning the artificial suit',(...calls)=>{
  const result=inferCCBA(natural(...calls),'N');expect(result.error).toBeUndefined();expect(result.meanings.at(-1)?.description).toContain('第四花色');expect(result.constraints.find(c=>c.seat==='S')?.lengths?.[calls[3][1] as 'S']).toBeUndefined();
 });
});

describe('CCBA expressions are enforced, not display-only',()=>{
 const cards=(s:string)=>s.split(' ') as Card[];
 it('retains AND/OR parentheses and rejects malformed conditions',()=>{
  const test=compileExpression('(hcp 0-7 AND s 2) OR (hcp 9-11 AND s 4)');
  expect(test(cards('S2 S3 H2'))).toBe(true);
  expect(test(cards('SA SK S2 S3 HQ H2'))).toBe(true);
  expect(test(cards('SA SK HQ'))).toBe(false);
  for(const text of ['(s 4','s 4)','s 4 OR ','cards SA SA 1','keys s 6'])expect(()=>compileExpression(text),text).toThrow();
 });
 it('counts keys once, and differentiates queen, aces and controls',()=>{
  expect(compileExpression('keys s 2')(cards('SA SK HQ'))).toBe(true);
  expect(compileExpression('keys s 2')(cards('SA HK HQ'))).toBe(false);
  expect(compileExpression('aces 2, controls 5')(cards('SA HA SK'))).toBe(true);
 });
 it.each(['5C','5D','5H','5S'])('RKCB answer %s produces a filter',(answer)=>{
  const result=inferCCBA(natural('1S','2NT','3S','4NT',answer),'N');
  expect(result.error).toBeUndefined();expect(result.meanings.at(-1)?.applied).toBe(true);
  const filter=compileExpression(result.constraints.find(c=>c.seat==='N')!.expression!);
  const keys:Card[]=['SA','HA','DA','CA','SK'];
  for(let n=0;n<=5;n++)for(const queen of [false,true]){
   const hand=[...keys.slice(0,n),...(queen?['SQ' as Card]:[])];
   expect(filter(hand),`${answer} n=${n} q=${queen}`).toBe(answer==='5C'?[1,4].includes(n):answer==='5D'?[0,3].includes(n):[2,5].includes(n)&&(answer==='5S'?queen:!queen));
  }
 });
 it('keeps quantitative NT separate and handles Gerber and trump queen enquiries',()=>{
  const quant=inferCCBA(natural('1NT','2D','2H','4NT'),'N');expect(quant.meanings.at(-1)?.description).toContain('示量');
  check(natural('2NT','4C','4H'),'N',{expression:expect.stringContaining('aces 1')});
  check(natural('1S','2NT','3S','4NT','5C','5D','5S'),'N',{});
  const result=inferCCBA(natural('1S','2NT','3S','4NT','5C','5D','5S'),'N');expect(result.constraints.find(c=>c.seat==='N')?.expression).toContain('no S Q');
 });
 it('recognizes RKCB after a super-transfer and excludes the void ace in exclusion RKCB',()=>{
  check(natural('1NT','2D','3H','4NT','5D'),'N',{});
  expect(inferCCBA(natural('1NT','2D','3H','4NT','5D'),'N').constraints.find(c=>c.seat==='N')?.expression).toContain('keys H 0');
  check(natural('1S','2NT','3H','5C'),'S',{lengths:{C:[0,0]}});
  const result=inferCCBA(natural('1S','2NT','3H','5C','5H'),'N');
  expect(result.error).toBeUndefined();expect(result.meanings.at(-1)?.description).toContain('缺门关键张');
  const test=compileExpression(result.constraints.find(c=>c.seat==='N')!.expression!);
  expect(test(cards('CA SA'))).toBe(true);expect(test(cards('CA SA SQ'))).toBe(false);expect(test(cards('CA SA SK'))).toBe(false);
 });
 it('gambling NT rejects outside aces/kings and excess outside queens',()=>{
  const expression=inferCCBA('3NT','N').constraints[0].expression!;
  const test=compileExpression(expression);
  expect(test(cards('CA CK CQ CJ C9 C8 C7 S2 S3 H2 H3 D2 D3'))).toBe(true);
  expect(test(cards('CA CK CQ CJ C9 C8 C7 SA S3 H2 H3 D2 D3'))).toBe(false);
  expect(test(cards('CA CK CQ CJ C9 C8 C7 SQ S3 HQ H3 D2 D3'))).toBe(false);
 });
 it('filters sampled deals using disjoint HCP and key counts',()=>{
  const p=boardFromHands(['AKQJ.T98.765.432','T98.765.432.AKQJ','765.432.AKQJ.T98','432.AKQJ.T98.765']).position;
  p.hands.N=null;p.hands.S=null;p.hands.W=null;p.leader='E';
  const cs:Constraint[]=[{seat:'S',expression:'(hcp 0-7 OR hcp 12-14), keys s 1'}];
  const result=sampleDeals(p,24,219,cs,undefined,1);expect(result.samples).toHaveLength(24);
  for(const q of result.samples){const h=q.hands.S!;expect(hcp(h)<=7||hcp(h)>=12&&hcp(h)<=14).toBe(true);expect(h.filter(c=>['SA','HA','DA','CA','SK'].includes(c))).toHaveLength(1);}
 });
});
