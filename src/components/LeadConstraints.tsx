import {useEffect,useState} from 'react';
import {LABEL, SEATS, SUITS, SYMBOL, type Constraint, type Seat} from '../core/types';
import {inferOpening,range,validateConstraints,auctionCalls} from '../engine/lead-constraints';
import {next} from '../core/cards';

function RangeField({label,value,max,onChange,onError}:{label:string;value:[number,number];max:number;onChange:(r:[number,number])=>void;onError:(e:string)=>void}){
 const format=(r:[number,number])=>r[0]===0&&r[1]===max?'':r[0]===r[1]?String(r[0]):r[1]===max?`${r[0]}+`:`${r[0]}-${r[1]}`;
 const [draft,setDraft]=useState(format(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(format(value));setError('');onError('');},[value[0],value[1]]);
 return <label>{label}<input aria-label={label} aria-invalid={!!error} value={draft} placeholder="不限" onChange={e=>setDraft(e.target.value)} onBlur={()=>{
  try{const r=range(draft,max);setError('');onError('');onChange(r);}catch(x){const message=(x as Error).message;setError(message);onError(message);}
 }}/>{error&&<small role="alert">{error}</small>}</label>;
}
export default function LeadConstraints({leader,declarer,dealer,auction,value,onChange,onValidityChange}:{leader:Seat;declarer:Seat;dealer:Seat;auction:string[];value:Constraint[];onChange:(cs:Constraint[])=>void;onValidityChange:(ok:boolean)=>void}){
 const [calls,setCalls]=useState(auction.join(' ')),[notes,setNotes]=useState<string[]>([]),[error,setError]=useState(''),[seat,setSeat]=useState<Seat>(declarer),[level,setLevel]=useState(1),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const update=(s:Seat,patch:Partial<Constraint>)=>onChange([...value.filter(c=>c.seat!==s),{...value.find(c=>c.seat===s),seat:s,...patch}]);
 const edit=(fn:()=>void)=>{try{fn();setError('');}catch(e){setError((e as Error).message);}};
 let validation='';try{validateConstraints(value);}catch(e){validation=(e as Error).message;}
 const invalid=!!validation||Object.values(fieldErrors).some(Boolean);
 useEffect(()=>onValidityChange(!invalid),[invalid,onValidityChange]);
 const fieldError=(id:string)=>(message:string)=>setFieldErrors(old=>old[id]===message?old:{...old,[id]:message});
 const tokens=calls.trim().split(/\s+/).filter(Boolean);
 const canAdd=(call:string)=>{try{auctionCalls([...tokens,call].join(' '),dealer);return true;}catch{return false;}};
 const c=value.find(c=>c.seat===seat)??{seat};
 const add=(call:string)=>{setCalls([...tokens,call].join(' '));setNotes([]);setError('');};
 const toggle=(expression:string)=>{const clauses=(c.expression??'').split(',').map(s=>s.trim()).filter(Boolean);update(seat,{expression:(clauses.includes(expression)?clauses.filter(s=>s!==expression):[...clauses,expression]).join(', ')});};
 return <section className="lead-constraints">
  <h4>叫牌与手牌条件</h4>
  <div className="lead-auction-table" aria-label="叫牌记录">
   {SEATS.map(s=><b key={s}>{LABEL[s]}</b>)}
   {Array.from({length:SEATS.indexOf(dealer)},(_,i)=><span key={`blank${i}`}>—</span>)}
   {tokens.map((t,i)=><span key={i}>{t==='P'?'不叫':t}</span>)}
  </div>
  <p>从{LABEL[dealer]}家开始 · 点选或粘贴叫牌</p>
  <div className="constraint-presets" aria-label="叫牌阶数">{[1,2,3,4,5,6,7].map(n=><button key={n} aria-pressed={level===n} onClick={()=>setLevel(n)}>{n}</button>)}</div>
  <div className="constraint-presets">{['C','D','H','S','NT'].map(s=><button key={s} disabled={!canAdd(`${level}${s}`)} onClick={()=>add(`${level}${s}`)}>{level}{s==='NT'?'NT':SYMBOL[s as keyof typeof SYMBOL]}</button>)}</div>
  <div className="constraint-presets">{[['P','不叫'],['X','加倍'],['XX','再加倍']].map(([t,label])=><button key={t} disabled={!canAdd(t)} onClick={()=>add(t)}>{label}</button>)}<button disabled={!tokens.length} onClick={()=>setCalls(tokens.slice(0,-1).join(' '))}>撤销</button><button disabled={!tokens.length} onClick={()=>{setCalls('');setNotes([]);}}>清空叫牌</button></div>
  <label>粘贴 / 编辑叫牌<textarea rows={2} aria-label="首攻分析叫牌" value={calls} onChange={e=>{setCalls(e.target.value);setNotes([]);}} placeholder="P P 1NT P 3NT P P P"/></label>
  <button className="light-button" onClick={()=>edit(()=>{const result=inferOpening(calls,dealer);onChange(result.constraints);setFieldErrors({});setNotes(result.notes);})}>用开叫模板填充（替换当前约束）</button>
  <p className="hint">自然制：五张高花、强无将。只填首次开叫；应叫、再叫和约定叫需手动补充。不会更改当前定约。</p>
  {notes.slice(0,1).map(note=><p key={note}>{note}</p>)}
  <div className="constraint-presets" aria-label="选择约束方位">{SEATS.filter(s=>s!==leader).map(s=><button key={s} aria-pressed={seat===s} onClick={()=>{setSeat(s);setFieldErrors({});}}>{LABEL[s]} · {s===declarer?'庄家':s===next(declarer,2)?'明手':'同伴'}{value.some(x=>x.seat===s)?' ●':''}</button>)}</div>
  <div key={seat} className="lead-seat-fields">
   <RangeField label={`${seat} 大牌点`} value={[c.minHcp??0,c.maxHcp??37]} max={37} onError={fieldError('hcp')} onChange={r=>update(seat,{minHcp:r[0],maxHcp:r[1]})}/>
   <p className="hint">空白不限；可填 12-17、5+ 或精确数值，离开输入框后应用。</p>
   <div className="constraint-ranges">{SUITS.map(s=><RangeField key={s} label={`${seat} ${SYMBOL[s]} 张数`} value={c.lengths?.[s]??[0,13]} max={13} onError={fieldError(s)} onChange={r=>update(seat,{lengths:{...c.lengths,[s]:r}})}/>)}</div>
   <div className="constraint-presets">{[['balanced','均型'],['shape 4432 5332','4432 / 5332'],['s 5+ OR h 5+','至少五张高花']].map(([t,label])=><button key={t} aria-pressed={(c.expression??'').split(',').map(x=>x.trim()).includes(t)} onClick={()=>toggle(t)}>{label}</button>)}</div>
   <details><summary>高级条件：指定牌张、花色点力</summary><textarea aria-label={`${seat} 牌型与牌张条件`} value={c.expression??''} onChange={e=>update(seat,{expression:e.target.value})} placeholder="例如 s AK, no clubs Q"/><p>逗号表示同时满足，OR 表示任选。支持 balanced（均型）、s AK（有 ♠AK）、no clubs Q（无 ♣Q）、clubs hcp 5+（♣ 点力至少 5）。</p></details>
   <button onClick={()=>{onChange(value.filter(x=>x.seat!==seat));setFieldErrors({});}}>清除{LABEL[seat]}家条件</button>
  </div>
  <RangeField label="庄明联手点力" value={value.find(c=>c.seat===declarer)?.partnershipHcp??[0,40]} max={40} onError={fieldError('partnership')} onChange={r=>update(declarer,{partnershipHcp:r})}/>
  {(error||validation)&&<p role="alert" className="constraint-error">{error||validation}</p>}
 </section>;
}
