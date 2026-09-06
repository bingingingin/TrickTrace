import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.addInitScript(()=>{window.workerRequests=[];const Base=Worker;window.Worker=class extends Base{postMessage(data,...rest){window.workerRequests.push(data.method??'ocr');return super.postMessage(data,...rest);}};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRICKTRACE_URL||'http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('button',{name:'定约表',exact:true}).click();await page.locator('.table-results table').waitFor({timeout:120000});
 assert.equal(await page.evaluate(()=>window.workerRequests.filter(x=>x==='table').length),1);
 await page.getByRole('button',{name:'修改定约',exact:true}).click();
 await page.locator('.editor-fields label').filter({hasText:/^定约/}).locator('select').selectOption('1');
 await page.getByRole('button',{name:'确认并分析',exact:false}).click();
 await page.locator('.table-results tbody tr').nth(2).locator('button').nth(4).click();
 assert.match(await page.locator('.contract-chip').innerText(),/^6NT/);
 assert.equal(await page.evaluate(()=>window.workerRequests.filter(x=>x==='table').length),1);
 await page.waitForFunction(()=>!document.querySelector('.play-button').disabled);
 await page.locator('.hand.active .card-rank:not([disabled])').first().click();
 assert.notEqual(await page.getByLabel('修改首攻',{exact:true}).inputValue(),'');
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'开始',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.play-button').disabled);}
 const boxes=await page.locator('.played-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {seat:n.querySelector('small').textContent,x:r.x,y:r.y,w:r.width,h:r.height};}));
 assert.equal(boxes.length,4);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Played cards must not overlap');}
 const by=Object.fromEntries(boxes.map(b=>[b.seat,b]));assert.ok(by.N.y<by.E.y&&by.S.y>by.E.y&&by.W.x<by.N.x&&by.E.x>by.N.x);
 await page.screenshot({path:'artifacts/revised-table.png',fullPage:true});
 await page.getByRole('button',{name:'手动输入',exact:false}).click();
 await page.getByLabel('N 手牌文本',{exact:true}).fill('AKQJ.3.432.432');
 await page.getByLabel('E 手牌文本',{exact:true}).fill('T9876.3.AKQ.AKQJ');
 const duplicate=page.getByRole('button',{name:'分配 H3 给 E',exact:true});assert.equal(await duplicate.isDisabled(),false);assert.equal(await duplicate.getAttribute('aria-pressed'),'true');await duplicate.click();
 assert.equal(await page.getByLabel('E 手牌文本',{exact:true}).inputValue(),'T9876.-.AKQ.AKQJ');
 assert.equal(await page.getByLabel('N 手牌文本',{exact:true}).inputValue(),'AKQJ.3.432.432');
 await page.getByRole('button',{name:'分配 H2 给 E',exact:true}).click();assert.equal(await page.getByLabel('E 手牌文本',{exact:true}).inputValue(),'T9876.2.AKQ.AKQJ');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/revised-editor-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'取消',exact:true}).click();
 assert.ok(await page.getByRole('button',{name:'修改定约',exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>0),'Contract text remains readable on mobile');
 await page.screenshot({path:'artifacts/revised-table-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);const report={passed:true,errors,tableRequests:await page.evaluate(()=>window.workerRequests.filter(x=>x==='table').length),boxes};await fs.writeFile('artifacts/revision-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
