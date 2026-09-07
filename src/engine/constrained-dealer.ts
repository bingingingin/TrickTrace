import {SUITS,type Card,type Seat,type Constraint} from '../core/types';
import {suit} from '../core/cards';

// Count labelled-card assignments, not shapes. Weighting by multinomial counts
// preserves uniformity over every deal satisfying the length/void bounds.
export function constrainedDealer(pool:Card[], seats:Seat[], sizes:number[], constraints:Constraint[], played:Record<Seat,Card[]>, voids:Record<Seat,Set<string>>, rng:()=>number) {
 const groups=SUITS.map(s=>pool.filter(c=>suit(c)===s));
 const bounds=SUITS.map(s=>seats.map(seat=>{
  const used=played[seat].filter(c=>suit(c)===s).length;
  let lo=0,hi=voids[seat].has(s)?0:13;
  for(const c of constraints.filter(c=>c.seat===seat)){const r=c.lengths?.[s];if(r){lo=Math.max(lo,r[0]-used);hi=Math.min(hi,r[1]-used);}}
  return [lo,hi];
 }));
 const factorial=[1];for(let i=1;i<=13;i++)factorial[i]=factorial[i-1]*i;
 function allocations(k:number,remaining:number[]){
  const out:{counts:number[];weight:number}[]=[];
  function walk(i:number,left:number,counts:number[],denom:number){
   if(i===seats.length){if(!left)out.push({counts,weight:factorial[groups[k].length]/denom});return;}
   const [lo,hi]=bounds[k][i];
   for(let n=lo;n<=Math.min(hi,left,remaining[i]);n++)walk(i+1,left-n,[...counts,n],denom*factorial[n]);
  }
  walk(0,groups[k].length,[],1);return out;
 }
 const memo=new Map<string,number>();
 function count(k:number,remaining:number[]):number{
  if(k===4)return remaining.every(n=>n===0)?1:0;
  const key=k+':'+remaining.join(',');const cached=memo.get(key);if(cached!==undefined)return cached;
  const n=allocations(k,remaining).reduce((sum,a)=>sum+a.weight*count(k+1,remaining.map((r,i)=>r-a.counts[i])),0);
  memo.set(key,n);return n;
 }
 const total=count(0,sizes);
 if(!total)throw Error('花色长度、缺门与剩余牌数的约束互相冲突');
 return ()=>{
  const hands=seats.map(()=>[] as Card[]);let remaining=[...sizes];
  for(let k=0;k<4;k++){
   const options=allocations(k,remaining).map(a=>({...a,mass:a.weight*count(k+1,remaining.map((r,i)=>r-a.counts[i]))})).filter(a=>a.mass>0);
   let draw=rng()*options.reduce((n,a)=>n+a.mass,0),chosen=options[options.length-1];
   for(const a of options){draw-=a.mass;if(draw<0){chosen=a;break;}}
   const cards=[...groups[k]];for(let i=cards.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
   let offset=0;chosen.counts.forEach((n,i)=>{hands[i].push(...cards.slice(offset,offset+n));offset+=n;});
   remaining=remaining.map((n,i)=>n-chosen.counts[i]);
  }
  return hands;
 };
}
