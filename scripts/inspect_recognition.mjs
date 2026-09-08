import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('http://127.0.0.1:5173/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>OCR inspection</title>'}));
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 for(const file of process.argv.slice(2)){
  const result=await page.evaluate(async ({file,width})=>{
   const {default:RecognitionWorker}=await import('/src/vision/vision.worker.ts?worker');
   const source=file.startsWith('dds-')?Number(file.slice(4,7))>80?'/artifacts/ocr-holdout/':'/artifacts/ocr-independent/':'/images/';
   let bitmap=await createImageBitmap(await(await fetch(source+encodeURIComponent(file))).blob());
   if(width){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(bitmap.height*width/bitmap.width);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));bitmap=await createImageBitmap(blob);}
   const worker=new RecognitionWorker();
   return await new Promise((resolve,reject)=>{worker.onmessage=({data})=>{if(data.result||data.error){worker.terminate();data.error?reject(Error(data.error)):resolve(data.result);}};worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.postMessage({bitmap,debug:true},[bitmap]);});
  },{file,width:Number(process.env.OCR_WIDTH??0)});
  await fs.writeFile('artifacts/inspect-'+file+(process.env.OCR_WIDTH?'-'+process.env.OCR_WIDTH:'')+'.json',JSON.stringify(result));console.log(file,JSON.stringify(result.board.position.hands));
 }
}finally{await browser.close();}
