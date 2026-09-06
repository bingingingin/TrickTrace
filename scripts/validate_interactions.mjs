import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');
 const start=page.getByRole('button',{name:'开始',exact:true});
 await start.waitFor();await page.waitForFunction(()=>!document.querySelector('.play-button')?.disabled);
 await page.getByRole('button',{name:'手动输入',exact:false}).click();
 for(const rank of ['A','K','Q'])await page.getByRole('button',{name:`分配 S${rank} 给 N`,exact:true}).click();
 assert.equal((await page.locator('.seat-picker button[aria-pressed=true]').innerText()).replace(/\s+/g,' '),'N 北家 3 / 13');
 await page.getByRole('button',{name:'分配 SK 给 N',exact:true}).click();
 assert.equal(await page.locator('.picker-grid .assigned').count(),2);
 await page.locator('.seat-picker button').nth(1).click();
 assert.equal(await page.getByRole('button',{name:'分配 SA 给 E',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'分配 HK 给 E',exact:true}).click();
 await page.getByLabel('第几副牌').fill('18');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^发牌/}).locator('select').inputValue(),'E');
 assert.equal(await page.locator('.editor-fields label').filter({hasText:/^局况/}).locator('select').inputValue(),'NS');
 await fs.mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/entry-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'artifacts/entry-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.setViewportSize({width:1440,height:1050});
 // Start works without a previously generated line or session.
 for(let n=1;n<=4;n++){
  await start.click();
  await page.waitForFunction(n=>document.querySelector('.playback>span')?.textContent===`${n} / 52 张`,n);
  await page.waitForFunction(()=>!document.querySelector('.play-button')?.disabled);
 }
 assert.equal(await page.locator('.played-card').count(),4);
 await page.waitForTimeout(1200);
 assert.equal(await page.locator('.played-card').count(),4);
 await page.screenshot({path:'artifacts/completed-trick.png',fullPage:true});
 await start.click();await page.waitForFunction(()=>document.querySelectorAll('.played-card').length===1);
 await page.getByRole('button',{name:'重置',exact:false}).click();
 await page.waitForFunction(()=>!document.querySelector('.play-button')?.disabled);
 // Capture timing from the DOM, including fourth-card hold and next-trick transition.
 await page.evaluate(()=>{
  window.trickEvents=[];let last='';
  new MutationObserver(()=>{const value=document.querySelector('.playback>span')?.textContent;if(value!==last){last=value;window.trickEvents.push({value,time:performance.now(),cards:document.querySelectorAll('.played-card').length});}}).observe(document.querySelector('.table-section'),{subtree:true,childList:true,characterData:true});
 });
 await page.getByRole('button',{name:'自动',exact:true}).click();await start.click();
 await page.waitForFunction(()=>Number(document.querySelector('.playback>span')?.textContent?.split(' /')[0])>=9,null,{timeout:60000});
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const events=await page.evaluate(()=>window.trickEvents);
 const event=n=>events.find(e=>e.value===`${n} / 52 张`);
 for(const n of [4,8]){assert.equal(event(n).cards,4);assert.ok(event(n+1).time-event(n).time>=970,'Completed trick must remain for 1 second');}
 const paused=await page.locator('.playback>span').innerText();await page.waitForTimeout(1300);assert.equal(await page.locator('.playback>span').innerText(),paused);
 await start.click();
 await page.waitForFunction(()=>document.querySelector('.playback>span')?.textContent==='52 / 52 张',null,{timeout:60000});
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('.played-card').count(),4);
 assert.equal(await page.getByRole('button',{name:'暂停',exact:true}).count(),0);
 assert.equal(await start.isDisabled(),true);
 assert.deepEqual(errors,[]);
 const report={passed:true,errors,events,checks:['continuous seat entry','toggle removal','duplicate prevention','board metadata','mobile overflow','single-step start','completed trick retained','automatic progression from fresh session','one-second holds','pause']};
 await fs.writeFile('artifacts/interaction-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
