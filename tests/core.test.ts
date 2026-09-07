import {describe,it,expect} from 'vitest';
import {boardFromHands,validate,play,legalCards,turn,score,handText} from '../src/core/cards';
import {parseDlm,parseLin,parsePbn,exportPbn} from '../src/core/formats';
import {demoBoard} from '../src/core/demo';
import {analyseOpeningLeads,sampleDeals} from '../src/engine/sampling';
describe('bridge rules',()=>{
 it('enforces following suit and awards a trumped trick',()=>{const b=boardFromHands(['A.2.-.-','K.A.-.-','Q.K.-.-','J.Q.-.-']);b.position.leader='N';b.position.contract.strain='H';let p=play(b.position,'SA');expect(legalCards(p)).toEqual(['SK']);expect(()=>play(p,'HA')).toThrow();p=play(play(play(p,'SK'),'SQ'),'SJ');expect(p.won).toEqual([1,0]);expect(turn(p)).toBe('N');});
 it('distinguishes unknown hands from voids and rejects duplicates',()=>{expect(boardFromHands(['?','-.-.-.-','?','?']).position.hands.E).toEqual([]);const p=demoBoard().position;p.hands.N!.push('SA');expect(validate(p).join()).toContain('重复');});
 it.each([[3,'NT',0,false,9,400],[4,'S',0,true,10,620],[6,'H',0,true,12,1430],[7,'NT',0,false,13,1520],[4,'S',1,false,7,-500],[4,'S',2,true,8,-1000],[2,'H',1,false,8,470],[1,'NT',2,false,8,760]] as const)('scores %i%s x%i', (l,s,d,v,t,result)=>expect(score(l,s,d,v,t)).toBe(result));
});
describe('formats',()=>{
 it('round trips full deals through PBN',()=>{const b=demoBoard();const [r]=parsePbn(exportPbn([b]));expect(r.position).toEqual(b.position);});
 it('reads a real DLM board and validates checksum',()=>{const s='[DOCUMENT]\nFrom board=1\nTo board=1\nDuplicates 01=1\nBoard 01=fnbkmmincldklcfcofoiefnapm018';const [b]=parseDlm(s);expect(handText(b.position.hands.N)).toBe('T53.AJ7.AT.AQ762');expect(()=>parseDlm(s.replace('018','019'))).toThrow('校验和');});
 it('reads BBO official handviewer example with derived east and original play',()=>{const [b]=parseLin('md|1S2389JHTD3JC237KA,S7TH4QKD678TC4569,S456KAH25D25KACJQ,|rh||ah|Board 7|sv|b|mb|p|mb|p|mb|1S|mb|2H|mb|3S|mb|p|mb|4D|mb|p|mb|4S|mb|p|mb|p|mb|p|pg||pc|SQ|pc|S2|pc|S7|pc|SA|');expect(validate(b.position)).toEqual([]);expect(b.position.contract.declarer).toBe('N');expect(b.record).toEqual(['SQ','S2','S7','SA']);});
 it('does not silently infer a fourth hand from incomplete LIN',()=>{const [b]=parseLin('md|1SA,SK,SQ,|');expect(b.position.hands.E).toBeNull();expect(validate(b.position).join()).toContain('四家');});
});
describe('unknown information',()=>{
 it('samples reproducibly, preserving known cards',()=>{const p=demoBoard().position;p.hands.E=null;p.hands.W=null;const a=sampleDeals(p,20,42,[]),b=sampleDeals(p,20,42,[]);expect(a).toEqual(b);expect(new Set(a.samples.map(x=>handText(x.hands.E))).size).toBeGreaterThan(15);for(const x of a.samples){expect(validate(x)).toEqual([]);expect(x.hands.N).toEqual(p.hands.N);}});
 it('rejects incomplete historical information instead of inventing a pool',()=>{const p=boardFromHands(['A.-.-.-','?','K.-.-.-','?']).position;expect(()=>sampleDeals(p,20,42,[])).toThrow('此前');});
 it('samples three hidden hands for single-dummy opening-lead analysis',()=>{const p=demoBoard().position;for(const s of ['N','E','S'] as const)p.hands[s]=null;const r=sampleDeals(p,20,42,[],undefined,1);expect(r.samples).toHaveLength(20);for(const q of r.samples){expect(q.hands.W).toEqual(p.hands.W);expect(validate(q)).toEqual([]);}});
 it('ranks opening leads by defeat rate without exposing hidden hands',()=>{const p=demoBoard().position;for(const s of ['N','E','S'] as const)p.hands[s]=null;const first=legalCards(p)[0];const solver={solvePosition:(q:typeof p)=>({moves:legalCards(q).map(card=>({card,tricks:card===first?11:12,loss:0,optimal:true})),tricks:11,nodes:0})};const r=analyseOpeningLeads(solver as never,p,16,7,[],'contract');expect(r.moves[0].card).toBe(first);expect(r.moves[0].success).toBe(1);expect(r.moves.slice(1).every(m=>m.success===0)).toBe(true);});
});
