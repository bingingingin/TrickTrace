import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSolver} from '../src/engine/dds';
import {generateTwoHandLine} from '../src/engine/two-hand-line';
import {demoBoard} from '../src/core/demo';
import {legalCards,play,side} from '../src/core/cards';
import {SEATS} from '../src/core/types';

it('finishes a full conditional route without changing or reading the stored defenders',async()=>{
 const {default:create}=await import(/* @vite-ignore */ new URL('../public/dds/dds.mjs',import.meta.url).href);
 const solver=createSolver(await create({wasmBinary:readFileSync('public/dds/dds.wasm')}));
 const initial=demoBoard().position,source=play(initial,legalCards(initial)[0]),before=structuredClone(source);
 const result=generateTwoHandLine(solver,source,16,42,[],'contract');
 expect(result.tricks).toHaveLength(13);
 expect(result.tricks[0].cards[0]).toEqual(source.current[0]);
 expect(new Set(result.tricks.flatMap(t=>t.cards.map(c=>c.card))).size).toBe(52);
 expect(result.decisions).toHaveLength(26);
 expect(result.decisions.every(d=>d.samples>0&&d.success>=0&&d.success<=1)).toBe(true);
 expect(source).toEqual(before);
 const hidden=structuredClone(source);
 for(const seat of SEATS)if(side(seat)!==side(source.contract.declarer))hidden.hands[seat]=null;
 expect(generateTwoHandLine(solver,hidden,16,42,[],'contract')).toEqual(result);
},120000);
