import { rank, suit } from "../core/cards";
import { SUITS, type Move, type Position } from "../core/types";

/** Tie-break only among DDS-certified optimal cards; never trade away a trick. */
export function chooseOptimal(_p: Position, moves: Move[]): Move | undefined {
  const optimal = moves.filter((m) => m.optimal);
  // Equal final trick counts: always play the lowest rank, even if a higher
  // card could win this trick. Suit order only makes equal ranks reproducible.
  return optimal.sort(
    (a, b) =>
      rank(a.card) - rank(b.card) ||
      SUITS.indexOf(suit(a.card)) - SUITS.indexOf(suit(b.card)),
  )[0];
}
