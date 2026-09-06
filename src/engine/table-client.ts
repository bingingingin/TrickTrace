import type { Board } from "../core/types";
import { SEATS } from "../core/types";
import { handText } from "../core/cards";

export type TableResult = {
  table: number[][];
  par: { score: number; contracts: string[] };
};
const cache = new Map<string, Promise<TableResult>>();
let worker: Worker | undefined,
  seq = 0;
const pending = new Map<
  number,
  {
    resolve: (v: TableResult) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export const tableKey = (b: Board) =>
  SEATS.map((s) => handText(b.position.hands[s])).join(" ") +
  `/${b.dealer}/${b.vulnerability}`;
export const canCalculateTable = (b: Board) =>
  !b.position.current.length &&
  !b.position.history.length &&
  !b.position.won.some(Boolean) &&
  SEATS.every((s) => b.position.hands[s]?.length === 13);

/** Separate worker: background table computation must not delay or cancel play. */
export function getTable(b: Board): Promise<TableResult> {
  const key = tableKey(b),
    cached = cache.get(key);
  if (cached) return cached;
  if (!worker) {
    worker = new Worker(new URL("./solver.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.progress !== undefined) return;
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      clearTimeout(p.timer);
      data.error ? p.reject(Error(data.error)) : p.resolve(data.result);
    };
    worker.onerror = (event) => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(Error(event.message));
      }
      pending.clear();
      worker?.terminate();
      worker = undefined;
      cache.clear();
    };
  }
  const id = ++seq;
  const result = new Promise<TableResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("定约表计算超时"));
    }, 180000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, method: "table", args: [b.position, b] });
  }).catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, result);
  return result;
}
