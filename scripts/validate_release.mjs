import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.TRICKTRACE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 const errors=[],external=[],uploads=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{
  if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());
  if(r.method()==='POST')uploads.push(r.url());
 });
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 assert.equal(response.status(),200);
 assert.equal(response.headers()['cross-origin-embedder-policy'],'require-corp');
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/recognition.json','utf8')).find(f=>f.file==='双明手4.jpg');
 await page.locator('input[type=file]').setInputFiles('images/'+fixture.file);
 await page.getByLabel('N 手牌文本',{exact:true}).waitFor({timeout:180000});
 for(const [i,seat] of [...'NESW'].entries())assert.equal(await page.getByLabel(`${seat} 手牌文本`,{exact:true}).inputValue(),fixture.hands[i]);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(uploads,[]);
 const privateImage=await page.request.get(new URL('/images/'+encodeURIComponent(fixture.file),url).href);
 assert.ok(!privateImage.headers()['content-type']?.startsWith('image/'),'Private fixtures must not be deployed');
 await page.screenshot({path:'artifacts/release-ocr.png',fullPage:true});
 const report={url,passed:true,ocrFile:fixture.file,correctCards:52,pageErrors:errors,externalRequests:external,imageUploads:uploads};
 await fs.writeFile('artifacts/release-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
} finally {await browser.close();}
