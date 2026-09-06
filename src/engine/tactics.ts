import {
  SEATS,
  SUITS,
  SYMBOL,
  LABEL,
  type Position,
  type Line,
  type Tactic,
  type Card,
  type Seat,
  type Suit,
} from "../core/types";
import {
  play,
  side,
  suit,
  rank,
  turn,
  legalCards,
  remainingTricks,
  next,
} from "../core/cards";
import type { Solver } from "./dds";
const describe = (c: Card) => SYMBOL[suit(c)] + c.slice(1).replace("T", "10");
const cardsOf = (p: Position, sideIndex: number, s: Suit) =>
  SEATS.filter((h) => side(h) === sideIndex).flatMap((h) =>
    (p.hands[h] ?? []).filter((c) => suit(c) === s),
  );
// A threat can be protected by length (Kx over Ax), not just by a top honour.
function releasedThreats(p: Position, defender: Seat, discard: Card): Card[] {
  const ds = side(p.contract.declarer),
    t = suit(discard),
    guard = (p.hands[defender] ?? []).filter((c) => suit(c) === t);
  const cash = (hand: Card[], defense: Card[]) => {
    const h = [...hand].sort((a, b) => rank(b) - rank(a)),
      d = [...defense].sort((a, b) => rank(a) - rank(b)),
      wins: Card[] = [];
    for (const c of h) {
      if (d.some((x) => rank(x) > rank(c))) break;
      wins.push(c);
      d.shift();
    }
    return wins;
  };
  return SEATS.filter((s) => side(s) === ds).flatMap((s) => {
    const hand = (p.hands[s] ?? []).filter((c) => suit(c) === t),
      old = cash(hand, guard);
    return cash(
      hand,
      guard.filter((c) => c !== discard),
    ).filter((c) => !old.includes(c));
  });
}
function released(p: Position, s: Seat, c: Card) {
  return releasedThreats(p, s, c).length > 0;
}
function winningCards(start: Position, line: Line): Card[] {
  let p = start;
  const cards: Card[] = [];
  for (const st of line.steps) {
    const before = p.history.length;
    p = play(p, st.card);
    if (p.history.length > before) {
      const trick = p.history.at(-1)!;
      if (side(trick.winner) === side(p.contract.declarer))
        cards.push(trick.cards.find((c) => c.seat === trick.winner)!.card);
    }
  }
  return cards;
}
export function analyseTactics(
  solver: Solver,
  start: Position,
  line: Line,
  budgetMs = 20000,
): { items: Tactic[]; complete: boolean; examined: number } {
  const deadline = Date.now() + budgetMs,
    items: Tactic[] = [];
  let p = structuredClone(start),
    examined = 0,
    complete = true;
  const ds = side(p.contract.declarer);
  const squeezeEvents: { defender: Seat; trick: number; suits: Suit[] }[] = [];
  const positions: Position[] = [];
  for (const step of line.steps) {
    positions.push(structuredClone(p));
    p = play(p, step.card);
  }
  for (let i = 0; i < line.steps.length; i++) {
    if (Date.now() > deadline) {
      complete = false;
      break;
    }
    const step = line.steps[i],
      before = positions[i],
      after = play(before, step.card),
      trick = before.won[0] + before.won[1] + 1,
      s = step.seat;
    examined++;
    const lead = before.current[0],
      own = side(s) === ds;
    if (
      own &&
      lead &&
      suit(step.card) === before.contract.strain &&
      suit(step.card) !== suit(lead.card)
    ) {
      items.push({
        kind: "ruff",
        title: "将吃",
        trick,
        status: "verified",
        explanation: `${LABEL[s]}家没有${SYMBOL[suit(lead.card)]}，用${describe(step.card)}将吃。`,
        evidence: [
          `第 ${i + 1} 张，合法跟牌检查通过`,
          `${step.tricks} 墩路线中的最优选择`,
        ],
      });
    }
    // Verified low-card duck: deliberately choose a losing card when a winning one is available.
    if (own && lead && before.current.length === 3) {
      const e = solver.solvePosition(before),
        won = after.history.at(-1)?.winner;
      if (won && side(won) !== ds) {
        const winning = e.moves.filter(
          (m) => side(play(before, m.card).history.at(-1)!.winner) === ds,
        );
        if (
          winning.length &&
          e.moves.some((m) => m.card === step.card && m.optimal)
        )
          items.push({
            kind: "duck",
            title: "忍让",
            trick,
            status: "verified",
            explanation: `${LABEL[s]}家选择${describe(step.card)}让对手赢此墩；立即赢墩并不是必需。`,
            evidence: [
              `可立即赢墩的牌：${winning.map((m) => describe(m.card)).join("、")}`,
              `忍让后仍可取得 ${step.tricks} 墩`,
            ],
          });
      }
    }
    // Finesse candidates include evidence, but position alone does not prove a named tactic.
    if (
      own &&
      lead &&
      before.current.length === 2 &&
      side(lead.seat) === ds &&
      suit(step.card) === suit(lead.card)
    ) {
      const h = before.hands[s]!,
        higher = h.filter(
          (c) => suit(c) === suit(step.card) && rank(c) > rank(step.card),
        );
      const missing = cardsOf(before, 1 - ds, suit(step.card)).filter(
        (c) =>
          rank(c) > rank(step.card) && higher.some((a) => rank(a) > rank(c)),
      );
      if (higher.length && missing.length) {
        const optimal = solver
          .solvePosition(before)
          .moves.find((m) => m.card === step.card)?.optimal;
        items.push({
          kind: "finesse",
          title: "飞牌结构",
          trick,
          status: optimal ? "conditional" : "candidate",
          explanation: `同伴引${describe(lead.card)}，${LABEL[s]}家出${describe(step.card)}，保留${higher.map(describe).join("、")}，针对对方${missing.map(describe).join("、")}的位置。`,
          evidence: [
            `这一步已由 DDS 验证为${optimal ? "最优" : "非最优"}`,
            `是否为成功飞牌需结合本墩后手与进手；不代表未知牌下必然成功`,
          ],
        });
      }
    }
    if (
      after.history.length > before.history.length &&
      side(after.leader) !== ds &&
      side(after.history.at(-1)!.cards[0].seat) === ds &&
      remainingTricks(after) > 0 &&
      remainingTricks(after) <= 6
    ) {
      const leads = solver.solvePosition(after).moves;
      const proof: string[] = [];
      let allForced = true;
      for (const m of leads) {
        if (Date.now() > deadline) {
          complete = false;
          allForced = false;
          break;
        }
        const t = suit(m.card),
          attackers = SEATS.filter((s) => side(s) === ds),
          defenders = cardsOf(after, 1 - ds, t);
        const threats = attackers.flatMap((s) =>
          (after.hands[s] ?? []).filter(
            (c) =>
              suit(c) === t &&
              defenders.some(
                (d) =>
                  rank(d) > rank(c) &&
                  (after.hands[s] ?? []).some(
                    (a) => suit(a) === t && rank(a) > rank(d),
                  ),
              ),
          ),
        );
        const ruffDiscard =
          attackers.every(
            (s) => !(after.hands[s] ?? []).some((c) => suit(c) === t),
          ) &&
          attackers.some(
            (s) =>
              (after.hands[s] ?? []).some(
                (c) => suit(c) === after.contract.strain,
              ) &&
              attackers.some(
                (other) =>
                  other !== s &&
                  (after.hands[other] ?? []).some(
                    (c) => suit(c) !== after.contract.strain,
                  ),
              ),
          );
        if (!threats.length && !ruffDiscard) {
          allForced = false;
          break;
        }
        const q = play(after, m.card),
          follow = solver.generateLine(q),
          wins = winningCards(q, follow),
          realized = threats.filter((c) => wins.includes(c));
        if (!ruffDiscard && !realized.length) {
          allForced = false;
          break;
        }
        proof.push(
          `${LABEL[after.leader]}续攻${describe(m.card)} → ${m.tricks} 墩；${ruffDiscard ? "庄家与明手均缺门，可将吃并垫牌" : realized.map(describe).join("、") + "得到兑现"}`,
        );
      }
      if (allForced && proof.length)
        items.push({
          kind: "endplay",
          title: "投入",
          trick,
          status: "verified",
          explanation: `以${describe(after.history.at(-1)!.cards[0].card)}让${LABEL[after.leader]}家入手；其余 ${leads.length} 种合法续攻均逐一求解，须送入间张或给将吃垫牌。`,
          evidence: proof,
        });
    }
    if (
      !own &&
      lead &&
      side(lead.seat) === ds &&
      suit(step.card) !== suit(lead.card) &&
      suit(step.card) !== before.contract.strain &&
      remainingTricks(before) <= 7
    ) {
      const choices = legalCards(before);
      if (choices.length < 2) continue;
      const e = solver.solvePosition(before),
        guardChoices = choices.filter((c) => released(before, s, c));
      const guardSuits = [...new Set(guardChoices.map(suit))];
      if (!guardChoices.includes(step.card) || guardSuits.length < 2) continue;
      const exhaustive = choices.every((c) => guardChoices.includes(c));
      const optimalChoices = e.moves.filter((m) => m.optimal);
      const unavoidable = optimalChoices.every((m) =>
        guardChoices.includes(m.card),
      );
      if (!unavoidable) continue;
      // Validate actual accessibility of the released winners by optimal continuation for every best discard.
      const proof: string[] = [];
      let usable = true;
      for (const m of exhaustive ? e.moves : optimalChoices) {
        if (Date.now() > deadline) {
          complete = false;
          usable = false;
          break;
        }
        const q = play(before, m.card),
          continuation = solver.generateLine(q);
        let r = q;
        let cash = false;
        for (const st of continuation.steps) {
          const old = r;
          r = play(r, st.card);
          if (r.history.length > old.history.length) {
            const t = r.history.at(-1)!;
            if (
              side(t.winner) === ds &&
              releasedThreats(before, s, m.card).includes(
                t.cards.find((c) => c.seat === t.winner)!.card,
              )
            )
              cash = true;
          }
        }
        if (!cash) usable = false;
        proof.push(
          `${LABEL[s]}垫${describe(m.card)} → 庄家 ${m.tricks} 墩${cash ? "，相应花色可兑现" : "；进手兑现未证实"}`,
        );
      }
      const other = SEATS.find((h) => side(h) !== ds && h !== s)!;
      const shared = guardChoices.some((c) =>
        releasedThreats(before, s, c).every((t) =>
          (before.hands[other] ?? []).some(
            (d) => suit(d) === suit(t) && rank(d) > rank(t),
          ),
        ),
      );
      const verified = exhaustive && usable && !shared;
      items.push({
        kind: guardSuits.length >= 3 ? "triple-squeeze" : "simple-squeeze",
        title:
          guardSuits.length >= 3
            ? "三门挤牌"
            : shared
              ? "挤牌压力（共同看守）"
              : "简单挤牌",
        trick,
        status: verified ? "verified" : "conditional",
        explanation: `${LABEL[s]}家在${describe(lead.card)}上承受${guardSuits.map((x) => SYMBOL[x]).join("／")}的看守压力，垫${describe(step.card)}释放威胁张。${verified ? "每一种合法垫牌都释放可兑现赢张。" : "已验证最优垫牌分支；其他结构与进手仍需结合路线检查。"}`,
        evidence: proof,
      });
      squeezeEvents.push({ defender: s, trick, suits: guardSuits });
    }
  }
  // Composite classifications remain conditional unless the full combined strategy has been certified.
  for (let i = 0; i < squeezeEvents.length; i++)
    for (let j = i + 1; j < squeezeEvents.length; j++) {
      const a = squeezeEvents[i],
        b = squeezeEvents[j];
      if (b.trick - a.trick > 3) continue;
      const double = a.defender !== b.defender;
      items.push({
        kind: double ? "double-squeeze" : "repeating-squeeze",
        title: double ? "双挤结构" : "连续挤牌结构",
        trick: a.trick,
        status: "conditional",
        explanation: double
          ? `第 ${a.trick}–${b.trick} 墩，两名防守方分别受到看守压力。`
          : `${LABEL[a.defender]}家在第 ${a.trick}、${b.trick} 墩连续被迫处理看守。`,
        evidence: [
          "组成事件已逐步求解；组合战术的所有分支未穷尽，不作为强制双挤证明",
        ],
      });
    }
  const ruffs = items.filter((x) => x.kind === "ruff");
  if (ruffs.length >= 2) {
    const seats = new Set(
      line.steps
        .filter((st, i) => {
          const q = positions[i];
          return (
            side(st.seat) === ds &&
            q.current.length &&
            suit(st.card) === q.contract.strain &&
            suit(st.card) !== suit(q.current[0].card)
          );
        })
        .map((st) => st.seat),
    );
    if (seats.size === 2)
      items.push({
        kind: "cross-ruff",
        title: "交叉将吃",
        trick: ruffs[0].trick,
        status: "verified",
        explanation: "庄家和明手在本条最优样例中分别将吃对方花色。",
        evidence: ruffs.map((t) => `第 ${t.trick} 墩：${t.explanation}`),
      });
  }
  return { items, complete, examined };
}
