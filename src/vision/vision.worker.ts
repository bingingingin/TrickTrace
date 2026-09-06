import { createWorker, PSM } from "tesseract.js";
import * as ort from "onnxruntime-web/wasm";
import { SEATS, SUITS, type Card, type Seat, type Suit } from "../core/types";
import { boardFromHands, sortCards } from "../core/cards";
import type { Candidate, Recognition } from "./recognize";
interface Component {
  x: number;
  y: number;
  w: number;
  h: number;
  pixels: number[];
  label?: string;
  confidence?: number;
  rotation?: number;
  angle?: number;
}

function components(data: ImageData): Component[] {
  const { width: w, height: h } = data;
  const a = data.data,
    mask = new Uint8Array(w * h),
    seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = a[i * 4],
      g = a[i * 4 + 1],
      b = a[i * 4 + 2];
    mask[i] =
      r + g + b < 420 || (r > 100 && r > g * 1.45 && r > b * 1.35) ? 1 : 0;
  }
  const result: Component[] = [];
  const queue = new Int32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const pos = y * w + x;
      if (!mask[pos] || seen[pos]) continue;
      let head = 0,
        tail = 1;
      queue[0] = pos;
      seen[pos] = 1;
      let minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      while (head < tail) {
        const p = queue[head++],
          px = p % w,
          py = Math.floor(p / w);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
          const n = p + d;
          if (
            n >= 0 &&
            n < w * h &&
            !seen[n] &&
            mask[n] &&
            Math.abs((n % w) - px) <= 1
          ) {
            seen[n] = 1;
            queue[tail++] = n;
          }
        }
      }
      const cw = maxX - minX + 1,
        ch = maxY - minY + 1;
      if (
        tail >= 12 &&
        cw >= 3 &&
        ch >= 3 &&
        cw <= w * 0.075 &&
        ch <= w * 0.075 &&
        cw * ch < 6000
      )
        result.push({
          x: minX,
          y: minY,
          w: cw,
          h: ch,
          pixels: Array.from(queue.subarray(0, tail)),
        });
    }
  return result;
}
function tensorOf(c: Component, w: number, rot = 0) {
  const source = new OffscreenCanvas(c.w, c.h),
    sc = source.getContext("2d")!,
    mask = new Uint8ClampedArray(c.w * c.h * 4);
  for (const p of c.pixels) {
    const i = (Math.floor(p / w) - c.y) * c.w + (p % w) - c.x;
    mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = mask[i * 4 + 3] = 255;
  }
  sc.putImageData(new ImageData(mask, c.w, c.h), 0, 0);
  const size = Math.ceil(Math.hypot(c.w, c.h)) + 4,
    tmp = new OffscreenCanvas(size, size),
    tc = tmp.getContext("2d")!;
  tc.translate(size / 2, size / 2);
  tc.rotate((rot * Math.PI) / 180);
  tc.drawImage(source, -c.w / 2, -c.h / 2);
  const a = tc.getImageData(0, 0, size, size).data;
  let l = size,
    t = size,
    r = 0,
    b = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (a[(y * size + x) * 4 + 3] > 64) {
        l = Math.min(l, x);
        t = Math.min(t, y);
        r = Math.max(r, x);
        b = Math.max(b, y);
      }
  const cw = r - l + 1,
    ch = b - t + 1,
    scale = 26 / Math.max(cw, ch),
    dw = Math.max(1, Math.floor(cw * scale)),
    dh = Math.max(1, Math.floor(ch * scale)),
    target = new OffscreenCanvas(32, 32),
    ctx = target.getContext("2d")!;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 32, 32);
  ctx.drawImage(
    tmp,
    l,
    t,
    cw,
    ch,
    Math.floor((32 - dw) / 2),
    Math.floor((32 - dh) / 2),
    dw,
    dh,
  );
  const image = ctx.getImageData(0, 0, 32, 32);
  return Float32Array.from({ length: 1024 }, (_, i) => image.data[i * 4] / 255);
}

function inverseVector(x: number, y: number, rot: number): [number, number] {
  const a = (rot * Math.PI) / 180;
  return [
    x * Math.cos(a) + y * Math.sin(a),
    -x * Math.sin(a) + y * Math.cos(a),
  ];
}
async function run(bitmap: ImageBitmap): Promise<Recognition> {
  const scale = Math.min(2.5, 1280 / bitmap.width),
    w = Math.round(bitmap.width * scale),
    h = Math.round(bitmap.height * scale),
    canvas = new OffscreenCanvas(w, h),
    ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const data = ctx.getImageData(0, 0, w, h);
  const white =
    Array.from({ length: 20 }, (_, i) => {
      const p = (Math.floor(h * 0.35) + i) * w + Math.floor(w * 0.5);
      return (
        data.data[p * 4] + data.data[p * 4 + 1] + data.data[p * 4 + 2] > 650
      );
    }).filter(Boolean).length > 15;
  self.postMessage({ progress: 15 });
  const comps = components(data);
  const redFraction = (c: Component) =>
    c.pixels.filter((p) => data.data[p * 4] > data.data[p * 4 + 1] + 45 && data.data[p * 4] > data.data[p * 4 + 2] + 35).length / c.pixels.length;
  // Only use conventional suit colours when the diagram actually contains red
  // symbols. Monochrome diagrams retain shape-only classification.
  const colouredDiagram = white && comps.some((c) => redFraction(c) > 0.7);
  const edge = (x: number) => {
    for (let y = Math.floor(h * 0.72); y < h * 0.95; y++) {
      const i = (y * w + Math.floor(x)) * 4;
      if (
        data.data[i] > 220 &&
        data.data[i + 1] > 220 &&
        data.data[i + 2] > 220
      )
        return y;
    }
    return h;
  };
  const fan = !white && Math.abs(edge(w * 0.24) - edge(w * 0.5)) > h * 0.025;
  const angle = (c: Component, rot: number) =>
    fan && rot === 0 && c.y > h * 0.72
      ? (-Math.atan2(c.x + c.w / 2 - w * 0.5, h * 1.035 - c.y - c.h / 2) *
          180) /
        Math.PI
      : rot;

  ort.env.wasm.numThreads = 1;
  const runtimeURL = URL.createObjectURL(
    new Blob(
      [await (await fetch("/models/ort-wasm-simd-threaded.mjs")).text()],
      { type: "text/javascript" },
    ),
  );
  ort.env.wasm.wasmPaths = {
    mjs: runtimeURL,
    wasm: new URL("/models/ort-wasm-simd-threaded.wasm", self.location.origin)
      .href,
  };
  const { labels } = (await (await fetch("/models/glyphs.json")).json()) as {
    labels: string[];
  };
  const session = await ort.InferenceSession.create("/models/glyphs.onnx", {
    executionProviders: ["wasm"],
  });
  const all: Component[] = [];
  for (const rot of white ? [0] : [0, 90, 180, 270]) {
    const input = new Float32Array(comps.length * 1024);
    comps.forEach((c, i) => input.set(tensorOf(c, w, angle(c, rot)), i * 1024));
    const output = await session.run({
      image: new ort.Tensor("float32", input, [comps.length, 1, 32, 32]),
    });
    const logits = output.logits.data as Float32Array;
    if (logits.length !== comps.length * labels.length)
      throw Error("识牌模型和标签版本不一致");
    comps.forEach((c, i) => {
      const row = Array.from(
          logits.slice(i * labels.length, (i + 1) * labels.length),
        ),
        max = Math.max(...row),
        exps = row.map((v) => Math.exp(v - max)),
        sum = exps.reduce((a, b) => a + b, 0),
        index = row.indexOf(max);
      let label = labels[index];
      if (colouredDiagram && SUITS.includes(label as Suit)) {
        const allowed = redFraction(c) > 0.5 ? ["H", "D"] : ["S", "C"];
        label = allowed.reduce((a, b) => row[labels.indexOf(a)] >= row[labels.indexOf(b)] ? a : b);
      }
      all.push({
        ...c,
        label,
        confidence: 1 / sum,
        rotation: rot,
        angle: angle(c, rot),
      });
    });
    self.postMessage({ progress: 25 + rot / 6 });
  }
  const ocr = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    workerBlobURL: false,
  });
  if (!white) {
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_CHAR,
      tessedit_char_whitelist: "23456789TJQKA10",
    });
    for (const c of all) {
      const seat =
        c.y < h * 0.29
          ? "N"
          : c.y > h * 0.7
            ? "S"
            : c.x < w * 0.22
              ? "W"
              : c.x > w * 0.77
                ? "E"
                : null;
      if (
        !seat ||
        c.rotation !== { N: 0, S: 0, W: 270, E: 90 }[seat] ||
        !/^[2-9TJQKA]$/.test(c.label!) ||
        (c.confidence! > 0.995 && c.label !== "T")
      )
        continue;
      const tensor = tensorOf(c, w, c.angle),
        tile = new OffscreenCanvas(96, 96),
        tc = tile.getContext("2d")!,
        px = new Uint8ClampedArray(32 * 32 * 4);
      for (let i = 0; i < 1024; i++) {
        px[i * 4] =
          px[i * 4 + 1] =
          px[i * 4 + 2] =
            255 - Math.round(tensor[i] * 255);
        px[i * 4 + 3] = 255;
      }
      const small = new OffscreenCanvas(32, 32);
      small.getContext("2d")!.putImageData(new ImageData(px, 32, 32), 0, 0);
      tc.drawImage(small, 0, 0, 96, 96);
      const read = await ocr.recognize(await tile.convertToBlob());
      const label = read.data.text.trim();
      if (/^[0-9TJQKA]$/.test(label) && read.data.confidence >= 80) {
        c.label = label;
        c.confidence = read.data.confidence / 100;
      }
    }
  }
  // Tens consist of two disconnected digits. Join only classified 1 + 0 in the same orientation.
  for (const a of [...all]) {
    if (
      !(a.label === "1" && a.confidence! > 0.55) &&
      !(a.rotation! % 180 ? a.h / a.w < 0.2 : a.w / a.h < 0.2)
    )
      continue;
    const size = Math.max(a.w, a.h);
    const zero = all
      .filter(
        (b) =>
          b.label === "0" && b.rotation === a.rotation && b.confidence! > 0.55,
      )
      .find((b) => {
        const [x, y] = inverseVector(
          b.x + b.w / 2 - a.x - a.w / 2,
          b.y + b.h / 2 - a.y - a.h / 2,
          (360 - a.rotation!) % 360,
        );
        return x > 0 && x < size * 1.1 && Math.abs(y) < size * 0.25;
      });
    if (zero)
      all.push({
        ...a,
        label: "10",
        confidence: Math.min(Math.max(a.confidence!, 0.7), zero.confidence!),
        x: Math.min(a.x, zero.x),
        y: Math.min(a.y, zero.y),
        w: Math.max(a.x + a.w, zero.x + zero.w) - Math.min(a.x, zero.x),
        h: Math.max(a.y + a.h, zero.y + zero.h) - Math.min(a.y, zero.y),
      });
  }
  const candidates: Candidate[] = [];
  // A stacked dummy exposes one suit under a vertical column of rank indices.
  if (!white) {
    for (const anchor of all) {
      if (
        anchor.rotation !== 0 ||
        !SUITS.includes(anchor.label as Suit) ||
        anchor.confidence! < 0.9 ||
        anchor.y > h * 0.17 ||
        Math.max(anchor.w, anchor.h) > h * 0.022
      )
        continue;
      const column = all
        .filter(
          (c) =>
            c.rotation === 0 &&
            /^(?:[2-9TJQKA]|10)$/.test(c.label!) &&
            c.confidence! > 0.5 &&
            Math.abs(c.x + c.w / 2 - anchor.x - anchor.w / 2) <
              anchor.h * 0.48 &&
            c.y < anchor.y &&
            anchor.y - c.y < anchor.h * 6 &&
            c.h > anchor.h * 0.8 &&
            c.h < anchor.h * 1.7,
        )
        .sort((a, b) => b.y - a.y);
      if (column.length < 2) continue;
      let prev = anchor.y;
      for (const c of column) {
        if (prev - c.y > c.h * 1.8) break;
        prev = c.y;
        candidates.push({
          seat: "N",
          card: `${anchor.label}${c.label === "10" ? "T" : c.label}` as Card,
          confidence: Math.min(c.confidence!, anchor.confidence!),
          box: [c.x / w, c.y / h, c.w / w, c.h / h],
        });
      }
    }
  }

  function zone(x: number, y: number): Seat | null {
    if (white) {
      if (y > h * 0.11 && y < h * 0.235 && x > w * 0.2 && x < w * 0.58)
        return "N";
      if (y > h * 0.345 && y < h * 0.48 && x > w * 0.2 && x < w * 0.58)
        return "S";
      if (y > h * 0.235 && y < h * 0.355) {
        if (x < w * 0.46) return "W";
        if (x > w * 0.5) return "E";
      }
      return null;
    }
    if (y < h * 0.29 && x > w * 0.14 && x < w * 0.87) return "N";
    if (y > h * 0.7) return "S";
    if (y > h * 0.3 && y < h * 0.7 && x < w * 0.22) return "W";
    if (y > h * 0.26 && y < h * 0.7 && x > w * 0.77) return "E";
    return null;
  }
  if (white) {
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "23456789TJQKA10",
    });
    // Text hand diagrams: use symbol-row anchors; rows can contain multi-digit tens.
    const symbols = all.filter(
      (c) => SUITS.includes(c.label as Suit) && c.confidence! > 0.65,
    );
    for (const anchor of symbols) {
      const s = zone(anchor.x, anchor.y);
      if (!s) continue;
      const glyphs = comps.filter(
        (c) =>
          c.x > anchor.x + anchor.w &&
          c.x < anchor.x + w * 0.33 &&
          Math.abs(c.y + c.h / 2 - anchor.y - anchor.h / 2) < anchor.h * 0.8 &&
          c.h > anchor.h * 0.4 &&
          c.h < anchor.h * 1.7,
      );
      const left = Math.floor(anchor.x + anchor.w * 1.05),
        top = Math.max(0, Math.min(...glyphs.map((c) => c.y), anchor.y) - 4),
        width = Math.min(Math.round(w * 0.32), w - left),
        bottom =
          Math.max(...glyphs.map((c) => c.y + c.h), anchor.y + anchor.h) + 4,
        height = bottom - top,
        strip = new OffscreenCanvas(width * 2, height * 2);
      strip
        .getContext("2d")!
        .drawImage(
          canvas,
          left,
          top,
          width,
          height,
          0,
          0,
          width * 2,
          height * 2,
        );
      const read = await ocr.recognize(
        await strip.convertToBlob(),
        {},
        { text: true, blocks: true },
      );
      const text = read.data.text.replace(/\s+/g, "").replace(/10/g, "T");
      const symbols =
        read.data.blocks?.flatMap((b) =>
          b.paragraphs.flatMap((p) =>
            p.lines.flatMap((l) => l.words.flatMap((w) => w.symbols)),
          ),
        ) ?? [];
      if (
        read.data.confidence >= 65 &&
        /^[2-9TJQKA]{1,13}$/.test(text) &&
        symbols.length
      ) {
        for (let i = 0; i < symbols.length; i++) {
          const c = symbols[i];
          let label = c.text;
          let right = c.bbox.x1;
          if (label === "1" && symbols[i + 1]?.text === "0") {
            label = "T";
            right = symbols[++i].bbox.x1;
          }
          if (!/^[2-9TJQKA]$/.test(label)) continue;
          candidates.push({
            seat: s,
            card: `${anchor.label}${label}` as Card,
            confidence: Math.min(
              anchor.confidence!,
              read.data.confidence / 100,
            ),
            box: [
              (left + c.bbox.x0 / 2) / w,
              (top + c.bbox.y0 / 2) / h,
              (right - c.bbox.x0) / 2 / w,
              (c.bbox.y1 - c.bbox.y0) / 2 / h,
            ],
          });
        }
        continue;
      }
      const row = all
        .filter(
          (c) =>
            /^(?:[2-9TJQKA]|10)$/.test(c.label!) &&
            c.confidence! > 0.55 &&
            c.x > anchor.x + anchor.w * 0.8 &&
            c.x < anchor.x + w * 0.31 &&
            Math.abs(c.y + c.h / 2 - anchor.y - anchor.h / 2) <
              anchor.h * 0.8 &&
            c.h > anchor.h * 0.55 &&
            c.h < anchor.h * 1.5,
        )
        .sort((a, b) => a.x - b.x);
      for (const c of row.sort((a, b) => a.x - b.x || b.w - a.w)) {
        const rank = c.label === "10" ? "T" : c.label!;
        candidates.push({
          seat: s,
          card: `${anchor.label}${rank}` as Card,
          confidence: Math.min(c.confidence!, anchor.confidence!),
          box: [c.x / w, c.y / h, c.w / w, c.h / h],
        });
      }
    }
  } else {
    for (const r of all) {
      if (!/^(?:[2-9TJQKA]|10)$/.test(r.label!) || r.confidence! < 0.5)
        continue;
      const seat = zone(r.x + r.w / 2, r.y + r.h / 2);
      if (!seat) continue;
      if (r.rotation !== { N: 0, S: 0, W: 270, E: 90 }[seat]) continue;
      // One corner per card: discard lower mirrored indices and unrelated central artwork.
      if (seat === "N" && r.y > h * 0.145) continue;
      if (seat === "S" && r.y < h * 0.73) continue;
      const rv = r.rotation!;
      const possible = all
        .filter(
          (c) =>
            c.rotation === rv &&
            SUITS.includes(c.label as Suit) &&
            c.confidence! > 0.7,
        )
        .map((c) => {
          const dx = c.x + c.w / 2 - r.x - r.w / 2,
            dy = c.y + c.h / 2 - r.y - r.h / 2;
          const [xx, yy] = inverseVector(dx, dy, (360 - (r.angle ?? rv)) % 360);
          const size = Math.max(r.w, r.h);
          return { c, xx, yy, size };
        })
        .filter(
          ({ xx, yy, size, c }) =>
            yy > size * 0.25 &&
            yy < size * 1.6 &&
            Math.abs(xx) < size * 0.55 &&
            Math.max(c.w, c.h) < size * 1.2,
        )
        .sort((a, b) => Math.hypot(a.xx, a.yy) - Math.hypot(b.xx, b.yy));
      if (possible.length) {
        const c = possible[0].c;
        candidates.push({
          seat,
          card: `${c.label}${r.label === "10" ? "T" : r.label}` as Card,
          confidence: Math.min(c.confidence!, r.confidence!),
          box: [r.x / w, r.y / h, r.w / w, r.h / h],
        });
      }
    }
  }
  // For four exposed flat hands, reconcile an entire index row with the text engine.
  // Row geometry also excludes artwork and the inverted corner on the last card.
  if (
    !white &&
    scale > 1 &&
    !fan &&
    SEATS.every((s) => candidates.filter((c) => c.seat === s).length >= 8)
  ) {
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "23456789TJQKA10",
    });
    for (const seat of SEATS) {
      const vertical = seat === "E" || seat === "W",
        rv = { N: 0, S: 0, W: 270, E: 90 }[seat];
      const seed = candidates.filter(
        (c) => c.seat === seat && c.confidence > 0.8,
      );
      if (seed.length < 6) continue;
      const med = (a: number[]) =>
        a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
      const axis = med(
        seed.map((c) =>
          vertical
            ? (c.box[0] + c.box[2] / 2) * w
            : (c.box[1] + c.box[3] / 2) * h,
        ),
      );
      const size = med(
        seed.map((c) => (vertical ? c.box[2] * w : c.box[3] * h)),
      );
      let band = seed
        .filter(
          (c) =>
            Math.abs(
              (vertical
                ? (c.box[0] + c.box[2] / 2) * w
                : (c.box[1] + c.box[3] / 2) * h) - axis,
            ) <
            size * 0.65,
        )
        .sort((a, b) => (vertical ? a.box[1] - b.box[1] : a.box[0] - b.box[0]));
      const along = (c: Candidate) =>
        vertical
          ? (c.box[1] + c.box[3] / 2) * h
          : (c.box[0] + c.box[2] / 2) * w;
      const gaps = band
        .slice(1)
        .map((c, i) => along(c) - along(band[i]))
        .filter((g) => g > size * 0.4);
      const gap = med(gaps);
      const cut = band.findIndex(
        (c, i) => i > 0 && along(c) - along(band[i - 1]) > gap * 2.5,
      );
      if (cut > 5) band = band.slice(0, cut);
      if (!band.length) continue;
      const low = along(band[0]) - gap * 0.5,
        high = along(band.at(-1)!) + gap * 0.5;
      const left = Math.max(0, Math.floor(vertical ? axis - size * 0.65 : low)),
        top = Math.max(0, Math.floor(vertical ? low : axis - size * 0.65)),
        bw = Math.min(w - left, Math.ceil(vertical ? size * 1.3 : high - low)),
        bh = Math.min(h - top, Math.ceil(vertical ? high - low : size * 1.3));
      const sw = vertical ? bh : bw,
        sh = vertical ? bw : bh,
        strip = new OffscreenCanvas(sw * 2, sh * 2),
        tc = strip.getContext("2d")!;
      tc.scale(2, 2);
      if (rv === 90) {
        tc.translate(bh, 0);
        tc.rotate(Math.PI / 2);
      }
      if (rv === 270) {
        tc.translate(0, bw);
        tc.rotate(-Math.PI / 2);
      }
      tc.drawImage(canvas, left, top, bw, bh, 0, 0, bw, bh);
      const read = await ocr.recognize(
        await strip.convertToBlob(),
        {},
        { text: true, blocks: true },
      );
      const symbols =
        read.data.blocks?.flatMap((b) =>
          b.paragraphs.flatMap((p) =>
            p.lines.flatMap((l) => l.words.flatMap((w) => w.symbols)),
          ),
        ) ?? [];
      for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        if (
          c.seat === seat &&
          (Math.abs(
            (vertical
              ? (c.box[0] + c.box[2] / 2) * w
              : (c.box[1] + c.box[3] / 2) * h) - axis,
          ) >
            size * 0.8 ||
            along(c) > high)
        )
          candidates.splice(i, 1);
      }
      for (let i = 0; i < symbols.length; i++) {
        const token = symbols[i];
        let label = token.text,
          x1 = token.bbox.x1;
        if (label === "1" && symbols[i + 1]?.text === "0") {
          label = "T";
          x1 = symbols[++i].bbox.x1;
        }
        if (!/^[2-9TJQKA]$/.test(label) || token.confidence < 90) continue;
        const back = (x: number, y: number): [number, number] =>
          rv === 90
            ? [left + y / 2, top + bh - x / 2]
            : rv === 270
              ? [left + bw - y / 2, top + x / 2]
              : [left + x / 2, top + y / 2];
        const pts = [
            back(token.bbox.x0, token.bbox.y0),
            back(x1, token.bbox.y1),
          ],
          x = Math.min(...pts.map((p) => p[0])),
          y = Math.min(...pts.map((p) => p[1])),
          rw = Math.abs(pts[1][0] - pts[0][0]),
          rh = Math.abs(pts[1][1] - pts[0][1]);
        const possible = all
          .filter(
            (c) =>
              c.rotation === rv &&
              SUITS.includes(c.label as Suit) &&
              c.confidence! > 0.6,
          )
          .map((c) => {
            const [xx, yy] = inverseVector(
              c.x + c.w / 2 - x - rw / 2,
              c.y + c.h / 2 - y - rh / 2,
              (360 - rv) % 360,
            );
            return { c, xx, yy };
          })
          .filter(
            (c) =>
              c.yy > size * 0.3 &&
              c.yy < size * 1.7 &&
              Math.abs(c.xx) < size * 0.6 &&
              Math.max(c.c.w, c.c.h) < size * 1.3,
          )
          .sort((a, b) => Math.hypot(a.xx, a.yy) - Math.hypot(b.xx, b.yy));
        if (!possible.length) continue;
        for (let j = candidates.length - 1; j >= 0; j--) {
          const c = candidates[j];
          if (
            c.seat === seat &&
            Math.abs((c.box[0] + c.box[2] / 2) * w - x - rw / 2) <
              size * 0.45 &&
            Math.abs((c.box[1] + c.box[3] / 2) * h - y - rh / 2) < size * 0.45
          )
            candidates.splice(j, 1);
        }
        candidates.push({
          seat,
          card: `${possible[0].c.label}${label}` as Card,
          confidence: Math.min(
            token.confidence / 100,
            possible[0].c.confidence!,
          ),
          box: [x / w, y / h, rw / w, rh / h],
        });
      }
    }
  }
  // Keep the strongest interpretation of an index region. Do not infer missing cards.
  const selected: Candidate[] = [];
  for (const c of candidates.sort((a, b) => b.confidence - a.confidence)) {
    if (
      selected.some(
        (x) =>
          Math.max(
            0,
            Math.min(x.box[0] + x.box[2], c.box[0] + c.box[2]) -
              Math.max(x.box[0], c.box[0]),
          ) *
            Math.max(
              0,
              Math.min(x.box[1] + x.box[3], c.box[1] + c.box[3]) -
                Math.max(x.box[1], c.box[1]),
            ) >
          Math.min(x.box[2] * x.box[3], c.box[2] * c.box[3]) * 0.6,
      )
    )
      continue;
    if (selected.some((x) => x.card === c.card && x.seat === c.seat)) continue;
    selected.push(c);
  }
  const board = boardFromHands(["?", "?", "?", "?"], "图片识牌 · 待核对");
  for (const s of SEATS) {
    const cards = selected.filter((c) => c.seat === s).map((c) => c.card);
    board.position.hands[s] = cards.length ? sortCards(cards) : null;
  }
  const warnings = [
    "按画面上下左右暂标 N/S/W/E；实际方位可能旋转，请核对",
    "定约、当前墩及低置信度牌张需确认后分析",
  ];
  if (SEATS.some((s) => (board.position.hands[s]?.length ?? 0) !== 13))
    warnings.push("存在缺失或未知手牌，不会自动凑满 52 张");
  self.postMessage({ progress: 100 });
  await ocr.terminate();
  await session.release();
  URL.revokeObjectURL(runtimeURL);
  return {
    board,
    candidates: selected,
    warnings,
    layout: white ? "text" : "cards",
  };
}
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await run(data.bitmap) });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
