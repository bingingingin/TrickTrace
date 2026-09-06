import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');const results=[];
for(const name of await fs.readdir('images')){if(!/\.jpg$/i.test(name))continue;
const result=await page.evaluate(async name=>{const {recognize}=await import('/src/vision/recognize.ts');const blob=await(await fetch('/images/'+encodeURIComponent(name))).blob();return recognize(new File([blob],name,{type:'image/jpeg'}),()=>{});},name);
results.push({name,...result});console.log(name,JSON.stringify(result.board.position.hands));}
await fs.writeFile('artifacts/recognition-results.json',JSON.stringify(results,null,2));}finally{await browser.close();}
