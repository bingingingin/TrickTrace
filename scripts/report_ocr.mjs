import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixtures=JSON.parse(await fs.readFile('tests/fixtures/recognition.json','utf8'));
const actual=JSON.parse(await fs.readFile('artifacts/recognition-results.json','utf8'));
const parse=text=>text==='?'?null:text.split('.').flatMap((r,i)=>[...r.replace(/10/g,'T').replace(/-/g,'')].map(c=>'SHDC'[i]+c));
const results=fixtures.map(f=>{
 const r=actual.find(r=>r.name===f.file);
 if(!r)throw Error(`Missing recognition run: ${f.file}`);
 const differences=[...'NESW'].map((seat,i)=>{
  const expected=parse(f.hands[i]),found=r.board.position.hands[seat];
  if(expected===null)return {seat,expected:null,missing:[],extra:found??[],correct:found===null?0:0,found:found?.length??0,exact:found===null};
  const cards=found??[];
  return {seat,missing:expected.filter(c=>!cards.includes(c)),extra:cards.filter(c=>!expected.includes(c)),correct:cards.filter(c=>expected.includes(c)).length,found:cards.length,exact:expected.length===cards.length&&expected.every(c=>cards.includes(c))};
 });
 const p=r.board.position,contract=`${p.contract.level}${p.contract.strain}${p.contract.declarer}`,
  current=p.current.map(c=>`${c.seat}${c.card}`),
  metadata={contract,dealer:r.board.dealer,vulnerability:r.board.vulnerability,leader:p.leader,current},
  metadataExact=(!f.contract||f.contract===contract)&&(!f.dealer||f.dealer===r.board.dealer)&&(!f.vulnerability||f.vulnerability===r.board.vulnerability)&&(!f.leader||f.leader===p.leader)&&(!f.current||JSON.stringify(f.current)===JSON.stringify(current));
 return {file:f.file,exact:differences.every(d=>d.exact)&&metadataExact,metadataExact,metadata,differences};
});
const model=JSON.parse(await fs.readFile('public/models/glyphs.json','utf8'));
const report={model:{seed:model.seed,training:model.train,validation:model.validation,validationAccuracy:model.validation_accuracy},summary:{images:results.length,exactImages:results.filter(r=>r.exact).length,correct:results.flatMap(r=>r.differences).reduce((n,d)=>n+d.correct,0),found:results.flatMap(r=>r.differences).reduce((n,d)=>n+d.found,0),expected:results.flatMap((r,i)=>r.differences.map((d,j)=>parse(fixtures[i].hands[j])?.length??0)).reduce((a,b)=>a+b,0)},results};
await fs.writeFile('docs/validation/ocr-supplied.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);
assert.equal(report.summary.exactImages,report.summary.images,results.filter(r=>!r.exact).map(r=>r.file).join(', '));
