import {createSolver,type DDSModule} from './dds';
import {analyseOpeningLeads,analyseSamples} from './sampling';
import {analyseTactics} from './tactics';
let solver:ReturnType<typeof createSolver>|undefined;
let ready:Promise<void>|undefined;
function init(){return ready??= (async()=>{const url=new URL('/dds/dds.mjs',self.location.origin).href;const {default:create}=await import(/* @vite-ignore */url);const module=await create({locateFile:(p:string)=>'/dds/'+p}) as DDSModule;solver=createSolver(module);})();}
self.onmessage=async({data})=>{const {id,method,args}=data;try{await init();const progress=(n:number)=>self.postMessage({id,progress:n});let result;
 if(method==='line'){const line=solver!.generateLine(args[0],progress);result={line,tactics:analyseTactics(solver!,args[0],line)};}
 else if(method==='table'){const table=solver!.calculateTable(args[0],progress);result={table,par:solver!.calculatePar(table,args[1])};}
 else if(method==='sample')result=analyseSamples(solver!,args[0],args[1],args[2],args[3],args[4],progress);
 else if(method==='openingLead')result=analyseOpeningLeads(solver!,args[0],args[1],args[2],args[3],args[4],progress);
 else if(method==='analyse')result=solver!.analysePlay(args[0],args[1]);
 else result=solver!.solvePosition(args[0]);
 self.postMessage({id,result});
 }catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}};
