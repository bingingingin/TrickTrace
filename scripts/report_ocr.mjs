import fs from 'node:fs/promises';
const fixtures=JSON.parse(await fs.readFile('tests/fixtures/recognition.json','utf8'));
const actual=JSON.parse(await fs.readFile('artifacts/recognition-results.json','utf8'));
const parse=text=>text.split('.').flatMap((r,i)=>[...r.replace(/10/g,'T').replace(/-/g,'')].map(c=>'SHDC'[i]+c));
const results=fixtures.map(f=>{
 const r=actual.find(r=>r.name===f.file);
 if(!r)throw Error(`Missing recognition run: ${f.file}`);
 const differences=[...'NESW'].map((seat,i)=>{
  const expected=parse(f.hands[i]),found=r.board.position.hands[seat]??[];
  return {seat,missing:expected.filter(c=>!found.includes(c)),extra:found.filter(c=>!expected.includes(c)),correct:found.filter(c=>expected.includes(c)).length,found:found.length};
 });
 return {file:f.file,exact:differences.every(d=>!d.missing.length&&!d.extra.length),differences};
});
const model=JSON.parse(await fs.readFile('public/models/glyphs.json','utf8'));
const report={model:{seed:model.seed,training:model.train,validation:model.validation,validationAccuracy:model.validation_accuracy},summary:{images:results.length,exactImages:results.filter(r=>r.exact).length,correct:results.flatMap(r=>r.differences).reduce((n,d)=>n+d.correct,0),found:results.flatMap(r=>r.differences).reduce((n,d)=>n+d.found,0),expected:results.length*52},results};
await fs.writeFile('docs/validation/ocr-supplied.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);
