import {SEATS,type Board} from './types';
const cycle:Board['vulnerability'][]=['None','NS','EW','All','NS','EW','All','None','EW','All','None','NS','All','None','NS','EW'];
export function boardMetadata(number:number){
 if(!Number.isInteger(number)||number<1||number>99)throw Error('牌副编号请输入 1–99 的整数');
 return {number,dealer:SEATS[(number-1)%4],vulnerability:cycle[(number-1)%16]};
}
export function nextBoardNumber(boards:Board[]){return Array.from({length:99},(_,i)=>i+1).find(n=>!boards.some(b=>b.number===n))??1;}
