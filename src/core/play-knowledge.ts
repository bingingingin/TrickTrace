import { rank, suit } from "./cards";
import type { Card, Position } from "./types";

export type PlayRole = "opening-lead" | "lead" | "follow" | "ruff" | "discard";

export const PLAY_KNOWLEDGE: Record<
  PlayRole,
  { label: string; short: string; principle: string }
> = {
  "opening-lead": {
    label: "首攻",
    short: "本副第一墩的攻牌",
    principle:
      "首攻单独比较所有合法牌；指定首攻后，从该局面继续按双方最优应对求解。",
  },
  lead: {
    label: "攻牌",
    short: "本墩第一张牌",
    principle: "攻牌决定本墩花色。DDS 结果相同的牌默认选择点数最小者。",
  },
  follow: {
    label: "跟牌",
    short: "跟随本墩所攻花色",
    principle:
      "持有所攻花色时必须跟出该花色；只在相同最终墩数的候选中选择小牌。",
  },
  ruff: {
    label: "跟牌·将吃",
    short: "无所攻花色，改出将牌",
    principle:
      "只有已经缺门时才可将吃；是否值得将吃由当前局面的 DDS 结果决定。",
  },
  discard: {
    label: "跟牌·垫牌",
    short: "无所攻花色，垫出旁门牌",
    principle: "垫牌不得破坏必要控制或进手；并列最优时默认垫点数最小的牌。",
  },
};

export function classifyPlay(position: Position, card?: Card): PlayRole {
  if (!position.current.length)
    return position.history.length ? "lead" : "opening-lead";
  if (!card || suit(card) === suit(position.current[0].card)) return "follow";
  if (
    position.contract.strain !== "NT" &&
    suit(card) === position.contract.strain
  )
    return "ruff";
  return "discard";
}

export function lowestEquivalent(cards: Card[]): Card | undefined {
  return [...cards].sort(
    (a, b) =>
      rank(a) - rank(b) || "SHDC".indexOf(suit(a)) - "SHDC".indexOf(suit(b)),
  )[0];
}
