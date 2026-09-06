import {expect,it} from 'vitest';
import {chooseOptimal} from '../src/engine/line-policy';
import {boardFromHands,play} from '../src/core/cards';
import type {Card,Move} from '../src/core/types';
const moves=(...cards:Card[]):Move[]=>cards.map(card=>({card,optimal:true,loss:0,tricks:3}));
it('follows low when none of the optimal cards can beat the ace',()=>{
 let p=boardFromHands(['A2.-.-.-','K3.-.-.-','Q4.-.-.-','J5.-.-.-']).position;p.leader='N';p=play(p,'SA');
 expect(chooseOptimal(p,moves('SK','S3'))?.card).toBe('S3');
});
it('never selects a lower card that loses a trick',()=>{
 const p=boardFromHands(['A2.-.-.-','K3.-.-.-','Q4.-.-.-','J5.-.-.-']).position;p.leader='N';
 expect(chooseOptimal(p,[...moves('SA'),{card:'S2',optimal:false,loss:1,tricks:2}])?.card).toBe('SA');
});
it('chooses the lowest optimal card even when a higher optimal card wins the current trick',()=>{
 let p=boardFromHands(['Q2.-.-.-','K3.-.-.-','A4.-.-.-','J5.-.-.-']).position;p.leader='N';p=play(p,'SQ');
 expect(chooseOptimal(p,moves('SK','S3'))?.card).toBe('S3');
});
it('uses stable suit order only when optimal ranks are equal',()=>{
 const p=boardFromHands(['A.2.-.-','K.3.-.-','Q.4.-.-','J.5.-.-']).position;
 expect(chooseOptimal(p,moves('C2','H2','D2','S2'))?.card).toBe('S2');
});
