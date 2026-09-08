import {describe,it,expect} from 'vitest';
import {twoHandPosition} from '../src/core/two-hand';
import {demoBoard} from '../src/core/demo';
import {play,legalCards,side,next,validate} from '../src/core/cards';
import {SEATS} from '../src/core/types';
import {sampleDeals} from '../src/engine/sampling';

describe('temporary two-hand analysis',()=>{
 it('requires the opening lead and rejects a defender turn',()=>{
  const p=demoBoard().position;
  expect(()=>twoHandPosition(p)).toThrow('先');
  const q=play(p,legalCards(p)[0]);
  expect(()=>twoHandPosition(play(q,legalCards(q)[0]))).toThrow('防守方');
 });
 it.each(SEATS)('hides both defenders for declarer %s while preserving the source and lead',declarer=>{
  const p=demoBoard().position;p.contract.declarer=declarer;p.leader=next(declarer);
  const source=play(p,legalCards(p)[0]),before=structuredClone(source),q=twoHandPosition(source);
  for(const seat of SEATS)expect(q.hands[seat]).toEqual(side(seat)===side(declarer)?source.hands[seat]:null);
  expect(q.current).toEqual(source.current);
  const result=sampleDeals(q,16,42,[]);
  for(const deal of result.samples)expect(validate(deal)).toEqual([]);
  expect(new Set(result.samples.map(x=>x.hands[p.leader]!.join(' '))).size).toBeGreaterThan(1);
  expect(source).toEqual(before);
 });
});
