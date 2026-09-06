import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');
const manifest=JSON.parse(await fs.readFile('artifacts/ocr-independent/manifest.json','utf8')).slice(0,Number(process.env.OCR_LIMIT??80));const results=[];
for(const test of manifest){const r=await page.evaluate(async file=>{const {recognize}=await import('/src/vision/recognize.ts');const blob=await(await fetch('/artifacts/ocr-independent/'+file)).blob();return recognize(new File([blob],file,{type:'image/png'}),()=>{});},test.file);
let correct=0,found=0,expected=0;for(const seat of 'NESW'){const actual=r.board.position.hands[seat]??[];found+=actual.length;expected+=test.hands[seat].length;correct+=actual.filter(c=>test.hands[seat].includes(c)).length;}
results.push({file:test.file,font:test.font,correct,found,expected,actual:r.board.position.hands,exact:correct===52&&found===52});if(results.length%10===0)console.log(`${results.length}/${manifest.length}`,results.slice(-10).filter(r=>r.exact).length,'exact');}
const summary={images:results.length,exactImages:results.filter(r=>r.exact).length,correct:results.reduce((n,r)=>n+r.correct,0),found:results.reduce((n,r)=>n+r.found,0),expected:results.reduce((n,r)=>n+r.expected,0)};
await fs.writeFile('artifacts/ocr-independent/report.json',JSON.stringify({summary,results},null,2));console.log(summary);
assert.equal(summary.images,manifest.length);
}finally{await browser.close();}
