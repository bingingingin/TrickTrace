import {useEffect,useState,useMemo,useRef} from 'react';
import {LABEL, SEATS, SUITS, SYMBOL, type Constraint, type Seat} from '../core/types';
import {range,validateConstraints,auctionCalls,normalizeAuction} from '../engine/lead-constraints';
import {inferCCBA,applyOverrides,CCBA_VERSION,CCBA_SOURCE} from '../engine/ccba';
import {next} from '../core/cards';

function RangeField({label,value,max,onChange,onError}:{label:string;value:[number,number];max:number;onChange:(r:[number,number])=>void;onError:(e:string)=>void}){
 const format=(r:[number,number])=>r[0]===0&&r[1]===max?'':r[0]===r[1]?String(r[0]):r[1]===max?`${r[0]}+`:`${r[0]}-${r[1]}`;
 const [draft,setDraft]=useState(format(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(format(value));setError('');onError('');},[value[0],value[1]]);
 return <label>{label}<input aria-label={label} aria-invalid={!!error} value={draft} placeholder="不限" onChange={e=>setDraft(e.target.value)} onBlur={()=>{
  try{const r=range(draft,max);setError('');onError('');if(r[0]!==value[0]||r[1]!==value[1])onChange(r);}catch(x){const message=(x as Error).message;setError(message);onError(message);}
 }}/>{error&&<small role="alert">{error}</small>}</label>;
}
export default function LeadConstraints({leader,declarer,dealer,auction,onChange,onValidityChange}:{leader:Seat;declarer:Seat;dealer:Seat;auction:string[];onChange:(cs:Constraint[])=>void;onValidityChange:(ok:boolean)=>void}){
 const [calls,setCalls]=useState(auction.join(' ')),[overrides,setOverrides]=useState<Constraint[]>([]),[seat,setSeat]=useState<Seat>(declarer),[level,setLevel]=useState(1),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const inference=useMemo(()=>inferCCBA(calls,dealer),[calls,dealer]);
 const value=useMemo(()=>applyOverrides(inference.constraints,overrides),[inference,overrides]);
 const changeRef=useRef(onChange);changeRef.current=onChange;
 useEffect(()=>changeRef.current(value),[value]);
 useEffect(()=>setCalls(auction.join(' ')),[auction.join(' ')]);
 const update=(s:Seat,patch:Partial<Constraint>)=>setOverrides(old=>{const prior=old.find(c=>c.seat===s);return [...old.filter(c=>c.seat!==s),{...prior,seat:s,...patch,...(patch.lengths?{lengths:{...prior?.lengths,...patch.lengths}}:{})}];});
 let validation='';try{validateConstraints(value);}catch(e){validation=(e as Error).message;}
 const invalid=!!validation||!!inference.error||Object.values(fieldErrors).some(Boolean);
 useEffect(()=>onValidityChange(!invalid),[invalid,onValidityChange]);
 const fieldError=(id:string)=>(message:string)=>setFieldErrors(old=>old[id]===message?old:{...old,[id]:message});
 const tokens=normalizeAuction(calls);
 const canAdd=(call:string)=>{try{auctionCalls([...tokens,call].join(' '),dealer);return true;}catch{return false;}};
 const c=value.find(c=>c.seat===seat)??{seat};
 const add=(call:string)=>setCalls([...tokens,call].join(' '));
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
  <div className="constraint-presets">{[['P','不叫'],['X','加倍'],['XX','再加倍']].map(([t,label])=><button key={t} disabled={!canAdd(t)} onClick={()=>add(t)}>{label}</button>)}<button disabled={!tokens.length} onClick={()=>setCalls(tokens.slice(0,-1).join(' '))}>撤销</button><button disabled={!tokens.length} onClick={()=>setCalls('')}>清空叫牌</button></div>
  <label>粘贴 / 编辑叫牌<textarea rows={2} aria-label="首攻分析叫牌" value={calls} onChange={e=>setCalls(e.target.value)} placeholder="P P 1NT P 3NT P P P"/></label>
  <p className="ccba-status">{CCBA_VERSION} · 自动联动</p>
  <p className="hint">每次叫牌改动会重算下方条件；手动覆盖会保留。不修改当前定约，不根据“不叫”硬设点力上限。</p>
  {inference.meanings.some(m=>!m.applied)&&<p className="constraint-warning">有 {inference.meanings.filter(m=>!m.applied).length} 个叫品尚未覆盖，请展开说明并手动补充。</p>}
  <details className="ccba-meanings"><summary>叫牌解释与规则来源（{inference.meanings.length} 项）</summary>
   {inference.meanings.map(m=><p key={m.index}><b>{m.index+1}. {LABEL[m.seat]} {m.call}</b> · {m.description}{m.section&&<small>体系说明 §{m.section}</small>}</p>)}
   <a href={CCBA_SOURCE} target="_blank" rel="noreferrer">官网 CCBA v2.2 体系说明</a>
  </details>
  {overrides.length>0&&<button className="light-button" onClick={()=>{setOverrides([]);setFieldErrors({});}}>恢复全部 CCBA 推断（清除手动覆盖）</button>}
  <div className="constraint-presets" aria-label="选择约束方位">{SEATS.filter(s=>s!==leader).map(s=><button key={s} aria-pressed={seat===s} onClick={()=>{setSeat(s);setFieldErrors({});}}>{LABEL[s]} · {s===declarer?'庄家':s===next(declarer,2)?'明手':'同伴'}{value.some(x=>x.seat===s)?' ●':''}</button>)}</div>
  <div key={seat} className="lead-seat-fields">
   <p className="hint">{overrides.some(x=>x.seat===seat)?'来源：CCBA 推断 + 手动覆盖（改叫牌时保留）':inference.constraints.some(x=>x.seat===seat)?'来源：CCBA 叫牌推断':'尚无可确定的点力或长度条件'}</p>
   <RangeField label={`${seat} 大牌点`} value={[c.minHcp??0,c.maxHcp??37]} max={37} onError={fieldError('hcp')} onChange={r=>update(seat,{minHcp:r[0],maxHcp:r[1]})}/>
   <p className="hint">空白不限；可填 12-17、5+ 或精确数值，离开输入框后应用。</p>
   <div className="constraint-ranges">{SUITS.map(s=><RangeField key={s} label={`${seat} ${SYMBOL[s]} 张数`} value={c.lengths?.[s]??[0,13]} max={13} onError={fieldError(s)} onChange={r=>update(seat,{lengths:{[s]:r}})}/>)}</div>
   <div className="constraint-presets">{[['balanced','均型'],['shape 4432 5332','4432 / 5332'],['s 5+ OR h 5+','至少五张高花']].map(([t,label])=><button key={t} aria-pressed={(c.expression??'').split(',').map(x=>x.trim()).includes(t)} onClick={()=>toggle(t)}>{label}</button>)}</div>
   <details><summary>高级条件：指定牌张、花色点力</summary><textarea aria-label={`${seat} 牌型与牌张条件`} value={c.expression??''} onChange={e=>update(seat,{expression:e.target.value})} placeholder="例如 s AK, no clubs Q"/><p>逗号表示同时满足，OR 表示任选。支持 balanced（均型）、s AK（有 ♠AK）、no clubs Q（无 ♣Q）、clubs hcp 5+（♣ 点力至少 5）。</p></details>
   <div className="constraint-presets"><button onClick={()=>{setOverrides(old=>old.filter(x=>x.seat!==seat));setFieldErrors({});}}>恢复{LABEL[seat]}家推断</button><button onClick={()=>{update(seat,{minHcp:0,maxHcp:37,lengths:{S:[0,13],H:[0,13],D:[0,13],C:[0,13]},expression:''});setFieldErrors({});}}>本家设为不限</button></div>
  </div>
  <RangeField label="庄明联手点力" value={value.find(c=>c.seat===declarer)?.partnershipHcp??[0,40]} max={40} onError={fieldError('partnership')} onChange={r=>update(declarer,{partnershipHcp:r})}/>
  {(inference.error||validation)&&<p role="alert" className="constraint-error">{inference.error||validation}</p>}
 </section>;
}
