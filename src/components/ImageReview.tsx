import { useState } from "react";
import type { Recognition } from "../vision/recognize";
import { SYMBOL, type Suit } from "../core/types";

export default function ImageReview({
  url,
  recognition,
}: {
  url: string;
  recognition: Recognition | null;
}) {
  const [show, setShow] = useState(true),
    [selected, setSelected] = useState<number | null>(null);
  const candidate =
    selected === null ? null : recognition?.candidates[selected];
  const name = (card: string) =>
    SYMBOL[card[0] as Suit] + card.slice(1).replace("T", "10");
  return (
    <div className="image-review">
      {recognition && (
        <label className="ocr-overlay-toggle">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          显示识别位置
        </label>
      )}
      <div className="ocr-image">
        <img src={url} alt="识别原图，供对照校验" />
        {show &&
          recognition?.candidates.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`ocr-box ${selected === i ? "selected" : ""}`}
              style={{
                left: `${c.box[0] * 100}%`,
                top: `${c.box[1] * 100}%`,
                width: `${c.box[2] * 100}%`,
                height: `${c.box[3] * 100}%`,
              }}
              onClick={() => setSelected(i)}
              aria-label={`候选 ${c.seat} ${name(c.card)}，置信度 ${Math.round(c.confidence * 100)}%`}
              title={`${c.seat} ${name(c.card)}`}
            />
          ))}
      </div>
      {candidate && (
        <p className="ocr-selection">
          画面方位 {candidate.seat} · {name(candidate.card)} · 识别置信度{" "}
          {Math.round(candidate.confidence * 100)}%
        </p>
      )}
      {recognition && (
        <p>
          共 {recognition.candidates.length}{" "}
          个候选。点击框查看识别内容；方框不代表正确性已验证。请在选牌面板修正牌张，并核对实际方位、定约和当前墩。
        </p>
      )}
    </div>
  );
}
