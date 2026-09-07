import {useState} from 'react';
import {LABEL, SEATS, SUITS, SYMBOL, type Constraint, type Seat} from '../core/types';
import {inferOpening,range,validateConstraints} from '../engine/lead-constraints';
import {next} from '../core/cards';

export default function LeadConstraints({leader,declarer,dealer,auction,value,onChange}:{leader:Seat;declarer:Seat;dealer:Seat;auction:string[];value:Constraint[];onChange:(cs:Constraint[])=>void}){
  const [calls,setCalls]=useState(auction.join(' ')),[notes,setNotes]=useState<string[]>([]),[error,setError]=useState('');
  const update=(seat:Seat,patch:Partial<Constraint>)=>{onChange([...value.filter(c=>c.seat!==seat),{...value.find(c=>c.seat===seat),seat,...patch}]);};
  const edit=(fn:()=>void)=>{try{fn();setError('');}catch(e){setError((e as Error).message);}};
  let validation='';try{validateConstraints(value);}catch(e){validation=(e as Error).message;}
  return <section className="lead-constraints">
    <h4>叫牌与各家约束</h4>
    <label>从{LABEL[dealer]}家开始的叫牌
      <textarea aria-label="首攻分析叫牌" value={calls} onChange={e=>setCalls(e.target.value)} placeholder="例如：P 1NT P 3NT P P P" />
    </label>
    <p>自然制 · 五张高花 · 1NT 15–17 · 2NT 20–21</p>
    <button className="light-button" onClick={()=>edit(()=>{const result=inferOpening(calls,dealer);onChange(result.constraints);setNotes(result.notes);})}>用开叫模板填充（替换当前约束）</button>
    {notes.map(note=><p key={note}>{note}</p>)}
    <p>模板仅解释首次自然开叫。后续叫牌及约定叫请自行补充；这里尚无叫牌引擎重放验证。</p>
    {SEATS.filter(s=>s!==leader).map(seat=>{const c=value.find(c=>c.seat===seat)??{seat};return <details key={seat} open>
      <summary>{LABEL[seat]}家 · {seat===declarer?'庄家':seat===next(declarer,2)?'明手':'同伴'}</summary>
      <div className="constraint-ranges">
        <label>大牌点下限<input aria-label={`${seat} 大牌点下限`} type="number" min="0" max="37" value={c.minHcp??0} onChange={e=>update(seat,{minHcp:Number(e.target.value)})}/></label>
        <label>大牌点上限<input aria-label={`${seat} 大牌点上限`} type="number" min="0" max="37" value={c.maxHcp??37} onChange={e=>update(seat,{maxHcp:Number(e.target.value)})}/></label>
      </div>
      {SUITS.map(s=><div className="constraint-suit" key={s}><span>{SYMBOL[s]} 长度</span><input aria-label={`${seat} ${s} 最少张数`} type="number" min="0" max="13" value={c.lengths?.[s]?.[0]??0} onChange={e=>update(seat,{lengths:{...c.lengths,[s]:[Number(e.target.value),c.lengths?.[s]?.[1]??13]}})}/><span>–</span><input aria-label={`${seat} ${s} 最多张数`} type="number" min="0" max="13" value={c.lengths?.[s]?.[1]??13} onChange={e=>update(seat,{lengths:{...c.lengths,[s]:[c.lengths?.[s]?.[0]??0,Number(e.target.value)]}})}/></div>)}
      <label>牌型与牌张条件<textarea aria-label={`${seat} 牌型与牌张条件`} value={c.expression??''} onChange={e=>update(seat,{expression:e.target.value})} placeholder="balanced, s AK, no clubs Q"/></label>
      <div className="constraint-presets">{['balanced','shape 4432 5332','s 5+ OR h 5+'].map(t=><button key={t} onClick={()=>update(seat,{expression:c.expression?`${c.expression}, ${t}`:t})}>{t}</button>)}</div>
      <button onClick={()=>onChange(value.filter(x=>x.seat!==seat))}>清除本家约束</button>
    </details>;})}
    <p>庄家与明手合计大牌点（0–40 表示不限）</p>
    <div className="constraint-ranges">
      <label>下限<input aria-label="庄明联手点力下限" type="number" min="0" max="40" value={value.find(c=>c.seat===declarer)?.partnershipHcp?.[0]??0} onChange={e=>update(declarer,{partnershipHcp:[Number(e.target.value),value.find(c=>c.seat===declarer)?.partnershipHcp?.[1]??40]})}/></label>
      <label>上限<input aria-label="庄明联手点力上限" type="number" min="0" max="40" value={value.find(c=>c.seat===declarer)?.partnershipHcp?.[1]??40} onChange={e=>update(declarer,{partnershipHcp:[value.find(c=>c.seat===declarer)?.partnershipHcp?.[0]??0,Number(e.target.value)]})}/></label>
    </div>
    <details><summary>条件写法与说明</summary><p>逗号表示同时满足，OR 表示任选一项。支持 hcp 12-17、s 5+、balanced、shape 4432 5332（花色顺序不限）、5-4-3-1（♠♥♦♣）、s AK、no clubs Q、clubs hcp 5+。空白表示不限。点力和长度范围不一致时不能开始分析。</p></details>
    {(error||validation)&&<p role="alert" className="constraint-error">{error||validation}</p>}
  </section>;
}
