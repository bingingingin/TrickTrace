import {type Position,type Constraint,type Card,type SampleResult} from '../core/types';
export type LeadMode='beat'|'exact';
export interface LeadResult extends Omit<SampleResult,'moves'> {
 mode:LeadMode; workers:number; samplingMs:number; solveMs:number;
 moves:{card:Card;expected:number|null;success:number;interval:[number,number]}[];
}
export interface LeadBatch {count:number;moves:{card:Card;sum:number;success:number}[]}
export function mergeLeadBatches(batches:LeadBatch[],attempts:number,seed:number,mode:LeadMode,objective:string):LeadResult{
 const stats=new Map<Card,{sum:number;success:number}>();let n=0;
 for(const batch of batches){n+=batch.count;for(const m of batch.moves){const s=stats.get(m.card)??{sum:0,success:0};s.sum+=m.sum;s.success+=m.success;stats.set(m.card,s);}}
 if(!n)throw Error('没有可汇总的模拟结果');
 const moves=[...stats].map(([card,s])=>{
  const success=s.success/n,z=1.96,denom=1+z*z/n,center=(success+z*z/(2*n))/denom,half=z*Math.sqrt(success*(1-success)/n+z*z/(4*n*n))/denom;
  return {card,expected:mode==='exact'?s.sum/n:null,success,interval:[Math.max(0,center-half),Math.min(1,center+half)] as [number,number]};
 });
 moves.sort((a,b)=>(mode==='exact'&&objective==='tricks'?(a.expected!-b.expected!):b.success-a.success)|| (mode==='exact'?(a.expected!-b.expected!):0)||a.card.localeCompare(b.card));
 return {samples:n,attempts,seed,mode,workers:0,samplingMs:0,solveMs:0,moves};
}
const active=new Set<(message:string)=>void>();
export function cancelLeadPool(message:string){for(const cancel of [...active])cancel(message);}
export function computeOpeningLead(args:unknown[],progress:((n:number)=>void)|undefined,timeout:number):Promise<LeadResult>{
 const [p,amount,seed,constraints,objective,mode='beat']=args as [Position,number,number,Constraint[],string,LeadMode?];
 return new Promise((resolve,reject)=>{
  const workers:Worker[]=[];let finished=false,seq=0;
  const cleanup=()=>{finished=true;clearTimeout(timer);active.delete(cancel);workers.forEach(w=>w.terminate());};
  const cancel=(message:string)=>{if(finished)return;cleanup();reject(Error(message));};
  const timer=setTimeout(()=>cancel('计算超时，可重试或缩小分析范围'),timeout);active.add(cancel);
  const create=()=>{const w=new Worker(new URL('./solver.worker.ts',import.meta.url),{type:'module'});workers.push(w);return w;};
  const call=(w:Worker,method:string,values:unknown[])=>new Promise<any>((yes,no)=>{
   const id=++seq;
   w.onerror=e=>{no(Error(e.message||'首攻求解线程加载失败'));};
   w.onmessage=({data})=>{if(data.id!==id||finished)return;if(data.error)no(Error(data.error));else yes(data.result);};
   w.postMessage({id,method,args:values});
  });
  void (async()=>{
   try{
    if(mode!=='beat'&&mode!=='exact')throw Error('未知首攻求解模式');
    const start=performance.now(),first=create();
    const {samples,attempts}=await call(first,'leadDeals',[p,amount,seed,constraints]) as {samples:Position[];attempts:number};
    const samplingMs=performance.now()-start,solveStart=performance.now();
    const memory=(navigator as Navigator & {deviceMemory?:number}).deviceMemory??4;
    const count=Math.min(memory<=2?2:memory<=4?4:8,Math.max(1,(navigator.hardwareConcurrency||2)-1),Math.ceil(samples.length/8));
    for(let i=1;i<count;i++)create();
    let cursor=0,done=0;const batches:LeadBatch[]=[];
    await Promise.all(workers.map(async w=>{
     while(cursor<samples.length&&!finished){const chunk=samples.slice(cursor,cursor+8);cursor+=chunk.length;
      const batch=await call(w,'leadBatch',[chunk,mode]) as LeadBatch;
      batches.push(batch);done+=batch.count;progress?.(done);
     }
    }));
    if(finished)return;
    const result=mergeLeadBatches(batches,attempts,seed,mode,objective);
    result.workers=count;result.samplingMs=samplingMs;result.solveMs=performance.now()-solveStart;
    cleanup();resolve(result);
   }catch(e){cancel(e instanceof Error?e.message:String(e));}
  })();
 });
}
