import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {compute,cancelAll} from '../src/engine/client';

class FakeWorker {
 static instances:FakeWorker[]=[];
 onmessage:((event:any)=>void)|null=null;
 onerror:((event:any)=>void)|null=null;
 last:any;
 terminate=vi.fn();
 constructor(){FakeWorker.instances.push(this);}
 postMessage(data:any){this.last=data;}
 complete(result:unknown){this.onmessage?.({data:{id:this.last.id,result}});}
}
beforeEach(()=>{FakeWorker.instances=[];vi.stubGlobal('Worker',FakeWorker);});
afterEach(()=>{cancelAll('test cleanup',true);vi.unstubAllGlobals();});
it('reuses the idle worker between positions instead of loading WASM for every card',async()=>{
 const a=compute('solve',[]);const worker=FakeWorker.instances[0];worker.complete(12);expect(await a).toBe(12);
 cancelAll();const b=compute('solve',[]);expect(FakeWorker.instances).toHaveLength(1);expect(worker.terminate).not.toHaveBeenCalled();worker.complete(11);expect(await b).toBe(11);
});
it('terminates active work and rejects its result before starting a new position',async()=>{
 const old=compute('line',[]);const rejection=expect(old).rejects.toThrow('计算已取消');const worker=FakeWorker.instances[0];cancelAll();await rejection;
 expect(worker.terminate).toHaveBeenCalledOnce();const fresh=compute('solve',[]);worker.complete('stale');FakeWorker.instances[1].complete(9);expect(await fresh).toBe(9);
});
it('cancels every lead worker and ignores stale batch results',async()=>{
 vi.stubGlobal('navigator',{hardwareConcurrency:8,deviceMemory:8});
 const result=compute('openingLead',[{},16,42,[],'contract','beat']);const rejected=expect(result).rejects.toThrow('计算已取消');
 FakeWorker.instances[0].complete({samples:Array(16).fill({}),attempts:16});
 await Promise.resolve();await Promise.resolve();
 expect(FakeWorker.instances.length).toBe(2);cancelAll();await rejected;
 for(const w of FakeWorker.instances){expect(w.terminate).toHaveBeenCalledOnce();w.complete({count:8,moves:[]});}
});
