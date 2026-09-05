import type {Board,Card,Seat} from '../core/types';
export interface Candidate {card:Card;seat:Seat;confidence:number;box:[number,number,number,number]}
export interface Recognition {board:Board;candidates:Candidate[];warnings:string[];layout:string}
export async function recognize(file:File,onProgress:(n:number)=>void):Promise<Recognition>{
 if(file.size>20*1024*1024)throw Error('图片超过 20 MB，请先缩小图片');
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>32e6){bitmap.close();throw Error('图片像素过大，请缩小到 3200 像素以内');}
 const worker=new Worker(new URL('./vision.worker.ts',import.meta.url),{type:'module'});
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('识牌超时，请缩小图片重试'));},180000);worker.onmessage=({data})=>{if(data.progress!==undefined){onProgress(data.progress);return;}clearTimeout(timer);worker.terminate();if(data.error)reject(Error(data.error));else resolve(data.result);};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message||'识牌模块无法加载'));};worker.postMessage({bitmap},[bitmap]);});
}
