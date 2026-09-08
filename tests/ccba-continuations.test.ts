import {describe,it,expect} from 'vitest';
import {inferCCBA} from '../src/engine/ccba';
import {compileExpression,hcp} from '../src/engine/lead-constraints';
import {sampleDeals,openingLeadPosition} from '../src/engine/sampling';
import {twoHandPosition} from '../src/core/two-hand';
import {boardFromHands,play} from '../src/core/cards';
import {SEATS,type Constraint,type Seat} from '../src/core/types';

// Source examples are complete partnership paths, with actual opposing passes.
const natural=(p:string)=>p.split(' ').join(' P ');
const fixtures:[string,Partial<Constraint>][]=[
 ['1C 1D 3NT',{lengths:{C:[6,7]},expression:'C AKQ'}],
 ['1C 1D 1H P',{minHcp:5,maxHcp:7,lengths:{H:[3,3],C:[0,3]}}],
 ['1C 1D 1S P',{minHcp:5,maxHcp:7,lengths:{S:[3,3],C:[0,3]}}],
 ['1C 1D 1H 2NT',{minHcp:11,maxHcp:12}],
 ['1C 1D 1S 2NT',{minHcp:11,maxHcp:12}],
 ['1C 1D 1H 2S',{lengths:{D:[5,13],S:[4,4]}}],
 ['1C 1D 1H 3H',{lengths:{D:[5,13],H:[4,4]}}],
 ['1C 1D 1S 3S',{lengths:{D:[5,13],S:[4,4]}}],
 ['1C 1D 1H 3S',{lengths:{D:[5,13],H:[4,4],S:[0,1]}}],
 ['1C 1D 1S 3H',{lengths:{D:[5,13],S:[4,4],H:[0,1]}}],
 ['1D 1H 3C',{minHcp:18,lengths:{C:[4,13]}}],
 ['1C 1S 3NT',{lengths:{C:[7,13]},expression:'C AKQ'}],
 ['1D 1H 4D',{minHcp:16,lengths:{D:[6,13],H:[4,4]}}],
 ['1C 1H 3S',{lengths:{H:[4,4],S:[0,1]}}],
 ['1H 1S 2C',{minHcp:11,maxHcp:17,lengths:{C:[4,13]}}],
 ['1H 1S 3D',{minHcp:18,lengths:{D:[4,13]}}],
 ['1H 1S 3NT',{lengths:{H:[6,13],S:[4,4]},expression:'no S AKQJ'}],
 ['1H 1S 4C',{lengths:{S:[4,4],C:[0,1]}}],
 ['1C 1H 1S P',{minHcp:5,maxHcp:7,lengths:{S:[3,4]}}],
 ['1D 1H 1S 1NT',{minHcp:6,maxHcp:10}],
 ['1C 1H 1S 3C',{lengths:{C:[4,13]}}],
 ['1C 1H 1S 3D',{lengths:{D:[5,13],H:[5,13]}}],
 ['1D 1H 1S 3H',{lengths:{H:[6,13]}}],
 ['1D 1H 1S 3S',{lengths:{H:[4,5],S:[4,4]}}],
 ['1D 1H 1S 4H',{lengths:{H:[7,13]}}],
 ['1C 1H 1S 4S',{minHcp:10,lengths:{S:[4,4]}}],
 ['1C 1S 2C 2H',{lengths:{S:[5,13],H:[4,13]}}],
 ['1D 1S 2D 3C',{lengths:{S:[5,13],C:[4,13]}}],
 ['1D 1S 2C 3H',{lengths:{S:[5,13],H:[5,13]}}],
 ['1C 1H 2C 3H',{lengths:{H:[6,13]}}],
 ['1C 1H 2H 3C',{lengths:{C:[3,13]}}],
 ['1C 1H 2H 4D',{lengths:{D:[0,1]}}],
 ['1H 1S 1NT 2H',{lengths:{H:[3,3]}}],
 ['1C 1H 2NT 3C 3H',{lengths:{H:[3,13]}}],
 ['1D 1S 2NT 3C 3H',{lengths:{H:[4,13]}}],
 ['1D 1S 2NT 3C 3S',{lengths:{S:[3,13],H:[0,3]}}],
 ['1C 1H 2NT 3C 3D',{lengths:{H:[0,2],S:[0,3]}}],
 ['1C 1S 2NT 3C 4D',{lengths:{S:[4,4]}}],
 ['1H 1S 1NT 2D 2S',{lengths:{S:[3,3]}}],
 ['1H 1S 1NT 2D 3C',{lengths:{C:[4,4]}}],
 ['1H 1S 1NT 2C 2D 2H',{lengths:{H:[3,3]}}],
 ['1H 1S 1NT 2C 2D 3H',{lengths:{S:[5,13],H:[4,4]}}],
 ['1H 1S 1NT 2C 2D 3C',{lengths:{S:[4,4],C:[6,13]}}],
 ['1H 1S 1NT 2C 2D 3NT',{lengths:{S:[5,5]},expression:'shape 5332'}],
 ['1H 1S 1NT 2NT 3C P',{lengths:{C:[6,13]}}],
 ['1NT 3H 3S',{lengths:{S:[4,4]}}],
 ['1NT 3S 4H',{lengths:{H:[4,5]}}],
 ['1NT 3H 4C',{lengths:{C:[4,6]}}],
 ['1NT 3H 4S',{lengths:{S:[5,5]}}],
 ['1NT 3S 4S',{expression:'c 4+ OR d 4+'}],
 ['1NT 2S 3C 3H 3S',{lengths:{S:[4,5]}}],
 ['1NT 2S 3C 3S 4H',{lengths:{H:[5,5]}}],
 ['2NT 3C 3H 3NT',{lengths:{H:[0,2]}}],
 ['2NT 3C 3S 4S',{lengths:{S:[3,13]}}],
 ['2NT 3C 3H 3S',{lengths:{H:[3,13]}}],
 ['2NT 3C 3D 3H 3NT 4H',{lengths:{H:[4,13],S:[4,4]}}],
 ['3NT 4C P',{lengths:{C:[7,8]}}],
 ['3NT 5C 5D',{lengths:{D:[7,8]}}],
];

describe('CCBA later-round source branches',()=>{
 it.each(fixtures)('%s applies the source constraint',(path,patch)=>{
  const result=inferCCBA(natural(path),'N');
  expect(result.error).toBeUndefined();
  expect(result.meanings.at(-1)?.applied).toBe(true);
  const seat:Seat=path.split(' ').length%2?'N':'S';
  expect(result.constraints.find(c=>c.seat===seat)).toMatchObject(patch);
 });
 it.each(['1NT 4D 4H','2NT 4H 4S','1NT 2D 3H 4H','1NT 2H 3S 3NT','1NT 2D 3H 3S','2NT 3C 3S 4NT','2NT 3C 3NT 4D','2NT 3C 3D 3H 3S 4C','3H 4C','3D 3NT','1D 1S 2C 2D','1C 1H 2NT 3NT','1C 1H 2H 4H','1H 1S 1NT 2C 2D P'])('explains %s without fabricating extra constraints',path=>{
  const result=inferCCBA(natural(path),'N');
  expect(result.error).toBeUndefined();expect(result.meanings.at(-1)?.applied).toBe(true);
 });
 it.each([
  ['1NT 2C P 2NT P 3C','E',{expression:expect.stringContaining('H 5 AND S 4-4')}],
  ['1NT 2C P 2NT P 3H','E',{expression:'h 5+ OR s 5+, (h 5 AND s 5) OR (h 6 AND s 6)'}],
  ['1NT 2C P P','W',{lengths:{C:[6,13]}}],
  ['1NT 2C X 2D','W',{lengths:{D:[6,13]}}],
  ['1C 1H X 2NT','W',{lengths:{H:[4,13]}}],
  ['1C 1H X 1NT','W',{minHcp:9,maxHcp:11}],
 ] as [string,Seat,Partial<Constraint>][])('competitive source %s',(text,seat,patch)=>{
  const result=inferCCBA(text,'N');expect(result.error).toBeUndefined();
  expect(result.meanings.at(-1)?.applied).toBe(true);
  expect(result.constraints.find(c=>c.seat===seat)).toMatchObject(patch);
 });
 it.each(['1NT X XX P 2C','1NT X 2C P 2D','1NT X 2D P 2H','1NT X 2H P 2S','1S P 2C 2H X','1D P 2C 2H P','1C X 2C X'])('handles escape/forcing/responding doubles %s',text=>{
  const result=inferCCBA(text,'N');expect(result.error).toBeUndefined();expect(result.meanings.at(-1)?.applied).toBe(true);
 });
 it('does not use natural NT advances after responder has intervened',()=>{
  const result=inferCCBA('1C 1NT 2C 2D','N');
  expect(result.meanings.at(-1)?.applied).toBe(false);
  expect(result.constraints.find(c=>c.seat==='W')?.lengths?.H).toBeUndefined();
 });
 it('keeps passed-hand Drury, and strong NT continuations on their actual seats',()=>{
  const drury=inferCCBA('P P 1S P 2C P 4H','N');
  expect(drury.constraints.find(c=>c.seat==='S')?.lengths?.H).toEqual([5,13]);
  const strong=inferCCBA(natural('2C 2D 2NT 3C 3H 3NT'),'N');
  expect(strong.constraints.find(c=>c.seat==='N')).toMatchObject({minHcp:22,maxHcp:24});
  expect(strong.constraints.find(c=>c.seat==='S')?.lengths?.H).toEqual([0,2]);
 });
 it('rotates every source constraint with the dealer',()=>{
  for(const [path] of fixtures){
   const base=inferCCBA(natural(path),'N');
   for(const dealer of SEATS){
    const rotated=inferCCBA(natural(path),dealer);
    expect(rotated.error).toBeUndefined();
    expect(rotated.constraints).toEqual(base.constraints.map(c=>({...c,seat:SEATS[(SEATS.indexOf(c.seat)+SEATS.indexOf(dealer))%4]})));
   }
  }
 });
 it.each(['lead','two-hand'])('uses inferred original-hand conditions in %s sampling',mode=>{
  // North has 12 HCP, five hearts and four clubs. East overcalls 1S.
  const board=boardFromHands(['32.AKJ98.32.K432','AKQJT.32.765.765','9876.QT7.AKQ.AT9','54.654.JT984.QJ8']);
  board.position.contract={level:4,strain:'H',declarer:'N',doubled:0};board.position.leader='E';
  // New §defense 2 rule: the advancer's 2NT after a double promises four spades.
  const cs=inferCCBA('1H 1S X 2NT','N').constraints;
  const lead=openingLeadPosition(board.position);
  const full=sampleDeals(lead,1,331,cs,undefined,1).samples[0];
  const p=mode==='lead'?lead:twoHandPosition(play(full,'SA'));
  const result=sampleDeals(p,12,20260908,cs,undefined,mode==='lead'?1:2);
  expect(result.samples).toHaveLength(12);
  for(const q of result.samples)for(const c of cs){
   const hand=[...q.hands[c.seat]!,...q.current.filter(x=>x.seat===c.seat).map(x=>x.card)];
   expect(hcp(hand)).toBeGreaterThanOrEqual(c.minHcp??0);
   expect(hcp(hand)).toBeLessThanOrEqual(c.maxHcp??37);
   for(const [s,bounds] of Object.entries(c.lengths??{}))expect(hand.filter(x=>x[0]===s).length).toBeGreaterThanOrEqual(bounds![0]);
   expect(compileExpression(c.expression??'')(hand)).toBe(true);
  }
 });
});
