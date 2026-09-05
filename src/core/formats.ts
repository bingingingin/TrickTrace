import {SEATS,SUITS,STRAINS,type Board,type Card,type Seat,type Strain,type Position} from './types';
import {boardFromHands,parseHand,handText,next,deck,validate,side,play,winner} from './cards';
const vulCycle:Board['vulnerability'][]=['None','NS','EW','All','NS','EW','All','None','EW','All','None','NS','All','None','NS','EW'];
function defaults(b:Board,num:number){if(num>0){b.dealer=SEATS[(num-1)%4];b.vulnerability=vulCycle[(num-1)%16];}return b;}
function deriveContract(b:Board){
 let last=-1;for(let i=0;i<b.auction.length;i++)if(/^[1-7](?:[SHDC]|NT?)$/.test(b.auction[i]))last=i;
 if(last<0){b.warnings.push('未提供有效定约，请选择定约和庄家后分析');return;}
 const bid=b.auction[last],strain=bid.slice(1).replace(/^N$/,'NT') as Strain;const bidder=next(b.dealer,last);
 const first=b.auction.findIndex((x,i)=>x.slice(1).replace(/^N$/,'NT')===strain&&side(next(b.dealer,i))===side(bidder));
 const suffix=b.auction.slice(last+1);b.position.contract={level:Number(bid[0]),strain,declarer:next(b.dealer,first),doubled:suffix.includes('XX')?2:suffix.includes('X')?1:0};b.position.leader=next(b.position.contract.declarer);
}
const cleanCall=(s:string)=>s.toUpperCase().replace(/!|\?+/g,'').replace(/^P(?:ASS)?$/,'Pass').replace(/^D$/,'X').replace(/^R$/,'XX');
export function parseLin(text:string):Board[]{
 const tokens=[...text.matchAll(/([a-z]{2})\|([^|]*)\|/gi)];const boards:Board[]=[];let b:Board|undefined;
 for(const m of tokens){const key=m[1].toLowerCase(),v=m[2];
  if(key==='md'){
   const dealer=({1:'S',2:'W',3:'N',4:'E'} as Record<string,Seat>)[v[0]];if(!dealer)throw Error('LIN 发牌人编码无效');
   const fields=v.slice(1).split(',');b=boardFromHands(['?','?','?','?'],`牌局 ${boards.length+1}`);b.dealer=dealer;
   const order:Seat[]=['S','W','N','E'];for(let i=0;i<fields.length&&i<4;i++){if(!fields[i].trim())continue;const groups=Object.fromEntries([...fields[i].toUpperCase().matchAll(/([SHDC])([2-9TJQKA10]*)/g)].map(x=>[x[1],x[2]]));b.position.hands[order[i]]=parseHand(SUITS.map(s=>groups[s]||'-').join('.'));}
   // LIN convention explicitly omits the fourth hand; infer only a unique 13-card complement.
   const unknown=SEATS.filter(s=>b!.position.hands[s]===null);if(unknown.length===1){const used=SEATS.flatMap(s=>b!.position.hands[s]??[]);if(used.length===39&&new Set(used).size===39)b.position.hands[unknown[0]]=deck().filter(c=>!used.includes(c));}
   boards.push(b);
  }else if(b){if(key==='ah')b.name=v;else if(key==='sv')b.vulnerability=({o:'None','0':'None',n:'NS',e:'EW',b:'All'} as Record<string,Board['vulnerability']>)[v]??'None';else if(key==='mb')b.auction.push(cleanCall(v));else if(key==='pc'){const c=v.toUpperCase().replace('10','T');if(!/^[SHDC][2-9TJQKA]$/.test(c))throw Error('LIN 出牌无效：'+v);b.record.push(c as Card);}else if(key==='mc')b.warnings.push(`原记录声称 ${v} 墩；声称不会当作已验证路线`);}
 }
 for(const x of boards){deriveContract(x);const errors=validate(x.position,false);if(errors.length)throw Error(x.name+'：'+errors.join('；'));}if(!boards.length)throw Error('没有找到 LIN md 手牌字段');return boards;
}
export function parsePbn(text:string):Board[]{
 const cleaned=text.replace(/\{[\s\S]*?\}/g,' ').replace(/^%.*$/gm,'').replace(/;[^\n]*/g,'');
 const tags=[...cleaned.matchAll(/\[(\w+)\s+"((?:\\.|[^"\\])*)"\]/g)];const groups:{tags:Record<string,string>;sections:Record<string,string>}[]=[];let g={tags:{} as Record<string,string>,sections:{} as Record<string,string>};
 for(let i=0;i<tags.length;i++){const m=tags[i],key=m[1],value=m[2];if((key==='Event'&&g.tags.Deal)||(key==='Board'&&g.tags.Deal)||(key==='Deal'&&g.tags.Deal)){groups.push(g);g={tags:{},sections:{}};}g.tags[key]=value;g.sections[key]=cleaned.slice(m.index!+m[0].length,tags[i+1]?.index??cleaned.length).trim();}if(g.tags.Deal)groups.push(g);
 const inherited:Record<string,string>={};return groups.map(({tags:t,sections},idx)=>{
  for(const k of Object.keys(t)){if(t[k]==='#')t[k]=inherited[k]??'?';else inherited[k]=t[k];}
  const match=t.Deal.match(/^([NESW]):\s*(.*)$/);if(!match)throw Error('PBN Deal 字段缺少起始方位');const parts=match[2].trim().split(/\s+/);if(parts.length!==4)throw Error('PBN Deal 必须含四手牌');
  const b=defaults(boardFromHands(['?','?','?','?'],t.Board?`牌局 ${t.Board}`:`牌局 ${idx+1}`),Number(t.Board));for(let i=0;i<4;i++)b.position.hands[next(match[1] as Seat,i)]=parseHand(parts[i]==='-'?'?':parts[i]);
  if(SEATS.includes(t.Dealer as Seat))b.dealer=t.Dealer as Seat;
  if(t.Vulnerable)b.vulnerability=({None:'None',Love:'None','-':'None',NS:'NS',EW:'EW',All:'All',Both:'All'} as Record<string,Board['vulnerability']>)[t.Vulnerable]??b.vulnerability;
  b.auction=(sections.Auction??'').replace(/=\d+=|\$\d+|\*/g,'').split(/\s+/).filter(Boolean).map(cleanCall);
  if(t.Auction&&SEATS.includes(t.Auction as Seat))b.dealer=t.Auction as Seat;
  deriveContract(b);
  const contract=t.Contract?.toUpperCase().match(/^([1-7])(NT?|[SHDC])(XX|X)?$/);if(contract){b.position.contract.level=Number(contract[1]);b.position.contract.strain=contract[2].replace(/^N$/,'NT') as Strain;b.position.contract.doubled=contract[3]==='XX'?2:contract[3]==='X'?1:0;}
  if(SEATS.includes(t.Declarer as Seat))b.position.contract.declarer=t.Declarer as Seat;
  b.position.leader=next(b.position.contract.declarer);if(contract&&SEATS.includes(t.Declarer as Seat))b.warnings=[];
  if(sections.Play&&SEATS.includes(t.Play as Seat)){
   // PBN Play columns stay in the order given by the Play tag, not each trick's winner.
   let q=structuredClone(b.position);q.leader=t.Play as Seat;b.position.leader=q.leader;
   const tokens=sections.Play.replace(/=\d+=|\$\d+/g,'').split(/\s+/).filter(x=>/^(?:[SHDC](?:10|[2-9TJQKA])|-|\*)$/i.test(x));
   for(let i=0;i<tokens.length;i+=4){const row=tokens.slice(i,i+4);if(row.includes('*'))break;const seatCards=new Map(row.map((c,j)=>[next(t.Play as Seat,j),c.toUpperCase().replace('10','T')]));const leader=q.leader;for(let j=0;j<4;j++){const c=seatCards.get(next(leader,j));if(!c||c==='-')break;b.record.push(c as Card);q=play(q,c as Card);}}
  }
  const errors=validate(b.position,false);if(errors.length)throw Error(b.name+'：'+errors.join('；'));return b;
 });
}
export function parseDlm(text:string):Board[]{
 const from=Number(text.match(/^From board\s*=\s*(\d+)/mi)?.[1]??1),to=Number(text.match(/^To board\s*=\s*(\d+)/mi)?.[1]??99);const all=SUITS.flatMap(s=>[...'AKQJT98765432'].map(r=>`${s}${r}` as Card));const boards:Board[]=[];
 for(const m of text.matchAll(/^Board\s+(\d+)\s*=\s*([a-p]{26})(\d{3})\s*$/gmi)){const n=Number(m[1]);if(n<from||n>to)continue;const b=defaults(boardFromHands(['-.-.-.-','-.-.-.-','-.-.-.-','-.-.-.-'],`牌局 ${n}`),n);const dup=Number(text.match(new RegExp('^Duplicates\\s+0*'+n+'\\s*=\\s*(\\d+)','mi'))?.[1]??0);let checksum=n^dup;[...m[2]].forEach((c,i)=>{const v=c.toLowerCase().charCodeAt(0)-97;checksum^=v+1;b.position.hands[SEATS[v>>2]]!.push(all[i*2]);b.position.hands[SEATS[v&3]]!.push(all[i*2+1]);});if(checksum!==Number(m[3]))throw Error(`DLM 第 ${n} 副校验和不匹配`);const errors=validate(b.position);if(errors.length)throw Error(errors.join('；'));b.warnings.push('DLM 不包含定约，请选择定约和庄家');boards.push(b);}
 if(!boards.length)throw Error('没有找到有效 DLM Board 编码（26 个 a–p 字符和 3 位校验和）');return boards;
}
export function importBoards(text:string,filename=''):Board[]{const s=text.trim();if(filename.endsWith('.json')||s.startsWith('{')){const x=JSON.parse(s);if(x.version!==1||!Array.isArray(x.boards))throw Error('不支持的项目文件');for(const b of x.boards){const e=validate(b.position,false);if(e.length)throw Error(e.join('；'));}return x.boards;}if(/md\|/i.test(s))return parseLin(s);if(/\[Deal\s/i.test(s))return parsePbn(s);if(/Board\s+\d+\s*=/i.test(s))return parseDlm(s);throw Error('无法识别文件，请使用 PBN、DLM、LIN 或墩迹 JSON');}
export function exportPbn(boards:Board[]):string{return '% PBN 2.1\n'+boards.map(b=>{const p=b.position;if(SEATS.some(s=>p.hands[s]===null)||p.current.length||p.history.length)throw Error('残局与未知手牌请导出项目 JSON；PBN 导出使用完整初始牌局');return `[Event "TrickTrace"]\n[Board "${b.name.replace(/[^0-9]/g,'')||1}"]\n[Dealer "${b.dealer}"]\n[Vulnerable "${b.vulnerability}"]\n[Deal "N:${SEATS.map(s=>handText(p.hands[s]).replace(/-/g,'')).join(' ')}"]\n[Declarer "${p.contract.declarer}"]\n[Contract "${p.contract.level}${p.contract.strain}${'X'.repeat(p.contract.doubled)}"]\n[Result "?"]\n${b.auction.length?`[Auction "${b.dealer}"]\n${b.auction.join(' ')}\n`:''}`;}).join('\n');}
