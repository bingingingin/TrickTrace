import { useState } from "react";
import {
  SEATS,
  SUITS,
  SYMBOL,
  LABEL,
  type Card,
  type Seat,
} from "../core/types";
import { parseHand, handText, sortCards } from "../core/cards";
export default function CardPicker({
  hands,
  onChange,
}: {
  hands: string[];
  onChange: (hands: string[]) => void;
}) {
  const [active, setActive] = useState<Seat>("N"),
    [error, setError] = useState("");
  const parsed = hands.map((h) => {
    try {
      return parseHand(h);
    } catch {
      return null;
    }
  });
  function toggle(card: Card) {
    const i = SEATS.indexOf(active),
      h = parsed[i] ?? [];
    if (h.includes(card)) {
      onChange(
        hands.map((v, j) =>
          i === j ? handText(h.filter((c) => c !== card)) : v,
        ),
      );
      setError("");
      return;
    }
    if (h.length >= 13) {
      setError(`${LABEL[active]}家已有 13 张牌，请移除一张或选择其他家`);
      return;
    }
    if (parsed.some((p, j) => j !== i && p?.includes(card))) return;
    onChange(
      hands.map((v, j) => (i === j ? handText(sortCards([...h, card])) : v)),
    );
    setError("");
  }
  return (
    <div className="card-picker">
      <div className="seat-picker" role="group" aria-label="选择录入手牌的方位">
        {SEATS.map((s, i) => (
          <button
            type="button"
            aria-pressed={active === s}
            key={s}
            onClick={() => {
              setActive(s);
              setError("");
            }}
          >
            <b>{s}</b> {LABEL[s]}家{" "}
            <small>{parsed[i]?.length ?? "?"} / 13</small>
          </button>
        ))}
      </div>
      <div className="picker-hint">
        正在录入 <b>{LABEL[active]}家</b> · 连续点击添加，再点一次移除
      </div>
      <div className="picker-grid">
        {SUITS.map((s) => (
          <div className={s === "H" || s === "D" ? "red" : ""} key={s}>
            <span>{SYMBOL[s]}</span>
            {[..."AKQJT98765432"].map((r) => {
              const card = `${s}${r}` as Card,
                owners = SEATS.filter((_, i) => parsed[i]?.includes(card)),
                selected =
                  parsed[SEATS.indexOf(active)]?.includes(card) ?? false,
                elsewhere = owners.length > 0 && !selected;
              return (
                <button
                  type="button"
                  key={r}
                  aria-label={`分配 ${s}${r} 给 ${active}`}
                  aria-pressed={selected}
                  disabled={elsewhere}
                  className={`${selected ? "assigned" : elsewhere ? "unavailable" : ""} ${owners.length > 1 ? "duplicate" : ""}`}
                  onClick={() => toggle(card)}
                  title={
                    owners.length
                      ? `已在 ${owners.join("、")}；当前家已持有时点击即可移除`
                      : `添加到${LABEL[active]}家`
                  }
                >
                  {r === "T" ? "10" : r}
                  {owners.length > 0 && <small>{owners.join("/")}</small>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="picker-error">
          {error}
        </p>
      )}
      <div className="picker-summary">
        {SEATS.map((s, i) => (
          <label key={s} className={active === s ? "selected" : ""}>
            <b>{s}</b>
            <input
              aria-label={`${s} 手牌文本`}
              value={hands[i]}
              onFocus={() => setActive(s)}
              onChange={(e) => {
                onChange(hands.map((h, j) => (i === j ? e.target.value : h)));
                setError("");
              }}
              spellCheck={false}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
