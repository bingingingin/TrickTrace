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
  scores?: number[];
  altScores?: number[];
  symmetry?: number;
  profile?: number[];
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
function colourRegions(
  data: ImageData,
  match: (r: number, g: number, b: number) => boolean,
) {
  const { width: w, height: h } = data,
    mask = new Uint8Array(w * h),
    seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h),
    boxes: { x: number; y: number; w: number; h: number; area: number }[] = [];
  for (let i = 0; i < w * h; i++)
    mask[i] = match(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2])
      ? 1
      : 0;
  for (let y = 1; y < h - 1; y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      const start = y * w + x;
      if (!mask[start] || seen[start]) continue;
      let head = 0,
        tail = 1,
        minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      queue[0] = start;
      seen[start] = 1;
      while (head < tail) {
        const p = queue[head++],
          px = p % w,
          py = Math.floor(p / w);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const d of [-w, -1, 1, w]) {
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
      if (tail > 80)
        boxes.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          area: tail,
        });
    }
  return boxes;
}
async function run(bitmap: ImageBitmap, debug = false): Promise<Recognition> {
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
  const lowResolutionFlat = scale > 1 && !fan && !white;
  const modelBase = lowResolutionFlat ? "glyphs-lowres" : "glyphs";
  const { labels } = (await (
    await fetch(`/models/${modelBase}.json`)
  ).json()) as {
    labels: string[];
  };
  const session = await ort.InferenceSession.create(
    `/models/${modelBase}.onnx`,
    { executionProviders: ["wasm"] },
  );
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
      // The model input already contains this exact normalized glyph.
      const normalized = input.subarray(i * 1024, (i + 1) * 1024);
      let difference = 0,
        ink = 0;
      const profile = Array(8).fill(0) as number[];
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 16; x++) {
          const a = normalized[y * 32 + x],
            b = normalized[y * 32 + 31 - x];
          difference += Math.abs(a - b);
          ink += a + b;
          profile[Math.floor(y / 8) * 2] += a;
          profile[Math.floor(y / 8) * 2 + 1] += b;
        }
      all.push({
        ...c,
        label,
        confidence: 1 / sum,
        scores: exps.map((x) => x / sum),
        rotation: rot,
        angle: angle(c, rot),
        symmetry: ink ? 1 - difference / ink : 0,
        profile: profile.map((x) => (ink ? x / ink : 0)),
      });
    });
    self.postMessage({ progress: 25 + rot / 6 });
  }
  if (white) {
    // Kerning can connect QJ/KJ into one component. Try a small, batched set
    // of vertical cuts only on ambiguous wide glyphs, requiring both halves
    // to independently match the existing model with high confidence.
    const splits: { original: Component; left: Component; right: Component }[] = [];
    for (const c of all.filter(c => c.confidence! < 0.9 && c.w > c.h * 0.9 && c.w < c.h * 1.8)) {
      const ink = new Set(c.pixels);
      for (const fraction of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
        const cut = c.x + Math.round(c.w * fraction);
        // Touching letters have a localized thin join. Cutting through Q's
        // bowl crosses both its top and bottom, and must never split that Q.
        const bridge = c.pixels.filter(p => p % w === cut - 1 &&
          [1 - w, 1, 1 + w].some(d => ink.has(p + d))).map(p => Math.floor(p / w));
        if (!bridge.length || bridge.length > c.h * 0.14 ||
          Math.max(...bridge) - Math.min(...bridge) > c.h * 0.25) continue;
        const halves = [c.pixels.filter(p => p % w < cut), c.pixels.filter(p => p % w >= cut)];
        const parts = halves.map(pixels => {
          if (pixels.length < 12) return null;
          const xs = pixels.map(p => p % w), ys = pixels.map(p => Math.floor(p / w));
          const x = Math.min(...xs), y = Math.min(...ys);
          return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, pixels, rotation: 0, angle: 0 } as Component;
        });
        if (parts.every(p => p && p.w >= 3 && p.h >= c.h * 0.75))
          splits.push({ original: c, left: parts[0]!, right: parts[1]! });
      }
    }
    if (splits.length) {
      const parts = splits.flatMap(s => [s.left, s.right]);
      const input = new Float32Array(parts.length * 1024);
      parts.forEach((c, i) => input.set(tensorOf(c, w), i * 1024));
      const output = await session.run({ image: new ort.Tensor("float32", input, [parts.length, 1, 32, 32]) });
      const logits = output.logits.data as Float32Array;
      parts.forEach((c, i) => {
        const row = Array.from(logits.subarray(i * labels.length, (i + 1) * labels.length));
        const max = Math.max(...row);
        c.label = labels[row.indexOf(max)];
        c.confidence = 1 / row.reduce((sum, v) => sum + Math.exp(v - max), 0);
      });
      const accepted = new Set<Component>();
      for (const split of splits.sort((a, b) => Math.min(b.left.confidence!, b.right.confidence!) - Math.min(a.left.confidence!, a.right.confidence!))) {
        if (accepted.has(split.original) || !/^[QK]$/.test(split.left.label!) || split.right.label !== "J" ||
          split.left.confidence! < 0.98 || split.right.confidence! < 0.98) continue;
        accepted.add(split.original);
        all.splice(all.indexOf(split.original), 1, split.left, split.right);
      }
    }
  }
  const ocr = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    workerBlobURL: false,
  });
  await ocr.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  const sceneRead = await ocr.recognize(
    await canvas.convertToBlob(),
    {},
    { text: true, blocks: true },
  );
  const sceneText = sceneRead.data.text;
  let contractRead = "";
  const contractAttempts: {rotation: number; text: string; confidence: number}[] = [];
  const purple = colourRegions(
    data,
    (r, g, b) => b > 85 && r > 65 && b > g * 1.2 && r > g * 1.03,
  )
    .filter(
      (b) =>
        b.y > h * 0.25 &&
        b.y < h * 0.75 &&
        b.w > w * 0.04 &&
        b.h > w * 0.04 &&
        b.w < w * 0.2 &&
        b.h < w * 0.2,
    )
    .sort((a, b) => b.area - a.area)[0];
  if (purple) {
    await ocr.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_WORD,
      tessedit_char_whitelist: "1234567NTSHDC",
    });
    for (const rotation of [0, 90, 270]) {
      const pad = 8,
        left = Math.max(0, purple.x - pad),
        top = Math.max(0, purple.y - pad),
        width = Math.min(w - left, purple.w + pad * 2),
        height = Math.min(h - top, purple.h + pad * 2),
        source = new OffscreenCanvas(width, height),
        sourceContext = source.getContext("2d")!,
        sideways = rotation === 90 || rotation === 270,
        tile = new OffscreenCanvas(
          (sideways ? height : width) * 3,
          (sideways ? width : height) * 3,
        ),
        tc = tile.getContext("2d")!;
      sourceContext.drawImage(canvas, left, top, width, height, 0, 0, width, height);
      tc.fillStyle = "white";
      tc.fillRect(0, 0, tile.width, tile.height);
      tc.scale(3, 3);
      if (rotation === 90) {
        tc.translate(height, 0);
        tc.rotate(Math.PI / 2);
      } else if (rotation === 270) {
        tc.translate(0, width);
        tc.rotate(-Math.PI / 2);
      }
      tc.drawImage(source, 0, 0);
      let read = await ocr.recognize(await tile.convertToBlob());
      let token = read.data.text.toUpperCase().replace(/[^1-7NTSHDC]/g, "");
      if (!/^[1-7](?:NT|[SHDC])$/.test(token)) {
        // Suppress the pale widget border and background before retrying the
        // small rotated contract text. Never turn a bare level into NT.
        const pixels = tc.getImageData(0, 0, tile.width, tile.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const [r, g, b] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
          const value = r + g + b < 350 && b > g * 1.25 && r > g * 1.1 ? 0 : 255;
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
          pixels.data[i + 3] = 255;
        }
        tc.putImageData(pixels, 0, 0);
        await ocr.setParameters({tessedit_pageseg_mode: PSM.SINGLE_LINE});
        const alternative = await ocr.recognize(await tile.convertToBlob());
        const alternativeToken = alternative.data.text.toUpperCase().replace(/[^1-7NTSHDC]/g, "");
        if (/^[1-7](?:NT|[SHDC])$/.test(alternativeToken) && alternative.data.confidence >= 60) {
          read = alternative;
          token = alternativeToken;
        }
        await ocr.setParameters({tessedit_pageseg_mode: PSM.SINGLE_WORD});
      }
      contractAttempts.push({
        rotation,
        text: read.data.text,
        confidence: read.data.confidence,
      });
      if (/^[1-7](?:NT|[SHDC])$/.test(token)) {
        contractRead = token;
        break;
      }
    }
  }
  const stackReads: { suit: Suit; text: string; confidence: number; band: [number, number] }[] = [];
  const stackCards: Candidate[] = [];
  const stackDiagnostics: unknown[] = [];
  if (white) {
    await ocr.setParameters({tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: "23456789TJQKA"});
    for (const c of all) {
      if (!/^[2-9TJQKA]$/.test(c.label!) || c.confidence! >= 0.65 || c.confidence! < 0.2) continue;
      const tile = new OffscreenCanvas((c.w + 12) * 3, (c.h + 12) * 3);
      const tc = tile.getContext("2d")!;
      tc.fillStyle = "white";
      tc.fillRect(0, 0, tile.width, tile.height);
      tc.drawImage(canvas, c.x, c.y, c.w, c.h, 18, 18, c.w * 3, c.h * 3);
      const blob = await tile.convertToBlob();
      let read = await ocr.recognize(blob);
      if (c.label === "Q" && (read.data.text.trim() !== "Q" || read.data.confidence < 60)) {
        await ocr.setParameters({tessedit_pageseg_mode: PSM.RAW_LINE});
        const alternative = await ocr.recognize(blob);
        if (alternative.data.text.trim() === "Q" && alternative.data.confidence >= 60) read = alternative;
        await ocr.setParameters({tessedit_pageseg_mode: PSM.SINGLE_CHAR});
      }
      const token = read.data.text.trim();
      if (token === c.label && read.data.confidence >= 60)
        c.confidence = Math.max(c.confidence!, read.data.confidence / 100);
    }
  }
  if (!white && fan) {
    const good: number[] = [];
    for (let y = Math.floor(h * 0.2); y < h * 0.7; y += 4) {
      let light = 0,
        total = 0;
      for (let x = Math.floor(w * 0.55); x < w * 0.99; x += 4) {
        const i = (y * w + x) * 4;
        if (data.data[i] + data.data[i + 1] + data.data[i + 2] > 680) light++;
        total++;
      }
      if (light / total > 0.23) good.push(y);
    }
    const bands: number[][] = [];
    for (const y of good) {
      const last = bands.at(-1);
      if (!last || y - last.at(-1)! > 8) bands.push([y]);
      else last.push(y);
    }
    const rows = bands.filter((b) => b.at(-1)! - b[0] > h * 0.05);
    if (rows.length === 4) {
      const alternate = await ort.InferenceSession.create(
        "/models/glyphs-lowres.onnx",
        { executionProviders: ["wasm"] },
      );
      const altInput = new Float32Array(comps.length * 1024);
      comps.forEach((c, i) => altInput.set(tensorOf(c, w, 90), i * 1024));
      const altOutput = await alternate.run({
          image: new ort.Tensor("float32", altInput, [comps.length, 1, 32, 32]),
        }),
        altLogits = altOutput.logits.data as Float32Array;
      for (let i = 0; i < comps.length; i++) {
        const row = Array.from(
            altLogits.slice(i * labels.length, (i + 1) * labels.length),
          ),
          max = Math.max(...row),
          exps = row.map((v) => Math.exp(v - max)),
          sum = exps.reduce((a, b) => a + b, 0);
        all[comps.length + i].altScores = exps.map((x) => x / sum);
      }
      await ocr.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "23456789TJQKA10",
      });
      for (let i = 0; i < 4; i++) {
        const top = Math.max(0, rows[i][0] - 8),
          height = Math.min(Math.round(h * 0.035), rows[i].at(-1)! - top),
          left = Math.floor(w * 0.55),
          width = w - left,
          strip = new OffscreenCanvas(width * 2, height * 2);
        strip.getContext("2d")!.drawImage(
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
        const read = await ocr.recognize(await strip.convertToBlob());
        stackReads.push({
          suit: (["S", "H", "C", "D"] as Suit[])[i],
          text: read.data.text,
          confidence: read.data.confidence,
          band: [rows[i][0], rows[i].at(-1)!],
        });
        const suit = (["S", "H", "C", "D"] as Suit[])[i],
          raw = all
            .filter(
              (c) =>
                c.rotation === 90 &&
                (c.scores || c.label === "10") &&
                c.x > w * 0.55 &&
                c.y > rows[i][0] - 12 &&
                c.y < rows[i][0] + h * 0.016 &&
                c.w > 4 &&
                c.h > 8,
            )
            .sort((a, b) => a.x - b.x),
          groups: Component[][] = [];
        for (const c of raw) {
          const group = groups.at(-1);
          if (!group || c.x - group[0].x > w * 0.018) groups.push([c]);
          else group.push(c);
        }
        const rankLabels = [..."23456789TJQKA"];
        const opposite = (c: Component) =>
          all.find(
            (x) =>
              x.rotation === 270 &&
              x.x === c.x &&
              x.y === c.y &&
              x.w === c.w &&
              x.h === c.h,
          );
        const rankProbability = (
          c: Component,
          label: string,
          covered: boolean,
        ) => {
          if ((c.label === "10" || c.label === "0") && label === "T")
            return c.confidence!;
          const li = labels.indexOf(label);
          return covered
            ? (opposite(c)?.scores?.[li] ?? c.scores?.[li] ?? 0)
            : Math.max(c.scores?.[li] ?? 0, c.altScores?.[li] ?? 0);
        };
        // Drop suit/art components before measuring the gap to the repeated
        // opposite corner of the fully exposed first card.
        for (let gi = groups.length - 1; gi >= 0; gi--) {
          const bestRank = Math.max(
            ...groups[gi].flatMap((c) =>
              rankLabels.map((rank) =>
                Math.max(
                  rankProbability(c, rank, false),
                  rankProbability(c, rank, true),
                ),
              ),
            ),
          );
          if (bestRank < 0.015) groups.splice(gi, 1);
        }
        if (groups.length >= 3) {
          const laterGaps = groups
            .slice(2)
            .map((g, j) => g[0].x - groups[j + 1][0].x)
            .sort((a, b) => a - b),
            normalGap = laterGaps[Math.floor(laterGaps.length / 2)];
          // The fully exposed first card also shows its opposite corner just
          // before the covered-card indices. It is the large-gap duplicate.
          if (normalGap && groups[1][0].x - groups[0][0].x > normalGap * 2)
            groups.splice(1, 1);
        }
        // A sideways ten is split into adjacent 1 and 0 components. Keep the
        // zero as the single T candidate and discard the preceding stem.
        for (let gi = groups.length - 2; gi >= 0; gi--) {
          if (
            groups[gi].every((c) => c.label === "1") &&
            groups[gi + 1].some((c) => c.label === "0")
          )
            groups.splice(gi, 1);
        }
        type State = { score: number; cards: { rank: string; c: Component; confidence: number }[] };
        let states: State[] = [{ score: 0, cards: [] }];
        for (const [groupIndex, group] of groups.entries()) {
          const next: State[] = [...states];
          for (const state of states) {
            const last = state.cards.length
              ? rankLabels.indexOf(state.cards.at(-1)!.rank)
              : -1;
            for (let ri = last + 1; ri < rankLabels.length; ri++) {
              const label = rankLabels[ri],
                best = group
                  .map((c) => ({
                    c,
                    p: rankProbability(c, label, groupIndex > 0),
                  }))
                  .sort((a, b) => b.p - a.p)[0];
              if (!best || best.p < 0.015) continue;
              next.push({
                score: state.score + Math.log(best.p + 0.001) + 2.7,
                cards: [...state.cards, { rank: label, c: best.c, confidence: best.p }],
              });
            }
          }
          const keyed = new Map<number, State>();
          for (const state of next) {
            const last = state.cards.length
              ? rankLabels.indexOf(state.cards.at(-1)!.rank)
              : -1,
              old = keyed.get(last);
            if (!old || state.score > old.score) keyed.set(last, state);
          }
          states = [...keyed.values()];
        }
        const best = states.sort((a, b) => b.score - a.score)[0];
        stackDiagnostics.push({
          suit,
          groups: groups.map((group, groupIndex) =>
            group.map((c) => ({
              x: c.x,
              label: c.label,
              top: rankLabels
                .map((label) => ({
                  label,
                  p: rankProbability(c, label, groupIndex > 0),
                }))
                .sort((a, b) => b.p - a.p)
                .slice(0, 3),
            })),
          ),
          best: best.cards.map((card) => ({rank: card.rank, x: card.c.x, confidence: card.confidence})),
        });
        for (const card of best.cards)
          stackCards.push({
            seat: "E",
            card: `${suit}${card.rank}` as Card,
            confidence: Math.max(0.55, Math.min(0.9, card.confidence)),
            box: [card.c.x / w, card.c.y / h, card.c.w / w, card.c.h / h],
          });
      }
      await alternate.release();
    }
  }
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
        (!fan && c.confidence! > 0.995 && c.label !== "T")
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
      const label = read.data.text.trim().replace(/^10$/, "T");
      if (/^[0-9TJQKA]$/.test(label) && read.data.confidence >= 80 &&
        !(fan && c.confidence! >= 0.995 && c.label !== label && read.data.confidence < 95)) {
        c.label = label;
        c.confidence = read.data.confidence / 100;
      }
      // In the playing-card face used by the fan layout, A has two lower
      // legs while 4 concentrates its left stroke in the middle. This check
      // resolves the otherwise recurrent A/4 ambiguity after deskewing.
      if (
        fan &&
        c.label === "4" &&
        c.profile &&
        c.profile[6] > c.profile[2] * 1.5
      ) {
        c.label = "A";
        c.confidence = Math.max(c.confidence!, 0.9);
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
        // Prefer the joined 10 over a J-like interpretation of the narrow 1.
        confidence: Math.min(
          1,
          Math.min(Math.max(a.confidence!, 0.7), zero.confidence!) + 0.025,
        ),
        x: Math.min(a.x, zero.x),
        y: Math.min(a.y, zero.y),
        w: Math.max(a.x + a.w, zero.x + zero.w) - Math.min(a.x, zero.x),
        h: Math.max(a.y + a.h, zero.y + zero.h) - Math.min(a.y, zero.y),
      });
  }
  const sideStack: Candidate[] = [];
  if (!white && fan) {
    const rawRows: Component[][] = [];
    for (const c of all
      .filter(
        (c) =>
          c.rotation === 270 &&
          c.x > w * 0.55 &&
          c.y > h * 0.3 &&
          c.y < h * 0.68 &&
          /^(?:[2-9TJQKA]|10)$/.test(c.label!) &&
          c.confidence! > 0.7,
      )
      .sort((a, b) => a.y + a.h / 2 - b.y - b.h / 2)) {
      const center = c.y + c.h / 2,
        row = rawRows.find(
          (r) =>
            Math.abs(
              r.reduce((n, x) => n + x.y + x.h / 2, 0) / r.length - center,
            ) < h * 0.009,
        );
      row ? row.push(c) : rawRows.push([c]);
    }
    const rows: Component[][] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const current = rawRows[i],
        ranks = new Set(current.map((c) => c.label));
      if (
        rawRows[i + 1] &&
        rawRows[i + 1].filter((c) => ranks.has(c.label)).length >= 2
      )
        i++;
      rows.push(current);
    }
    if (rows.length === 4) {
      for (const row of rows) {
        const center = row.reduce((n, c) => n + c.y + c.h / 2, 0) / row.length,
          red = row.some((c) => redFraction(c) > 0.5),
          allowed = red ? ["H", "D"] : ["S", "C"],
          anchors = all.filter(
            (c) =>
              c.rotation === 270 &&
              allowed.includes(c.label!) &&
              c.confidence! > 0.75 &&
              Math.abs(c.y + c.h / 2 - center) < h * 0.025,
          ),
          anchor = anchors.sort((a, b) => b.confidence! - a.confidence!)[0];
        if (!anchor) continue;
        let ordered = row
          .sort((a, b) => a.x - b.x)
          .filter(
            (c, i, list) =>
              c.label === "10" ||
              !list.some(
                (other) =>
                  other.label === "10" &&
                  other.x <= c.x &&
                  other.x + other.w >= c.x + c.w,
              ),
          );
        const laterGaps = ordered
          .slice(2)
          .map((c, i) => c.x - ordered[i + 1].x)
          .filter((x) => x > 10),
          normalGap = laterGaps.sort((a, b) => a - b)[Math.floor(laterGaps.length / 2)] ?? 48;
        if (ordered.length > 2 && ordered[1].x - ordered[0].x > normalGap * 3)
          ordered = [ordered[0], ...ordered.slice(2)];
        const seenRanks = new Set<string>();
        for (const c of ordered) {
          if (seenRanks.has(c.label!)) continue;
          let label = c.label === "10" ? "T" : c.label!;
          if (c.label !== "10") {
            const tensor = tensorOf(c, w, 270),
              tile = new OffscreenCanvas(96, 96),
              pixels = new Uint8ClampedArray(32 * 32 * 4);
            for (let i = 0; i < 1024; i++) {
              pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 255 - Math.round(tensor[i] * 255);
              pixels[i * 4 + 3] = 255;
            }
            const small = new OffscreenCanvas(32, 32);
            small.getContext("2d")!.putImageData(new ImageData(pixels, 32, 32), 0, 0);
            tile.getContext("2d")!.drawImage(small, 0, 0, 96, 96);
            const read = await ocr.recognize(await tile.convertToBlob());
            const recognized = read.data.text.trim();
            if (/^[2-9TJQKA]$/.test(recognized) && read.data.confidence >= 75)
              label = recognized;
          }
          seenRanks.add(label);
          sideStack.push({
            seat: "E",
            card: `${anchor.label}${label}` as Card,
            confidence: Math.min(anchor.confidence!, c.confidence!),
            box: [c.x / w, c.y / h, c.w / w, c.h / h],
          });
        }
      }
    }
  }
  const candidates: Candidate[] = [];
  const recognizedTextRows = new WeakMap<Candidate, Component>();
  let debugBeforeReconcile: Candidate[] = [];
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
            anchor.y - c.y < anchor.h * 9 &&
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
    // Some fonts detach the spade stem, so neither fragment resembles a
    // complete spade. Confirm its row from the aligned H/D/C symbol column;
    // the rank text is still read from the actual image below.
    for (const heart of [...symbols].filter((c) => c.label === "H")) {
      const diamond = symbols.find((c) => c.label === "D" &&
        Math.abs(c.x - heart.x) < w * 0.015 &&
        c.y > heart.y + heart.h && c.y < heart.y + h * 0.05);
      if (!diamond) continue;
      const step = diamond.y - heart.y;
      const club = symbols.find((c) => c.label === "C" &&
        Math.abs(c.x - heart.x) < w * 0.015 &&
        Math.abs(c.y - diamond.y - step) < step * 0.22);
      if (!club) continue;
      const expectedY = heart.y - step;
      if (symbols.some((c) => c.label === "S" &&
        Math.abs(c.x - heart.x) < w * 0.015 && Math.abs(c.y - expectedY) < step * 0.25)) continue;
      const fragment = all.filter((c) =>
        Math.abs(c.x - heart.x) < w * 0.01 &&
        Math.abs(c.y - expectedY) < step * 0.2 &&
        c.w > heart.w * 0.55 && c.h > heart.h * 0.4 &&
        redFraction(c) < 0.2).sort((a, b) => b.h - a.h)[0];
      if (fragment) symbols.push({...fragment, label: "S", confidence: 0.85});
    }
    for (const anchor of symbols) {
      const s = zone(anchor.x, anchor.y);
      if (!s) continue;
      const glyphs = comps.filter(
        (c) =>
          c.x > anchor.x + anchor.w &&
          c.x < anchor.x + w * 0.33 &&
          Math.abs(c.y + c.h / 2 - anchor.y - anchor.h / 2) < anchor.h * 1.1 &&
          c.h > anchor.h * 0.4 &&
          c.h < anchor.h * 2.2,
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
      let read = await ocr.recognize(
        await strip.convertToBlob(),
        {},
        { text: true, blocks: true },
      );
      if (read.data.confidence < 65 || !/^[2-9TJQKA]{1,13}$/.test(read.data.text.replace(/\s+/g, "").replace(/10/g, "T"))) {
        await ocr.setParameters({tessedit_pageseg_mode: PSM.RAW_LINE});
        const alternative = await ocr.recognize(await strip.convertToBlob(), {}, {text: true, blocks: true});
        if (alternative.data.confidence > read.data.confidence && /^[2-9TJQKA]{1,13}$/.test(alternative.data.text.replace(/\s+/g, "").replace(/10/g, "T"))) read = alternative;
        await ocr.setParameters({tessedit_pageseg_mode: PSM.SINGLE_LINE});
      }
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
          const candidate: Candidate = {
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
          };
          recognizedTextRows.set(candidate, anchor);
          candidates.push(candidate);
        }
        // Reconcile an OCR symbol with the visible components it covers.
        // This also handles 8 misread as 3 and a merged "87" read as "7".
        for (const token of candidates.filter(c => recognizedTextRows.get(c) === anchor)) {
          const [tx, ty, tw, th] = [token.box[0] * w, token.box[1] * h, token.box[2] * w, token.box[3] * h];
          const glyphs = all.filter(c => /^(?:[2-9TJQKA]|10)$/.test(c.label!) && c.confidence! >= 0.98 &&
            c.x + c.w / 2 >= tx && c.x + c.w / 2 <= tx + tw &&
            Math.abs(c.y - ty) <= c.h * 0.3 && c.h >= th * 0.65 && c.h <= th * 1.3)
            .sort((a, b) => a.x - b.x || b.w - a.w);
          if (!glyphs.length || Math.abs(glyphs[0].x - tx) > th * 0.25 ||
            Math.abs(glyphs.at(-1)!.x + glyphs.at(-1)!.w - tx - tw) > th * 0.25 ||
            glyphs.some((g, i) => i > 0 && (g.x < glyphs[i - 1].x + glyphs[i - 1].w - 1 ||
              g.x - glyphs[i - 1].x - glyphs[i - 1].w > th * 0.7))) continue;
          if (glyphs.length === 1 && token.card.slice(1) === glyphs[0].label) continue;
          candidates.splice(candidates.indexOf(token), 1);
          recognizedTextRows.delete(token);
          for (const g of glyphs) {
            const recovered: Candidate = { seat: s, card: `${anchor.label}${g.label === "10" ? "T" : g.label}` as Card,
              confidence: Math.min(anchor.confidence!, g.confidence!), box: [g.x / w, g.y / h, g.w / w, g.h / h] };
            recognizedTextRows.set(recovered, anchor);
            candidates.push(recovered);
          }
        }
        // A narrow J next to Q can be swallowed by a single OCR symbol even
        // though the connected-component model sees two separate glyphs.
        // Recover only from two confident, aligned image components inside
        // that symbol's box; never infer a J from the missing-card inventory.
        const rowCandidates = candidates.filter(c => recognizedTextRows.get(c) === anchor);
        if (!rowCandidates.some(c => c.card === `${anchor.label}J`)) {
          for (const j of all.filter(c => c.label === "J" && c.confidence! >= 0.98 &&
            c.x > left && c.x + c.w <= left + width &&
            c.y >= top && c.y + c.h <= bottom && c.h > anchor.h * 0.55)) {
            const merged = rowCandidates.find(c => c.card.endsWith("Q") &&
              c.box[0] * w < j.x && (c.box[0] + c.box[2]) * w >= j.x + j.w * 0.5);
            if (!merged) continue;
            const q = all.find(c => c.label === "Q" && c.confidence! >= 0.98 &&
              c.x < j.x && c.x + c.w <= j.x + 1 && j.x - c.x - c.w < j.h * 0.35 &&
              Math.abs(c.y - j.y) < j.h * 0.2 &&
              Math.abs(c.x - merged.box[0] * w) < j.h * 0.2);
            if (!q) continue;
            const recovered: Candidate = {
              seat: s, card: `${anchor.label}J` as Card,
              confidence: Math.min(anchor.confidence!, j.confidence!, q.confidence!),
              box: [j.x / w, j.y / h, j.w / w, j.h / h],
            };
            recognizedTextRows.set(recovered, anchor);
            candidates.push(recovered);
            break;
          }
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
              anchor.h * 1.1 &&
            c.h > anchor.h * 0.55 &&
            c.h < anchor.h * 2.2,
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
            (c.confidence! > 0.7 || (fan && seat === "S" && r.confidence! >= 0.95 &&
              c.label === "C" && c.confidence! > 0.6 && c.symmetry! > 0.74 &&
              redFraction(c) < 0.1 && redFraction(r) < 0.1)),
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
  debugBeforeReconcile = candidates.map((c) => structuredClone(c));
  // Flat-hand reconciliation below uses the original corner candidates.
  // Do not OCR those rows here: that result would be discarded in full.
  if (stackCards.length >= 8) {
    for (let i = candidates.length - 1; i >= 0; i--)
      if (candidates[i].seat === "E") candidates.splice(i, 1);
    candidates.push(...stackCards);
  } else if (sideStack.length >= 8) {
    for (let i = candidates.length - 1; i >= 0; i--)
      if (candidates[i].seat === "E") candidates.splice(i, 1);
    candidates.push(...sideStack);
  }
  const flatFourHands =
    !white &&
    !fan &&
    SEATS.every((s) => debugBeforeReconcile.filter((c) => c.seat === s).length >= 8);
  if (flatFourHands) {
    // The component/card-corner pass is more reliable than whole-row OCR on
    // compressed screenshots. Clean its row geometry, then recover ranks whose
    // suit glyph touched a card border by using the visible suit grouping.
    candidates.splice(0, candidates.length, ...debugBeforeReconcile);
    const median = (values: number[]) => {
      const a = [...values].sort((x, y) => x - y);
      return a[Math.floor(a.length / 2)];
    };
    for (const seat of SEATS) {
      const vertical = seat === "E" || seat === "W",
        rv = { N: 0, S: 0, W: 270, E: 90 }[seat],
        own = candidates.filter((c) => c.seat === seat),
        cross = (c: Candidate) =>
          vertical
            ? (c.box[0] + c.box[2] / 2) * w
            : (c.box[1] + c.box[3] / 2) * h,
        along = (c: Candidate) =>
          vertical
            ? (c.box[1] + c.box[3] / 2) * h
            : (c.box[0] + c.box[2] / 2) * w,
        axis = median(own.map(cross)),
        size = median(
          own.map((c) => (vertical ? c.box[2] * w : c.box[3] * h)),
        );
      let row = own
        .filter((c) => Math.abs(cross(c) - axis) < size * 0.68)
        .sort((a, b) => along(a) - along(b));
      const positions = [
        ...new Set(row.map((c) => Math.round(along(c) / (size * 0.25)))),
      ].map((x) => x * size * 0.25);
      const gaps = positions
        .slice(1)
        .map((x, i) => x - positions[i])
        .filter((x) => x > size * 0.35),
        gap = median(gaps) || size * 1.4;
      const cut = positions.findIndex((x, i) => i > 5 && x - positions[i - 1] > gap * 2.45 &&
        // A gap in accepted cards is not the end of the row when visible
        // rank glyphs occupy it (their suit may have failed recognition).
        !all.some(r => r.rotation === rv && /^(?:[2-9TJQKA]|10)$/.test(r.label!) && r.confidence! >= 0.72 &&
          Math.abs((vertical ? r.x + r.w / 2 : r.y + r.h / 2) - axis) < size * 0.75 &&
          (vertical ? r.y + r.h / 2 : r.x + r.w / 2) > positions[i - 1] + gap * 0.3 &&
          (vertical ? r.y + r.h / 2 : r.x + r.w / 2) < x - gap * 0.3));
      if (cut > 0) {
        const limit = (positions[cut - 1] + positions[cut]) / 2;
        row = row.filter((c) => along(c) < limit);
      }
      for (let i = candidates.length - 1; i >= 0; i--)
        if (candidates[i].seat === seat && !row.includes(candidates[i]))
          candidates.splice(i, 1);

      const ordered = () =>
        candidates
          .filter((c) => c.seat === seat)
          .sort((a, b) => along(a) - along(b));
      const first = along(row[0]) - gap * 0.7,
        last = along(row.at(-1)!) + gap * 0.7;
      for (const r of all) {
        if (
          r.rotation !== rv ||
          !/^(?:[2-9TJQKA]|10)$/.test(r.label!) ||
          r.confidence! < 0.72
        )
          continue;
        const rcross = vertical ? r.x + r.w / 2 : r.y + r.h / 2,
          ralong = vertical ? r.y + r.h / 2 : r.x + r.w / 2;
        if (
          Math.abs(rcross - axis) > size * 0.75 ||
          ralong < first ||
          ralong > last ||
          ordered().some((c) => Math.abs(along(c) - ralong) < gap * 0.3)
        )
          continue;
        const before = ordered().filter((c) => along(c) < ralong).at(-1),
          after = ordered().find((c) => along(c) > ralong),
          inferredSuit = after
            ? (before && before.card[0] !== after.card[0] &&
                /[HD]/.test(before.card[0]) && !/[HD]/.test(after.card[0]) && redFraction(r) > 0.7
                ? before.card[0] as Suit : after.card[0] as Suit)
            : before
              ? (before.card[0] as Suit)
              : undefined;
        if (!inferredSuit) continue;
        candidates.push({
          seat,
          card: `${inferredSuit}${r.label === "10" ? "T" : r.label}` as Card,
          confidence: Math.min(0.82, r.confidence! * 0.84),
          box: [r.x / w, r.y / h, r.w / w, r.h / h],
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
          !(recognizedTextRows.has(c) &&
            recognizedTextRows.get(c) === recognizedTextRows.get(x) &&
            x.card !== c.card) &&
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
    if (
      selected.some(
        (x) => x.card === c.card && (flatFourHands || x.seat === c.seat),
      )
    )
      continue;
    selected.push(c);
  }
  const physicalCounts = Object.fromEntries(
      SEATS.map((s) => [s, selected.filter((c) => c.seat === s).length]),
    ) as Record<Seat, number>,
    topDummyRotated =
      fan &&
      physicalCounts.N >= 10 &&
      physicalCounts.S >= 10 &&
      physicalCounts.E === 0 &&
      physicalCounts.W === 0 &&
      /\bSOUTH\b/i.test(sceneText),
    seatMap: Record<Seat, Seat> = topDummyRotated
      ? { N: "S", E: "W", S: "N", W: "E" }
      : { N: "N", E: "E", S: "S", W: "W" };
  for (const c of selected) c.seat = seatMap[c.seat];
  const tableCardRegions = !white && fan
    ? colourRegions(data, (r, g, b) => r + g + b > 650)
        .filter(
          (b) =>
            b.x > w * 0.12 &&
            b.x + b.w < w * 0.62 &&
            b.y > h * 0.25 &&
            b.y < h * 0.68 &&
            b.w > w * 0.08 &&
            b.h > h * 0.035 &&
            b.w < w * 0.4 &&
            b.h < h * 0.16 &&
            b.area / (b.w * b.h) > 0.25,
        )
        .sort((a, b) => a.y - b.y)
    : [];
  const tableCards: Candidate[] = [];
  const rotationSeat: Record<number, Seat> = {0: "N", 90: "E", 180: "S", 270: "W"};
  for (const box of tableCardRegions) {
    const interpretations: Candidate[] = [];
    for (const rank of all) {
      if (
        !/^(?:[2-9TJQKA]|10)$/.test(rank.label!) ||
        rank.confidence! < 0.68 ||
        rank.x < box.x - 3 ||
        rank.y < box.y - 3 ||
        rank.x + rank.w > box.x + box.w + 3 ||
        rank.y + rank.h > box.y + box.h + 3 ||
        Math.max(rank.w, rank.h) > Math.min(box.w, box.h) * 0.38
      )
        continue;
      const size = Math.max(rank.w, rank.h),
        suit = all
          .filter(
            (c) =>
              c.rotation === rank.rotation &&
              SUITS.includes(c.label as Suit) &&
              c.confidence! > 0.75 &&
              c.x >= box.x - 3 &&
              c.y >= box.y - 3 &&
              c.x + c.w <= box.x + box.w + 3 &&
              c.y + c.h <= box.y + box.h + 3,
          )
          .map((c) => {
            const [xx, yy] = inverseVector(
              c.x + c.w / 2 - rank.x - rank.w / 2,
              c.y + c.h / 2 - rank.y - rank.h / 2,
              (360 - rank.rotation!) % 360,
            );
            return {c, xx, yy};
          })
          .filter(
            ({c, xx, yy}) =>
              yy > size * 0.22 &&
              yy < size * 1.8 &&
              Math.abs(xx) < size * 0.65 &&
              Math.max(c.w, c.h) < size * 1.8,
          )
          .sort((a, b) => Math.hypot(a.xx, a.yy) - Math.hypot(b.xx, b.yy))[0];
      const physicalSeat = rotationSeat[rank.rotation!];
      if (!suit || !physicalSeat) continue;
      interpretations.push({
        seat: seatMap[physicalSeat],
        card: `${suit.c.label}${rank.label === "10" ? "T" : rank.label}` as Card,
        confidence: Math.min(rank.confidence!, suit.c.confidence!),
        box: [box.x / w, box.y / h, box.w / w, box.h / h],
      });
    }
    const best = interpretations.sort((a, b) => b.confidence - a.confidence)[0];
    if (best && !tableCards.some((c) => c.seat === best.seat)) tableCards.push(best);
  }
  const board = boardFromHands(["?", "?", "?", "?"], "图片识牌 · 待核对");
  for (const s of SEATS) {
    const cards = selected.filter((c) => c.seat === s).map((c) => c.card);
    board.position.hands[s] = cards.length ? sortCards(cards) : null;
  }
  const dealer =
    sceneText.match(/D(?:EA)?[IL1]R?(?:ER)?\s*[:;]?\s*([NESW])/i)?.[1] ??
    sceneText.match(/Dealer\s*[:;]?\s*([NESW])/i)?.[1];
  if (dealer) board.dealer = dealer.toUpperCase() as Seat;
  const compactScene = sceneText.replace(/\s+/g, " "),
    vulnerability =
      compactScene.match(/Vul\s*[:;]?\s*(None|N\s*[-]?\s*S|E\s*[-]?\s*W|All)/i)?.[1] ??
      compactScene.match(/(None|N\s*[-]?\s*S|E\s*[-]?\s*W|All)\s+Vul/i)?.[1];
  if (vulnerability) {
    const v = vulnerability.replace(/\s|-/g, "").toUpperCase();
    board.vulnerability =
      v === "NS" ? "NS" : v === "EW" ? "EW" : v === "ALL" ? "All" : "None";
  }
  const boardNumber = white
    ? compactScene.match(/\b(\d{1,2})\s*\/\s*(?:12|16)\b/)?.[1]
    : undefined;
  if (boardNumber) board.number = Number(boardNumber);
  const tileContract = contractAttempts
      .map((attempt) => attempt.text.toUpperCase().replace(/[^1-7NTSHDC]/g, ""))
      .map((token) =>
        /^[1-7](?:T|N|7)$/.test(token) ? `${token[0]}NT` : "",
      )
      .find(Boolean) ?? "",
    recoveredContract =
      contractRead ||
      tileContract ||
      (!purple
        ? compactScene.match(/\b([1-7])\s*(NT|[SHDC])\b/i)?.slice(1).join("")
        : "") ||
      "";
  if (recoveredContract) {
    board.position.contract.level = Number(recoveredContract[0]);
    board.position.contract.strain = recoveredContract.slice(1).toUpperCase() as
      | Suit
      | "NT";
    if (fan) {
      const physicalDummy: Seat = stackReads.length === 4 ||
        (physicalCounts.E >= 8 && physicalCounts.N <= 3 && physicalCounts.W <= 3) ? "E" : "N";
      const dummy = seatMap[physicalDummy];
      board.position.contract.declarer = SEATS[(SEATS.indexOf(dummy) + 2) % 4];
      board.position.leader = SEATS[(SEATS.indexOf(board.position.contract.declarer) + 1) % 4];
    }
  }
  if (tableCards.length) {
    const seats = new Set(tableCards.map((c) => c.seat));
    const leader = SEATS.find((start) =>
      tableCards.every((_, i) => seats.has(SEATS[(SEATS.indexOf(start) + i) % 4])),
    );
    if (leader) {
      board.position.leader = leader;
      board.position.current = [...tableCards]
        .sort(
          (a, b) =>
            (SEATS.indexOf(a.seat) - SEATS.indexOf(leader) + 4) % 4 -
            ((SEATS.indexOf(b.seat) - SEATS.indexOf(leader) + 4) % 4),
        )
        .map(({seat, card}) => ({seat, card}));
      for (const {seat, card} of board.position.current) {
        const hand = board.position.hands[seat];
        if (hand?.includes(card)) board.position.hands[seat] = hand.filter((c) => c !== card);
      }
    }
  }
  const warnings: string[] = [];
  if (!flatFourHands && !topDummyRotated)
    warnings.push("未能验证全部画面方位，请核对 N/S/W/E");
  if (!recoveredContract) warnings.push("未识别定约，请确认后分析");
  else if (!contractRead && tileContract) warnings.push("定约字样不清，当前为候选定约，请核对 NT 与阶数");
  if (!dealer) warnings.push("未识别发牌方");
  if (!vulnerability) warnings.push("未识别局况");
  if (fan && !tableCards.length) warnings.push("当前墩仍需核对");
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
    ...(debug && import.meta.env.DEV ? {debug: {w,h,fan,white,sceneText,contractRead,contractAttempts,purple,stackReads,stackCards,stackDiagnostics,tableCardRegions,tableCards,seatMap,all: all.map(({pixels,scores,altScores,...c})=>({...c,modelLabel:scores?labels[scores.indexOf(Math.max(...scores))]:undefined,modelConfidence:scores?Math.max(...scores):undefined})),beforeReconcile:debugBeforeReconcile,afterReconcile:candidates}} : {}),
  };
}
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ result: await run(data.bitmap, data.debug === true) });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
