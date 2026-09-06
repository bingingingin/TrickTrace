export const SEATS = ['N','E','S','W'] as const;
export const SUITS = ['S','H','D','C'] as const;
export const STRAINS = ['S','H','D','C','NT'] as const;
export type Seat = typeof SEATS[number];
export type Suit = typeof SUITS[number];
export type Strain = typeof STRAINS[number];
export type Card = `${Suit}${string}`;
export type Hands = Record<Seat, Card[] | null>;
export interface Played {seat:Seat;card:Card}
export interface Trick {cards:Played[];winner:Seat}
export interface Contract {level:number;strain:Strain;declarer:Seat;doubled:0|1|2}
export interface Position {hands:Hands;contract:Contract;leader:Seat;current:Played[];won:[number,number];history:Trick[]}
export interface Board {id:string;name:string;number?:number;dealer:Seat;vulnerability:'None'|'NS'|'EW'|'All';position:Position;auction:string[];record:Card[];warnings:string[]}
export interface Move {card:Card;tricks:number;loss:number;optimal:boolean}
export interface Evaluation {moves:Move[];tricks:number;nodes:number}
export interface LineStep {seat:Seat;card:Card;tricks:number;alternatives:Card[]}
export interface Line {steps:LineStep[];final:Position;initialTricks:number}
export interface Tactic {kind:string;title:string;trick:number;status:'verified'|'conditional'|'candidate';explanation:string;evidence:string[]}
export interface Constraint {seat:Seat;minHcp?:number;maxHcp?:number;lengths?:Partial<Record<Suit,[number,number]>>}
export interface SampleResult {samples:number;attempts:number;seed:number;moves:{card:Card;expected:number;success:number;interval:[number,number]}[]}
export const SYMBOL: Record<Suit,string> = {S:'♠',H:'♥',D:'♦',C:'♣'};
export const LABEL: Record<Seat,string> = {N:'北',E:'东',S:'南',W:'西'};
