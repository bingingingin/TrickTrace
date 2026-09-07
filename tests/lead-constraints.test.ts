import {describe,it,expect} from 'vitest';
import {compileExpression,inferOpening,range,validateConstraints} from '../src/engine/lead-constraints';
import {parseHand,validate} from '../src/core/cards';
import {demoBoard} from '../src/core/demo';
import {sampleDeals} from '../src/engine/sampling';
describe('lead constraints',()=>{
 it('parses ranges and rejects inverted or out of bounds ranges',()=>{expect(range('15+',37)).toEqual([15,37]);expect(range('-7',37)).toEqual([0,7]);expect(()=>range('20-12',37)).toThrow();expect(()=>range('14',13)).toThrow();});
 it('checks balanced, exact shape, honours, suit HCP and OR conditions',()=>{const hand=parseHand('AKQJ.432.432.432')!;expect(compileExpression('balanced, hcp 10, s AK, no clubs Q, s hcp 10, h 5+ OR s 4, shape 4333, 4-3-3-3')(hand)).toBe(true);expect(compileExpression('s 5+ OR h 5+')(hand)).toBe(false);expect(()=>compileExpression('madeup')).toThrow();});
 it('validates contradictory hand lengths and seat identifiers',()=>{expect(()=>validateConstraints([{seat:'N',lengths:{S:[7,13],H:[7,13]}}])).toThrow();expect(()=>validateConstraints([{seat:'Z'} as never])).toThrow();});
 it('maps the opener using dealer and keeps pass inference unknown',()=>{expect(inferOpening('P P 1NT P 3NT P P P','N').constraints).toEqual([{seat:'S',minHcp:15,maxHcp:17,expression:'balanced'}]);expect(()=>inferOpening('2C P','N')).toThrow();});
 it('rejects illegal auctions before inferring constraints',()=>{expect(()=>inferOpening('1NT P 1C','N')).toThrow();expect(()=>inferOpening('P P P P 1NT','N')).toThrow();expect(()=>inferOpening('1NT P X','N')).toThrow();});
 it('enforces expressions and partnership HCP on actual generated deals',()=>{const p=demoBoard().position; p.hands.N=null;p.hands.E=null;p.hands.S=null;const r=sampleDeals(p,16,123,[{seat:'S',minHcp:10,maxHcp:20,expression:'balanced',partnershipHcp:[20,32]}],undefined,1);expect(r.samples).toHaveLength(16);for(const q of r.samples){expect(validate(q)).toEqual([]);expect(compileExpression('balanced')(q.hands.S!)).toBe(true);}});
});
