import {SEATS,type Position} from './types';
import {next,side,turn} from './cards';

// Only public play and the declaring side's cards enter the sampling position.
export function twoHandPosition(source:Position):Position {
 const first=source.history[0]?.cards[0]??source.current[0];
 if(!first)throw Error('请先在牌桌下方选择首攻，或打出首攻牌，再开始两家牌分析');
 if(first.seat!==next(source.contract.declarer))throw Error('首攻记录与当前庄家不符，请重新选择首攻');
 const p=structuredClone(source);
 for(const seat of SEATS)if(side(seat)!==side(p.contract.declarer))p.hands[seat]=null;
 if(p.hands[p.contract.declarer]===null||p.hands[next(p.contract.declarer,2)]===null)throw Error('两家牌分析需要庄家和明手的手牌');
 if(p.hands[turn(p)]===null)throw Error('当前轮到防守方，请先在牌桌打出该方实际出牌，再分析庄家或明手的选择');
 return p;
}
