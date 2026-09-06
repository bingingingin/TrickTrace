import {describe,it,expect} from 'vitest';
import {boardMetadata,nextBoardNumber} from '../src/core/board-number';
import {demoBoard} from '../src/core/demo';
import {exportPbn,parsePbn} from '../src/core/formats';

describe('duplicate board numbering',()=>{
 it('uses the standard dealer and vulnerability cycles across all 99 boards',()=>{
  const vul=['None','NS','EW','All','NS','EW','All','None','EW','All','None','NS','All','None','NS','EW'];
  for(let n=1;n<=99;n++)expect(boardMetadata(n)).toEqual({number:n,dealer:['N','E','S','W'][(n-1)%4],vulnerability:vul[(n-1)%16]});
 });
 it.each([0,100,1.5,NaN])('rejects invalid board %s',n=>expect(()=>boardMetadata(n)).toThrow());
 it('preserves the board number and explicit metadata overrides in PBN',()=>{
  const b=demoBoard();Object.assign(b,boardMetadata(17));b.vulnerability='All';b.dealer='W';
  const r=parsePbn(exportPbn([b]))[0];expect(r.number).toBe(17);expect(r.vulnerability).toBe('All');expect(r.dealer).toBe('W');
 });
 it('chooses the first unused board number',()=>{const b=demoBoard();expect(nextBoardNumber([{...b,number:1},{...b,number:3}])).toBe(2);});
});
