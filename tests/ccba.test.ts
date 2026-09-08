import {describe,it,expect} from 'vitest';
import {inferCCBA,applyOverrides,CCBA_VERSION} from '../src/engine/ccba';
import {type Seat,type Constraint} from '../src/core/types';
const auction=(...bids:string[])=>bids.join(' P ');
function hand(bids:string[],seat:Seat='N',dealer:Seat='N'){
 const r=inferCCBA(auction(...bids),dealer);expect(r.error).toBeUndefined();return r.constraints.find(c=>c.seat===seat);
}
describe('official Xinrui CCBA v2.2 inference',()=>{
 it('uses CCBA not simplified 2/1 and preserves nonstandard NT distributions',()=>{
  expect(CCBA_VERSION).toContain('CCBA v2.2');
  expect(hand(['1H'])).toMatchObject({minHcp:11,maxHcp:21,lengths:{H:[5,13]}});
  expect(hand(['1NT'])).toMatchObject({minHcp:15,maxHcp:17,lengths:{S:[0,5],H:[0,5],C:[0,6],D:[0,6]}});
  expect(hand(['1NT'])?.expression).toBeUndefined();expect(hand(['2NT'])?.minHcp).toBe(19);
 });
 it('interprets transfers rather than treating the bid suit as held suit',()=>{
  expect(hand(['1NT','2D'],'S')).toMatchObject({lengths:{H:[5,13]}});
  expect(hand(['1NT','2D'],'S')?.lengths?.D).toBeUndefined();
  expect(hand(['1NT','2H'],'S')?.lengths?.S).toEqual([5,13]);
  expect(hand(['2NT','4D'],'S')?.lengths?.H).toEqual([6,13]);
 });
 it('does not invent HCP or club length for Stayman and correctly follows denial and Smolen',()=>{
  expect(hand(['1NT','2C'],'S')).toBeUndefined();
  expect(hand(['1NT','2C','2D'])?.lengths?.S).toEqual([0,3]);
  expect(hand(['1NT','2C','2D'])?.lengths?.H).toEqual([0,3]);
  expect(hand(['1NT','2C','2D','3H'],'S')?.lengths).toEqual({H:[4,4],S:[5,5]});
 });
 it('maps seats from dealer and treats passed-hand Drury differently from game-forcing 2/1',()=>{
  const r=inferCCBA('P P 1S P 2C','E');
  expect(r.constraints.find(c=>c.seat==='W')).toMatchObject({minHcp:0,lengths:{S:[5,13]}});
  expect(r.constraints.find(c=>c.seat==='E')).toMatchObject({minHcp:8,lengths:{S:[3,13]}});
  expect(hand(['1S','2C'],'S')).toMatchObject({minHcp:13,lengths:{C:[3,13]}});
 });
 it('implements CCBA weak jump and distinguishes Bergen/Jacoby/Splinter',()=>{
  expect(hand(['1H','2S'],'S')).toMatchObject({minHcp:4,maxHcp:6,lengths:{S:[6,13]}});
  expect(hand(['1S','3C'],'S')).toMatchObject({minHcp:7,maxHcp:9,lengths:{S:[4,13]}});
  expect(hand(['1S','3C'],'S')?.lengths?.C).toBeUndefined();
  expect(hand(['1S','2NT'],'S')).toMatchObject({minHcp:13,lengths:{S:[4,13]}});
  expect(hand(['1S','4C'],'S')).toMatchObject({minHcp:13,maxHcp:15,lengths:{S:[4,13],C:[0,1]}});
 });
 it('narrows opener ranges through rebids and keeps the v2.2 jump-to-game meaning',()=>{
  expect(hand(['1C','1H','2NT'])).toMatchObject({minHcp:18,maxHcp:19,lengths:{C:[3,13]}});
  expect(hand(['1D','1S','4S'])).toMatchObject({minHcp:18,maxHcp:19,lengths:{S:[4,4],D:[3,13]}});
  expect(hand(['1C','1D','2D'])).toMatchObject({minHcp:12,maxHcp:15,lengths:{D:[4,4]}});
  expect(hand(['1S','1NT','2C'])).toMatchObject({minHcp:12,maxHcp:17,lengths:{C:[3,13]}});
  expect(hand(['1H','1NT','2C'])?.lengths?.C).toEqual([2,13]);
 });
 it('supports strong 2C waiting without incorrect upper limits and uses updated NT bands',()=>{
  expect(hand(['2C','2D'],'S')).toBeUndefined();
  expect(hand(['2C','2D','2NT'])).toMatchObject({minHcp:22,maxHcp:24});
  expect(hand(['2C','2D','3NT'])).toMatchObject({minHcp:25,maxHcp:27});
 });
 it('does not confuse puppet Stayman and ordinary Stayman',()=>{
  expect(hand(['2NT','3C','3H'])?.lengths?.H).toEqual([5,5]);
  expect(hand(['2NT','3C','3D'])?.expression).toContain('h 4 OR s 4');
  expect(hand(['2NT','3C','3D','3H'],'S')?.lengths?.S).toEqual([4,4]);
 });
 it('recomputes without stale conditions on undo or clearing and validates all calls',()=>{
  expect(hand(['1NT','2C','2D'])?.lengths?.S).toEqual([0,3]);
  expect(hand(['1NT','2C'])?.lengths?.S).toEqual([0,5]);
  expect(inferCCBA('','N').constraints).toEqual([]);
  expect(inferCCBA('1S P 1H','N').error).toBeTruthy();
  expect(inferCCBA('P P P P 1C','N').error).toBeTruthy();
  expect(inferCCBA('不叫 不叫 1n','N').constraints[0]).toMatchObject({seat:'S',minHcp:15});
 });
 it('supports direct/balancing NT overcalls and prevents unopposed inference after interference',()=>{
  expect(inferCCBA('1C 1NT','N').constraints.find(c=>c.seat==='E')).toMatchObject({minHcp:15,maxHcp:18});
  expect(inferCCBA('1C P P 1NT','N').constraints.find(c=>c.seat==='W')).toMatchObject({minHcp:12,maxHcp:15});
  const r=inferCCBA('1S 2C 2NT','N');expect(r.constraints.find(c=>c.seat==='S')).toBeUndefined();expect(r.meanings.at(-1)?.description).toContain('自然邀请');
 });
 it('does not translate adjusted points into HCP or cue bids into natural suit lengths',()=>{
  expect(inferCCBA('1H 2H','N').constraints.find(c=>c.seat==='E')).toMatchObject({lengths:{S:[5,13]},expression:'c 5+ OR d 5+'});
  expect(inferCCBA('1H 2H','N').constraints.find(c=>c.seat==='E')?.minHcp).toBeUndefined();
 });
 it('overrides only edited fields, preserving other automatic fields and explicit unrestricted ranges',()=>{
  const manual:Constraint[]=[{seat:'N',minHcp:14,maxHcp:18,lengths:{H:[0,13]}}];
  const base=inferCCBA('1NT P 2C P 2D','N').constraints;
  const merged=applyOverrides(base,manual).find(c=>c.seat==='N')!;
  expect(merged).toMatchObject({minHcp:14,maxHcp:18,lengths:{H:[0,13],S:[0,3]}});
  expect(applyOverrides(inferCCBA('1NT','N').constraints,manual)[0].lengths?.S).toEqual([0,5]);
  expect(base[0].minHcp).toBe(15);
 });
});
