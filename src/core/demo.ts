import {boardFromHands} from './cards';
export function demoBoard(){const b=boardFromHands(['AT5.KJ53.96.KQ43','8763.Q6.JT753.75','Q9.AT92.AQ82.AT9','KJ42.874.K4.J862'],'练习牌 · 长套与进手');b.position.contract={level:6,strain:'NT',declarer:'S',doubled:0};b.position.leader='W';return b;}
