import {SEATS,SUITS,STRAINS,type Position,type Card,type Evaluation,type Line,type Board,type Played} from '../core/types';
import {validate,remainingTricks,turn,side,rank,suit,next,play,legalCards,RANKS,sortCards} from '../core/cards';
export interface NativeResult{code:number;nodes:number;cards:[number,number,number,number][]}
export interface DDSModule{ccall:(name:string,ret:string,args:string[],values:string[])=>string}
export const encode=(p:Position)=>[STRAINS.indexOf(p.contract.strain),SEATS.indexOf(p.leader),...[0,1,2].flatMap(i=>p.current[i]?[SUITS.indexOf(suit(p.current[i].card)),rank(p.current[i].card)]:[0,0]),...SEATS.flatMap(s=>SUITS.map(t=>(p.hands[s]??[]).filter(c=>suit(c)===t).reduce((n,c)=>n|(1<<rank(c)),0)))].join(' ');
export function createSolver(module:DDSModule){
 const cache=new Map<string,Evaluation>();
 function solvePosition(p:Position):Evaluation{
  const errors=validate(p);if(errors.length)throw Error(errors.join('；'));
  const n=remainingTricks(p),dside=side(p.contract.declarer);
  if(!n)return {moves:[],tricks:p.won[dside],nodes:0};
  const key=encode(p)+'/'+dside+'/'+p.won.join(',');const cached=cache.get(key);if(cached)return structuredClone(cached);
  const raw=JSON.parse(module.ccall('tt_solve','string',['string'],[encode(p)])) as NativeResult;
  if(raw.code!==1)throw Error(`DDS 求解失败 (${raw.code})，请检查剩余手牌和当前墩`);
  const who=side(turn(p));const moves:Evaluation['moves']=[];
  for(const [s,r,equals,v]of raw.cards){if(v<0)throw Error('DDS 未返回精确墩数');const ranks=[r,...Array.from({length:13},(_,i)=>i+2).filter(x=>(equals&(1<<x))!==0)];for(const k of ranks){const card=`${SUITS[s]}${RANKS[k-2]}` as Card;moves.push({card,tricks:p.won[dside]+(who===dside?v:n-v),loss:0,optimal:false});}}
  const legal=legalCards(p);if(moves.length!==legal.length||legal.some(c=>!moves.some(m=>m.card===c)))throw Error('DDS 返回的合法牌集合不完整');
  const best=who===dside?Math.max(...moves.map(m=>m.tricks)):Math.min(...moves.map(m=>m.tricks));
  for(const m of moves){m.loss=Math.abs(m.tricks-best);m.optimal=m.loss===0;}
  moves.sort((a,b)=>sortCards([a.card,b.card])[0]===a.card?-1:1);
  const result={moves,tricks:best,nodes:raw.nodes};if(cache.size>12000)cache.clear();cache.set(key,result);return structuredClone(result);
 }
 function generateLine(p:Position,progress?:(n:number)=>void):Line{let q=structuredClone(p);const initialTricks=solvePosition(p).tricks;const steps:Line['steps']=[];while(remainingTricks(q)){const e=solvePosition(q),best=e.moves.filter(m=>m.optimal);const m=best[0];if(!m)throw Error('路线无法继续');steps.push({seat:turn(q),card:m.card,tricks:m.tricks,alternatives:best.map(x=>x.card)});q=play(q,m.card);progress?.(steps.length);}return {steps,final:q,initialTricks};}
 function calculateTable(p:Position,progress?:(n:number)=>void){if(p.current.length||p.history.length||p.won[0]+p.won[1]||SEATS.some(s=>p.hands[s]?.length!==13))throw Error('20 格结果表需要完整初始 52 张牌');const table:number[][]=[];for(const strain of STRAINS){const row=[];for(const declarer of SEATS){const q=structuredClone(p);q.contract={...q.contract,strain,declarer};q.leader=next(declarer);row.push(solvePosition(q).tricks);progress?.(table.length*4+row.length);}table.push(row);}return table;}
 function calculatePar(table:number[][],board:Pick<Board,'dealer'|'vulnerability'>){const input=[SEATS.indexOf(board.dealer),['None','All','NS','EW'].indexOf(board.vulnerability),...table.flat()].join(' ');const r=JSON.parse(module.ccall('tt_par','string',['string'],[input]));if(r.code!==1)throw Error('Par 计算失败');return r as {score:number;contracts:string[]};}
 function analysePlay(p:Position,cards:Card[]){let q=structuredClone(p);return cards.map(card=>{const e=solvePosition(q),move=e.moves.find(m=>m.card===card);if(!move)throw Error('记录中存在非法出牌 '+card);const item={...move,seat:turn(q)};q=play(q,card);return item;});}
 return {solvePosition,generateLine,calculateTable,calculatePar,analysePlay};
}
export type Solver=ReturnType<typeof createSolver>;
