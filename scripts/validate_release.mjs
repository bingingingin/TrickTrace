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
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 const partial=JSON.parse(await fs.readFile('tests/fixtures/recognition.json','utf8')).find(f=>f.file==='防守分析1.jpg');
 await page.locator('input[type=file]').setInputFiles('images/'+partial.file);
 await page.getByLabel('当前墩已出牌，按顺序空格分隔',{exact:true}).waitFor({timeout:180000});
 for(const [i,seat] of [...'NESW'].entries())assert.equal(await page.getByLabel(`${seat} 手牌文本`,{exact:true}).inputValue(),partial.hands[i]);
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^定约/}).locator('select').inputValue(),'3');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^将牌/}).locator('select').inputValue(),'NT');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^庄家/}).locator('select').inputValue(),'W');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^发牌/}).locator('select').inputValue(),'S');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^局况/}).locator('select').inputValue(),'EW');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/本墩引牌方/}).locator('select').inputValue(),'N');
 assert.equal(await page.getByLabel('当前墩已出牌，按顺序空格分隔',{exact:true}).inputValue(),'D5 DT');
 const verifiedFiles=[fixture.file,partial.file];
 let verifiedVisibleCards=77;
 if(process.env.OCR_EXTENDED==='1'){
  const fixtures=JSON.parse(await fs.readFile('tests/fixtures/recognition.json','utf8'));
  const examples=fixtures.filter(f=>!verifiedFiles.includes(f.file)).map(f=>({...f,path:'images/'+f.file}));
  for(const dataset of ['independent','holdout']){
   const manifest=JSON.parse(await fs.readFile(`artifacts/ocr-${dataset}/manifest.json`,'utf8'));
   for(const f of manifest.filter(f=>['dds-024-gadugi.ttf.png','dds-039-corbel.ttf.png','dds-058-bookos.ttf.png','dds-091-corbel.ttf.png'].includes(f.file))){
    const hands=[...'NESW'].map(seat=>[...'SHDC'].map(suit=>[...'AKQJT98765432'].filter(rank=>f.hands[seat].includes(suit+rank)).join('')||'-').join('.'));
    examples.push({...f,hands,path:`artifacts/ocr-${dataset}/${f.file}`});
   }
  }
  for(const f of examples){
   await page.getByRole('button',{name:'关闭',exact:true}).click();
   await page.locator('input[type=file]').setInputFiles(f.path);
   await page.getByLabel('N 手牌文本',{exact:true}).waitFor({timeout:180000});
   for(const [i,seat] of [...'NESW'].entries())assert.equal(await page.getByLabel(`${seat} 手牌文本`,{exact:true}).inputValue(),f.hands[i],`${f.file} ${seat}`);
   for(const [field,selector] of [['dealer',/^发牌/],['vulnerability',/^局况/],['leader',/本墩引牌方/]]){
    if(f[field])assert.equal(await page.locator('.editor-fields label').filter({hasText:selector}).locator('select').inputValue(),f[field],`${f.file} ${field}`);
   }
   if(f.contract){
    assert.equal(await page.locator('.editor-fields label').filter({hasText:/^定约/}).locator('select').inputValue(),f.contract[0]);
    assert.equal(await page.locator('.editor-fields label').filter({hasText:/^将牌/}).locator('select').inputValue(),f.contract.slice(1,-1));
    assert.equal(await page.locator('.editor-fields label').filter({hasText:/^庄家/}).locator('select').inputValue(),f.contract.at(-1));
   }
   if(f.current)assert.equal(await page.getByLabel('当前墩已出牌，按顺序空格分隔',{exact:true}).inputValue(),f.current.map(c=>c.slice(1)).join(' '));
   verifiedFiles.push(f.file);verifiedVisibleCards+=f.hands.join('').replace(/[^AKQJT2-9]/g,'').length;
   console.log('Upload verified:',f.file);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(uploads,[]);
 const privateImage=await page.request.get(new URL('/images/'+encodeURIComponent(fixture.file),url).href);
 assert.ok(!privateImage.headers()['content-type']?.startsWith('image/'),'Private fixtures must not be deployed');
 await page.screenshot({path:'artifacts/release-ocr.png',fullPage:true});
 const report={url,passed:true,ocrFiles:verifiedFiles,verifiedVisibleCards,partialState:'3NTW · N:D5 E:DT',pageErrors:errors,externalRequests:external,imageUploads:uploads};
 await fs.writeFile('artifacts/release-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
} finally {await browser.close();}
