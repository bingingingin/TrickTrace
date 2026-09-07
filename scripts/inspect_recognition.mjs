import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 for(const file of process.argv.slice(2)){
  const result=await page.evaluate(async file=>{
   const {default:RecognitionWorker}=await import('/src/vision/vision.worker.ts?worker');
   const source=file.startsWith('dds-')?'/artifacts/ocr-independent/':'/images/';
   const bitmap=await createImageBitmap(await(await fetch(source+encodeURIComponent(file))).blob());
   const worker=new RecognitionWorker();
   return await new Promise((resolve,reject)=>{worker.onmessage=({data})=>{if(data.result||data.error){worker.terminate();data.error?reject(Error(data.error)):resolve(data.result);}};worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.postMessage({bitmap,debug:true},[bitmap]);});
  },file);
  await fs.writeFile('artifacts/inspect-'+file+'.json',JSON.stringify(result));console.log(file,JSON.stringify(result.board.position.hands));
 }
}finally{await browser.close();}
