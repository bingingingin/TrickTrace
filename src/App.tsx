import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Download,
  Play,
  Pause,
  RotateCcw,
  ArrowUpRight,
  Layers,
  ScanLine,
  PanelLeftClose,
  Settings2,
  X,
  Check,
  LoaderCircle,
  GitBranch,
  Square,
  BookOpen,
  Focus,
  Copy,
  ArrowRight,
  Trash2,
} from "lucide-react";
import {
  SEATS,
  SUITS,
  STRAINS,
  SYMBOL,
  LABEL,
  type Board,
  type Position,
  type Card,
  type Seat,
  type Evaluation,
  type Line,
  type Tactic,
  type SampleResult,
  type Constraint,
  type Move,
} from "./core/types";
import { demoBoard } from "./core/demo";
import {
  boardFromHands,
  handText,
  parseHand,
  validate,
  next,
  turn,
  side,
  legalCards,
  play,
  suit,
  rank,
  remainingTricks,
  score,
  sortCards,
} from "./core/cards";
import { importBoards, exportPbn } from "./core/formats";
import { compute, cancelAll } from "./engine/client";
import { recognize, type Recognition } from "./vision/recognize";
import CardPicker from "./components/CardPicker";
import ImageReview from "./components/ImageReview";
import LeadConstraints from "./components/LeadConstraints";
import {validateConstraints} from "./engine/lead-constraints";
import { chooseOptimal } from "./engine/line-policy";
import { getTable, tableKey, canCalculateTable } from "./engine/table-client";
import { boardMetadata, nextBoardNumber } from "./core/board-number";
import { classifyPlay, PLAY_KNOWLEDGE } from "./core/play-knowledge";

type Branch = {
  id: string;
  name: string;
  positions: Position[];
  cursor: number;
};
type Session = { branches: Branch[]; active: string };
type Stored = {
  version: 1;
  boards: Board[];
  selected: number;
  sessions: Record<string, Session>;
};
const STORAGE = "tricktrace.v1";
function initial(): Stored {
  try {
    const x = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (x?.version === 1 && x.boards?.length) {
      x.boards.forEach((b: Board) => {
        if (validate(b.position, false).length) throw Error();
      });
      return {
        ...x,
        selected: Math.min(x.selected ?? 0, x.boards.length - 1),
        sessions: x.sessions ?? {},
      };
    }
  } catch {
    /* Invalid local data never reaches the solver. */
  }
  return { version: 1, boards: [demoBoard()], selected: 0, sessions: {} };
}
const fmt = (c: Card) => SYMBOL[suit(c)] + c.slice(1).replace("T", "10");
const contractText = (p: Position) =>
  `${p.contract.level}${p.contract.strain === "NT" ? "NT" : SYMBOL[p.contract.strain]}${"X".repeat(p.contract.doubled)} · ${LABEL[p.contract.declarer]}`;
function download(name: string, text: string, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function seedSession(b: Board): Session {
  const id = crypto.randomUUID();
  return {
    active: id,
    branches: [
      {
        id,
        name: "原始牌路",
        positions: [structuredClone(b.position)],
        cursor: 0,
      },
    ],
  };
}
export default function App() {
  const [store, setStore] = useState<Stored>(initial),
    [editing, setEditing] = useState<Board | null>(null),
    [imageResult, setImageResult] = useState<Recognition | null>(null),
    [imageURL, setImageURL] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null),
    [table, setTable] = useState<{
      table: number[][];
      par: { score: number; contracts: string[] };
    } | null>(null),
    [lineResult, setLineResult] = useState<{
      line: Line;
      tactics: { items: Tactic[]; complete: boolean; examined: number };
    } | null>(null),
    [lineOpen, setLineOpen] = useState(false);
  const [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"moves" | "table" | "experiment" | "lead">(
      "moves",
    ),
    [rot, setRot] = useState(0),
    [auto, setAuto] = useState(false),
    [autoMode, setAutoMode] = useState(false),
    [help, setHelp] = useState(false),
    [paste, setPaste] = useState(false),
    [pasteText, setPasteText] = useState(""),
    [sample, setSample] = useState<SampleResult | null>(null),
    [leadSample, setLeadSample] = useState<import('./engine/lead-pool').LeadResult | null>(null),
    [leadMode, setLeadMode] = useState<'beat'|'exact'>('beat'),
    [leadInputValid, setLeadInputValid] = useState(true),
    [leadCount, setLeadCount] = useState(1000),
    [leadConstraints, setLeadConstraints] = useState<Constraint[]>([]),
    [singleDummyEnabled, setSingleDummyEnabled] = useState(false),
    [sampleCount, setSampleCount] = useState(128),
    [sampleSeed, setSampleSeed] = useState(20260905),
    [objective, setObjective] = useState<"contract" | "tricks">("contract"),
    [constraints, setConstraints] = useState("[]"),
    [observed, setObserved] = useState(""),
    [tableError, setTableError] = useState(""),
    [review, setReview] = useState<(Move & { seat: Seat })[] | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null),
    gen = useRef(0),
    lastCardAt = useRef(0),
    lineAnchor = useRef<HTMLDivElement>(null);
  const board = store.boards[store.selected],
    session = store.sessions[board.id],
    branch = session?.branches.find((b) => b.id === session.active),
    position = branch?.positions[branch.cursor] ?? board.position,
    full = SEATS.every((s) => position.hands[s] !== null),
    errors = validate(position, full),
    currentSeat = turn(position),
    totalPlayed = position.history.length * 4 + position.current.length,
    baseline = branch?.positions[0] ?? board.position;
  const available =
    full && !errors.length && remainingTricks(position)
      ? legalCards(position)
      : [];
  useEffect(()=>{setLeadConstraints([]);setLeadSample(null);},[board.singleDummySourceId ?? board.id]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(store));
    } catch {
      setError("本地存储空间不足，请导出项目 JSON 保存进度");
    }
  }, [store]);
  useEffect(() => {
    const id = ++gen.current;
    cancelAll();
    setLineResult(null);
    setSample(null);
    setLeadSample(null);
    setReview(null);
    setEvaluation(null);
    setBusy("");
    setError("");
    if (!full || errors.length) return;
    setBusy("正在分析当前局面");
    compute<Evaluation>("solve", [position])
      .then((e) => {
        if (id === gen.current) setEvaluation(e);
      })
      .catch((e) => {
        if (id === gen.current) setError(e.message);
      })
      .finally(() => {
        if (id === gen.current) setBusy("");
      });
    return () => {
      gen.current++;
    };
  }, [board.id, position]);
  const boardTableKey = tableKey(board);
  useEffect(() => {
    let active = true;
    setTable(null);
    setTableError("");
    if (canCalculateTable(board) && !validate(board.position).length)
      getTable(board)
        .then((result) => {
          if (active) setTable(result);
        })
        .catch((e) => {
          if (active) setTableError(e.message);
        });
    return () => {
      active = false;
    };
  }, [boardTableKey]);
  const leadChoice =
    position.history[0]?.cards[0]?.card ?? position.current[0]?.card ?? "";
  async function task<T>(
    label: string,
    method: string,
    args: unknown[],
    apply: (result: T) => void,
  ) {
    const id = gen.current;
    setBusy(label);
    setProgress(0);
    setError("");
    try {
      const r = await compute<T>(
        method,
        args,
        setProgress,
        method === "openingLead" ? 1800000 : method === "sample" ? 300000 : 180000,
      );
      if (id === gen.current) apply(r);
    } catch (e) {
      if (id === gen.current) setError((e as Error).message);
    } finally {
      if (id === gen.current) setBusy("");
    }
  }
  function updateSession(fn: (s: Session) => Session) {
    setStore((old) => ({
      ...old,
      sessions: {
        ...old.sessions,
        [board.id]: fn(
          structuredClone(old.sessions[board.id] ?? seedSession(board)),
        ),
      },
    }));
  }
  function prepareSingleDummyCopy() {
    const source = board.position;
    if (
      source.current.length ||
      source.history.length ||
      source.won[0] + source.won[1] ||
      source.hands[source.leader]?.length !== 13
    ) {
      setError("需要一副未出牌且首攻方手牌完整的牌局");
      return;
    }
    const copy = structuredClone(board);
    copy.id = crypto.randomUUID();
    copy.singleDummySourceId = board.id;
    copy.name = `${board.name} · 单明手`;
    copy.record = [];
    SEATS.forEach((seat) => {
      if (seat !== copy.position.leader) copy.position.hands[seat] = null;
    });
    setStore((old) => ({
      ...old,
      boards: [...old.boards, copy],
      selected: old.boards.length,
    }));
    setTab("lead");
  }
  function closeSingleDummy() {
    setSingleDummyEnabled(false);
    setTab("moves");
    setAuto(false);
    gen.current++;
    cancelAll();
    setBusy("");
    setLeadSample(null);
    setStore(old=>{
      const current=old.boards[old.selected];
      const original=old.boards.findIndex(candidate=>current.singleDummySourceId
        ? candidate.id===current.singleDummySourceId
        : current.name===`${candidate.name} · 单明手` && SEATS.every(s=>candidate.position.hands[s]?.length===13) && JSON.stringify(candidate.position.hands[current.position.leader])===JSON.stringify(current.position.hands[current.position.leader]));
      return original>=0?{...old,selected:original}:old;
    });
  }
  function playCard(card: Card, obs = false) {
    try {
      const q = play(position, card, obs);
      setAuto(false);
      updateSession((s) => {
        let b = s.branches.find((x) => x.id === s.active)!;
        if (b.cursor < b.positions.length - 1) {
          const copy = {
            id: crypto.randomUUID(),
            name: `分支 ${s.branches.length + 1} · ${fmt(card)}`,
            positions: b.positions.slice(0, b.cursor + 1),
            cursor: b.cursor,
          };
          s.branches.push(copy);
          s.active = copy.id;
          b = copy;
        }
        b.positions.push(q);
        b.cursor++;
        return s;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function moveCursor(delta: number) {
    setAuto(false);
    updateSession((s) => {
      const b = s.branches.find((x) => x.id === s.active)!;
      b.cursor =
        delta === -100
          ? 0
          : Math.max(0, Math.min(b.positions.length - 1, b.cursor + delta));
      return s;
    });
  }
  useEffect(() => {
    setAuto(false);
  }, [board.id]);
  function advance() {
    lastCardAt.current = Date.now();
    updateSession((s) => {
      const b = s.branches.find((x) => x.id === s.active)!;
      if (b.cursor < b.positions.length - 1) b.cursor++;
      else {
        const card = evaluation
          ? chooseOptimal(b.positions[b.cursor], evaluation.moves)?.card
          : undefined;
        if (card) {
          b.positions.push(play(b.positions[b.cursor], card));
          b.cursor++;
        }
      }
      return s;
    });
  }
  useEffect(() => {
    if (!auto) return;
    if (!remainingTricks(position)) {
      setAuto(false);
      return;
    }
    if (error || errors.length) {
      setAuto(false);
      return;
    }
    if (
      busy ||
      (!evaluation && !(branch && branch.cursor < branch.positions.length - 1))
    )
      return;
    const hold =
      position.current.length === 0 && position.history.length > 0 ? 1000 : 120;
    const delay = Math.max(0, hold - (Date.now() - lastCardAt.current));
    const timer = setTimeout(advance, delay);
    return () => clearTimeout(timer);
  }, [auto, position, evaluation, busy, error]);
  function startPlayback() {
    if (auto) {
      setAuto(false);
      return;
    }
    if (autoMode) {
      lastCardAt.current = Date.now();
      setAuto(true);
    } else advance();
  }
  const shownCards = position.current.length
    ? position.current
    : (position.history.at(-1)?.cards ?? []);
  const completedVisible =
    position.current.length === 0 && position.history.length > 0;
  const shownTrickNumber =
    position.won[0] + position.won[1] + (completedVisible ? 0 : 1);

  function addBoards(boards: Board[]) {
    setStore((old) => ({
      ...old,
      boards: [...old.boards, ...boards],
      selected: old.boards.length,
    }));
    setPaste(false);
  }
  function deleteBoard(index: number) {
    setAuto(false);
    setStore((old) => {
      const removed = old.boards[index],
        boards = old.boards.filter((_, i) => i !== index),
        sessions = { ...old.sessions };
      delete sessions[removed.id];
      if (!boards.length) {
        const blank = boardFromHands(["?", "?", "?", "?"]);
        Object.assign(blank, boardMetadata(1));
        blank.name = "新牌局 1";
        return { ...old, boards: [blank], selected: 0, sessions };
      }
      const selected =
        old.selected > index
          ? old.selected - 1
          : Math.min(old.selected, boards.length - 1);
      return { ...old, boards, selected, sessions };
    });
  }
  async function fileInput(file: File) {
    setError("");
    if (file.type.startsWith("image/")) {
      setBusy("正在本地识别图片");
      setProgress(0);
      try {
        const result = await recognize(file, setProgress);
        setImageResult(result);
        if (imageURL) URL.revokeObjectURL(imageURL);
        setImageURL(URL.createObjectURL(file));
        setEditing(result.board);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy("");
      }
    } else {
      try {
        const bytes = await file.arrayBuffer();
        let text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (file.name.endsWith(".json")) {
          const x = JSON.parse(text);
          if (x.version === 1 && x.sessions) {
            importBoards(text, file.name);
            setStore({
              ...x,
              selected: Math.min(x.selected ?? 0, x.boards.length - 1),
            });
            return;
          }
        }
        addBoards(importBoards(text, file.name));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])][0];
      if (f) {
        e.preventDefault();
        void fileInput(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [imageURL]);
  function acceptEdit(b: Board) {
    setAuto(false);
    const e = validate(b.position, false);
    if (e.length) {
      setError(e.join("；"));
      return;
    }
    setStore((old) => {
      const i = old.boards.findIndex((x) => x.id === b.id),
        sessions = { ...old.sessions };
      delete sessions[b.id];
      return i < 0
        ? {
            ...old,
            boards: [...old.boards, b],
            selected: old.boards.length,
            sessions,
          }
        : {
            ...old,
            boards: old.boards.map((x) => (x.id === b.id ? b : x)),
            sessions,
          };
    });
    setEditing(null);
    setImageResult(null);
    setError("");
  }
  function generate() {
    void task<typeof lineResult>(
      "追踪完整最优牌路",
      "line",
      [position],
      (r) => {
        setLineResult(r);
        setLineOpen(true);
        setTimeout(
          () =>
            lineAnchor.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          100,
        );
      },
    );
  }
  function applyLine() {
    setAuto(false);
    if (!lineResult) return;
    let p = structuredClone(position);
    const positions = [p];
    for (const st of lineResult.line.steps) {
      p = play(p, st.card);
      positions.push(p);
    }
    updateSession((s) => {
      const id = crypto.randomUUID();
      s.branches.push({
        id,
        name: `最优样例 · 从第 ${totalPlayed + 1} 张`,
        positions,
        cursor: 0,
      });
      s.active = id;
      return s;
    });
  }
  function changeLead(card: string) {
    setAuto(false);
    if (!card) return;
    const p = structuredClone(board.position);
    if (p.current.length || p.history.length) {
      setError("修改首攻需要完整初始牌局；残局可直接尝试当前合法牌");
      return;
    }
    try {
      const q = play(p, card as Card);
      updateSession((s) => {
        const id = crypto.randomUUID();
        s.branches.push({
          id,
          name: `首攻 ${fmt(card as Card)}`,
          positions: [p, q],
          cursor: 1,
        });
        s.active = id;
        return s;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const suitCards = (s: Seat, t: string) =>
    (position.hands[s] ?? [])
      .filter((c) => suit(c) === t)
      .sort((a, b) => rank(b) - rank(a));
  function hand(s: Seat) {
    const active = s === currentSeat && remainingTricks(position) > 0;
    return (
      <div className={`hand hand-${s} ${active ? "active" : ""}`} key={s}>
        <div className="hand-heading">
          <span>
            <b>{s}</b> {LABEL[s]}家{" "}
            {s === position.contract.declarer ? (
              <em>庄家</em>
            ) : s === next(position.contract.declarer, 2) ? (
              <em>明手</em>
            ) : null}
          </span>
          <small>{position.hands[s]?.length ?? "?"} 张</small>
        </div>
        {position.hands[s] === null ? (
          <div className="unknown-hand">
            未知手牌 <span>保留信息边界</span>
          </div>
        ) : (
          SUITS.map((t) => (
            <div
              className={`suit-row ${t === "H" || t === "D" ? "red" : ""}`}
              key={t}
            >
              <span className="suit-symbol">{SYMBOL[t]}</span>
              <div>
                {suitCards(s, t).map((c) => {
                  const m = evaluation?.moves.find((x) => x.card === c),
                    enabled = active && available.includes(c) && !busy;
                  return (
                    <button
                      key={c}
                      className={`card-rank ${m?.optimal ? "best" : ""}`}
                      disabled={!enabled}
                      onClick={() => playCard(c)}
                      title={
                        m
                          ? `${fmt(c)}：庄家 ${m.tricks} 墩${m.optimal ? " · 最优" : ` · 损失 ${m.loss} 墩`}`
                          : fmt(c)
                      }
                    >
                      {c[1] === "T" ? "10" : c[1]}
                      {m && <i>{m.tricks}</i>}
                    </button>
                  );
                })}
                {!suitCards(s, t).length && <span className="void">—</span>}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
  const displaySeats = [
    SEATS[rot % 4],
    SEATS[(rot + 1) % 4],
    SEATS[(rot + 2) % 4],
    SEATS[(rot + 3) % 4],
  ];
  const tricks = evaluation?.tricks,
    target = position.contract.level + 6,
    vulnerable =
      board.vulnerability === "All" ||
      board.vulnerability ===
        (side(position.contract.declarer) === 0 ? "NS" : "EW");
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void fileInput(f);
      }}
    >
      <header>
        <a className="brand" href="#">
          <span className="brand-mark">迹</span>
          <span>
            墩迹 <b>TrickTrace</b>
            <small>循牌而行，见墩之迹。</small>
          </span>
        </a>
        <nav>
          <span className="nav-active">分析工作台</span>
          <button onClick={() => setHelp(true)}>
            使用指南 <ArrowUpRight size={15} />
          </button>
        </nav>
        <span className="local-badge">
          <span /> 本地计算 · 图片不上传
        </span>
      </header>
      <main>
        <aside className="sidebar">
          <div className="eyebrow">
            YOUR BOARDS{" "}
            <span>{String(store.boards.length).padStart(2, "0")}</span>
          </div>
          <button
            className="upload-zone"
            onClick={() => uploadRef.current?.click()}
            disabled={!!busy}
          >
            <ScanLine size={29} />
            <strong>导入你的牌局</strong>
            <span>截图、PBN、DLM 或 LIN</span>
            <small>拖放到此处，或直接粘贴截图</small>
          </button>
          <input
            hidden
            ref={uploadRef}
            type="file"
            accept="image/*,.pbn,.dlm,.lin,.json"
            onChange={(e) => {
              if (e.target.files?.[0]) void fileInput(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <div className="input-actions">
            <button
              onClick={() => {
                setImageResult(null);
                setImageURL("");
                const b = boardFromHands(["?", "?", "?", "?"]);
                Object.assign(b, boardMetadata(nextBoardNumber(store.boards)));
                b.name = `牌局 ${b.number}`;
                setEditing(b);
              }}
            >
              <Plus size={16} /> 手动输入
            </button>
            <button onClick={() => setPaste(true)}>
              <Copy size={15} /> 粘贴牌谱
            </button>
          </div>
          <button
            className={`sidebar-feature ${singleDummyEnabled ? "enabled" : ""}`}
            role="switch"
            aria-checked={singleDummyEnabled}
            onClick={() => {
              if(singleDummyEnabled) closeSingleDummy();
              else {setSingleDummyEnabled(true);setTab("lead");}
            }}
          >
            <span className="feature-icon">
              <Focus size={18} />
            </span>
            <span>
              <strong>单明手最佳首攻</strong>
              <small>
                {singleDummyEnabled
                  ? "已开启 · 点击关闭"
                  : "可选分析 · 默认关闭"}
              </small>
            </span>
            <i aria-hidden="true" />
          </button>
          <div className="board-list">
            {store.boards.map((b, i) => (
              <div className="board-item-row" key={b.id}>
                <button
                  className={`board-item ${store.selected === i ? "selected" : ""}`}
                  onClick={() => setStore((old) => ({ ...old, selected: i }))}
                >
                  <span className="board-number">
                    {String(b.number ?? i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      {contractText(b.position)} ·{" "}
                      {b.vulnerability === "None"
                        ? "双方无局"
                        : b.vulnerability + " 有局"}
                    </small>
                  </span>
                  {store.selected === i && <ArrowRight size={16} />}
                </button>
                <button
                  className="delete-board"
                  aria-label={`删除 ${b.name}`}
                  title={`删除 ${b.name}`}
                  onClick={() => deleteBoard(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button
              onClick={() => {
                try {
                  download("TrickTrace.pbn", exportPbn(store.boards));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={16} /> 导出 PBN
            </button>
            <button
              onClick={() =>
                download(
                  "TrickTrace.json",
                  JSON.stringify(store, null, 2),
                  "application/json",
                )
              }
            >
              <Layers size={16} /> 保存完整项目
            </button>
            <div className="footnote">
              DDS 3 · 四家已知时精确求解
              <br />
              两家牌模式使用概率估计
            </div>
          </div>
        </aside>
        <section className="workspace">
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">THE ANALYSIS ROOM</div>
              <h1>{board.name}</h1>
            </div>
            <button
              className="light-button"
              onClick={() => {
                setImageResult(null);
                setImageURL("");
                setEditing(structuredClone(board));
              }}
            >
              <Settings2 size={16} /> 编辑牌局
            </button>
          </div>
          <div className="contract-bar">
            <span className="board-badge">
              第 {board.number ?? store.selected + 1} 副
            </span>
            <button
              className="contract-chip"
              aria-label="修改定约"
              onClick={() => {
                setImageResult(null);
                setImageURL("");
                setEditing(structuredClone(board));
              }}
            >
              {contractText(position)}
            </button>
            <span>
              发牌 <b>{board.dealer}</b>
            </span>
            <span>
              局况{" "}
              <b>
                {board.vulnerability === "None"
                  ? "无局"
                  : board.vulnerability === "All"
                    ? "双方"
                    : board.vulnerability}
              </b>
            </span>
            <span className="bar-spacer" />
            <button
              onClick={() => setRot((x) => (x + 1) % 4)}
              title="旋转显示，不改变座位"
            >
              <RotateCcw size={15} /> 旋转牌桌
            </button>
          </div>
          {(error || errors.length > 0) && (
            <div className="notice error" role="alert">
              {error || errors.join("；")}
              <button onClick={() => setError("")} aria-label="关闭">
                <X size={15} />
              </button>
            </div>
          )}
          {board.warnings.length > 0 && (
            <div className="notice">{board.warnings.join("；")}</div>
          )}
          <div className="analysis-grid">
            <div className="table-section">
              <div className="bridge-table">
                <div className="felt-label">TRICKTRACE / DOUBLE DUMMY</div>
                <div className="north">{hand(displaySeats[0])}</div>
                <div className="east">{hand(displaySeats[1])}</div>
                <div className="south">{hand(displaySeats[2])}</div>
                <div className="west">{hand(displaySeats[3])}</div>
                <div className="trick-center">
                  <div className="trick-caption">
                    第 {Math.min(13, shownTrickNumber)} 墩
                  </div>
                  <div
                    className={`played-cards ${completedVisible ? "completed-trick" : ""}`}
                  >
                    {shownCards.length ? (
                      shownCards.map((c) => (
                        <div
                          className={`played-card played-position-${displaySeats.indexOf(c.seat)} ${suit(c.card) === "H" || suit(c.card) === "D" ? "red" : ""}`}
                          key={c.seat}
                        >
                          <small>{c.seat}</small>
                          {fmt(c.card)}
                        </div>
                      ))
                    ) : (
                      <div className="lead-placeholder">
                        <span>{currentSeat}</span>
                        {remainingTricks(position)
                          ? `${LABEL[currentSeat]}家引牌`
                          : "牌局结束"}
                      </div>
                    )}
                  </div>
                  <div className="trick-winner">
                    {completedVisible
                      ? `${LABEL[position.history.at(-1)!.winner]}家赢墩`
                      : ""}
                  </div>
                  <div className="trick-score">
                    <span>
                      NS <b>{position.won[0]}</b>
                    </span>
                    <i>:</i>
                    <span>
                      EW <b>{position.won[1]}</b>
                    </span>
                  </div>
                </div>
              </div>
              <div className="playback">
                <div>
                  <button
                    title="返回分支起点"
                    onClick={() => moveCursor(-100)}
                    disabled={!branch?.cursor}
                  >
                    <ChevronsLeft size={20} />
                  </button>
                  <button
                    title="上一步"
                    onClick={() => moveCursor(-1)}
                    disabled={!branch?.cursor}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    className="play-button"
                    aria-label={auto ? "暂停" : "开始"}
                    onClick={startPlayback}
                    disabled={
                      !auto &&
                      (!!busy || !full || remainingTricks(position) === 0)
                    }
                  >
                    {auto ? <Pause size={17} /> : <Play size={17} />}
                  </button>
                  <button
                    title="下一步"
                    onClick={() => {
                      setAuto(false);
                      advance();
                    }}
                    disabled={
                      !!busy || !full || remainingTricks(position) === 0
                    }
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <span>{totalPlayed} / 52 张</span>
                <button
                  className={`auto-toggle ${autoMode ? "enabled" : ""}`}
                  aria-pressed={autoMode}
                  onClick={() => {
                    setAutoMode((x) => !x);
                    setAuto(false);
                  }}
                  title="墩内快速出牌，每墩结束停留1秒"
                >
                  自动
                </button>
                <button onClick={() => moveCursor(-100)}>
                  <RotateCcw size={14} /> 重置
                </button>
              </div>
              <div className="branch-row">
                <GitBranch size={16} />
                <select
                  aria-label="分析分支"
                  value={session?.active ?? ""}
                  onChange={(e) => {
                    setAuto(false);
                    updateSession((s) => ({ ...s, active: e.target.value }));
                  }}
                >
                  {session ? (
                    session.branches.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))
                  ) : (
                    <option value="">原始牌路</option>
                  )}
                </select>
                <label>
                  首攻{" "}
                  <select
                    aria-label="修改首攻"
                    value={leadChoice}
                    onChange={(e) => changeLead(e.target.value)}
                    disabled={
                      !!busy || !full || board.position.current.length > 0
                    }
                  >
                    <option value="">自由选择</option>
                    {(board.position.hands[board.position.leader] ?? []).map(
                      (c) => (
                        <option key={c} value={c}>
                          {fmt(c)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <button
                className="line-button"
                onClick={() =>
                  lineResult ? setLineOpen((x) => !x) : generate()
                }
                disabled={!full || !!busy || errors.length > 0}
              >
                <span className="line-icon">
                  <GitBranch size={20} />
                </span>
                <span>
                  <strong>查看完整最优牌路</strong>
                  <small>沿着每一墩，理解每一次选择</small>
                </span>
                <ArrowUpRight size={22} />
              </button>
              {!full && (
                <div className="observed">
                  <label>
                    录入未知方实际出牌（如 SA、HT）
                    <input
                      value={observed}
                      onChange={(e) =>
                        setObserved(e.target.value.toUpperCase())
                      }
                      maxLength={3}
                    />
                  </label>
                  <button
                    onClick={() => {
                      playCard(observed.replace("10", "T") as Card, true);
                      setObserved("");
                    }}
                  >
                    记录出牌
                  </button>
                </div>
              )}
            </div>
            <aside className="results">
              <div className="result-tabs">
                <button
                  className={tab === "moves" ? "active" : ""}
                  onClick={() => setTab("moves")}
                >
                  逐张分析
                </button>
                <button
                  className={tab === "table" ? "active" : ""}
                  onClick={() => setTab("table")}
                >
                  定约表
                </button>
                <button
                  className={tab === "experiment" ? "active" : ""}
                  onClick={() => setTab("experiment")}
                >
                  两家牌
                </button>
                {singleDummyEnabled && (
                  <button
                    className={tab === "lead" ? "active" : ""}
                    onClick={() => setTab("lead")}
                  >
                    首攻
                  </button>
                )}
              </div>
              {busy && (
                <div className="computing" role="status">
                  <LoaderCircle size={17} className="spin" />
                  <span>
                    {busy}
                    {progress > 0 ? ` · ${progress}` : ""}
                  </span>
                  <button
                    onClick={() => {
                      gen.current++;
                      cancelAll();
                      setBusy("");
                    }}
                    title="取消计算"
                  >
                    <Square size={13} />
                  </button>
                </div>
              )}
              {tab === "moves" && (
                <>
                  <div className="result-hero">
                    <div className="eyebrow">DECLARER TRICKS</div>
                    <div className="trick-total">
                      {tricks ?? "—"}
                      <span>/ 13</span>
                    </div>
                    <p>
                      {tricks === undefined
                        ? "选择定约后查看四明手结果"
                        : `最佳攻防下${tricks >= target ? "可完成定约" : "无法完成定约"}${tricks === target ? "" : ` · ${tricks >= target ? "+" : ""}${tricks - target}`}`}
                    </p>
                    {tricks !== undefined && (
                      <small>
                        定约得分{" "}
                        {score(
                          position.contract.level,
                          position.contract.strain,
                          position.contract.doubled,
                          vulnerable,
                          tricks,
                        ) > 0
                          ? "+"
                          : ""}
                        {score(
                          position.contract.level,
                          position.contract.strain,
                          position.contract.doubled,
                          vulnerable,
                          tricks,
                        )}
                      </small>
                    )}
                  </div>
                  <div className="moves-heading">
                    <strong>
                      {LABEL[currentSeat]}家可选出牌 ·{" "}
                      {PLAY_KNOWLEDGE[classifyPlay(position)].label}
                    </strong>
                    <span>庄家最终墩数</span>
                  </div>
                  <div className="move-list">
                    {evaluation?.moves.map((m) => (
                      <button
                        disabled={!!busy}
                        key={m.card}
                        onClick={() => playCard(m.card)}
                        className={m.optimal ? "optimal" : ""}
                      >
                        <span
                          className={
                            ["H", "D"].includes(suit(m.card)) ? "red" : ""
                          }
                        >
                          {fmt(m.card)}
                        </span>
                        <small>
                          {PLAY_KNOWLEDGE[classifyPlay(position, m.card)].label}{" "}
                          · {m.optimal ? "最优选择" : `损失 ${m.loss} 墩`}
                        </small>
                        <b>{m.tricks}</b>
                        {m.optimal ? <Check size={14} /> : <span />}
                      </button>
                    ))}
                    {!evaluation && !busy && (
                      <div className="empty-small">
                        {full ? "等待求解" : "只知道两家牌时，请使用实验分析。"}
                      </div>
                    )}
                  </div>
                  <p className="result-note">
                    绿色标记表示当前行动方的最优牌。多张牌可以同样最优；每出一张，重新评估。
                  </p>
                  <details className="play-knowledge">
                    <summary>基本出牌库</summary>
                    {Object.values(PLAY_KNOWLEDGE).map((item) => (
                      <p key={item.label}>
                        <strong>{item.label}</strong>
                        <span>{item.short}</span>
                        <small>{item.principle}</small>
                      </p>
                    ))}
                    <footer>
                      规则只解释出牌角色；具体选择仍须通过 DDS，不覆盖会损失墩数的结果。
                    </footer>
                  </details>
                  {board.record.length > 0 && (
                    <button
                      className="light-button"
                      onClick={() =>
                        void task(
                          "复核原始出牌记录",
                          "analyse",
                          [board.position, board.record],
                          setReview,
                        )
                      }
                    >
                      复核导入记录 · {board.record.length} 张
                    </button>
                  )}
                </>
              )}
              {tab === "table" && (
                <div className="table-results">
                  <h3>可得墩数</h3>
                  <p>四方坐庄 × 五种定约</p>
                  {table ? (
                    <>
                      <table>
                        <thead>
                          <tr>
                            <th />{" "}
                            {STRAINS.map((s) => (
                              <th key={s}>{s === "NT" ? "NT" : SYMBOL[s]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {SEATS.map((s, i) => (
                            <tr key={s}>
                              <th>{s}</th>
                              {STRAINS.map((t, j) => (
                                <td key={t}>
                                  <button
                                    title={`设置 ${s} 家 ${t} 定约`}
                                    onClick={() => {
                                      const b = structuredClone(board);
                                      b.position.contract.strain = t;
                                      b.position.contract.declarer = s;
                                      if (table.table[j][i] >= 7)
                                        b.position.contract.level =
                                          table.table[j][i] - 6;
                                      b.position.contract.doubled = 0;
                                      b.position.leader = next(s);
                                      acceptEdit(b);
                                    }}
                                  >
                                    {table.table[j][i]}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="par">
                        <small>PAR · 均衡定约</small>
                        <strong>
                          {table.par.score > 0 ? "+" : ""}
                          {table.par.score} <span>NS</span>
                        </strong>
                        <p>{table.par.contracts.join(" / ")}</p>
                      </div>
                    </>
                  ) : (
                    <p role="status">
                      {tableError ||
                        (!canCalculateTable(board)
                          ? "完整初始牌局录入后自动计算定约表"
                          : "正在后台计算定约表…")}
                    </p>
                  )}
                  <button
                    className="light-button"
                    disabled={!!busy}
                    onClick={async () => {
                      const all = [];
                      for (const b of store.boards) {
                        try {
                          const r = await getTable(b);
                          all.push({ board: b.name, ...r });
                        } catch (e) {
                          all.push({
                            board: b.name,
                            error: (e as Error).message,
                          });
                        }
                      }
                      download(
                        "TrickTrace-analysis.json",
                        JSON.stringify(all, null, 2),
                      );
                    }}
                  >
                    批量分析并导出
                  </button>
                </div>
              )}
              {tab === "experiment" && (
                <div className="experiment">
                  <span className="experiment-label">EXPERIMENTAL</span>
                  <h3>看得见的牌，合理的推测</h3>
                  <p>
                    按未知分布采样，给出当前选择的估计。它不是全知条件下的必胜路线。
                  </p>
                  <div className="sample-fields">
                    <label>
                      样本数
                      <input
                        type="number"
                        min="16"
                        max="2000"
                        value={sampleCount}
                        onChange={(e) => setSampleCount(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      随机种子
                      <input
                        type="number"
                        value={sampleSeed}
                        onChange={(e) => setSampleSeed(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <label>
                    分析目标
                    <select
                      value={objective}
                      onChange={(e) =>
                        setObjective(e.target.value as typeof objective)
                      }
                    >
                      <option value="contract">做成／击败定约优先</option>
                      <option value="tricks">期望墩数优先</option>
                    </select>
                  </label>
                  <details>
                    <summary>叫牌与牌型约束</summary>
                    <p>
                      原始手牌大牌点和花色长度。例如：
                      <code>
                        {'[{"seat":"E","minHcp":12,"lengths":{"S":[5,7]}}]'}
                      </code>
                    </p>
                    <textarea
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                    />
                  </details>
                  <button
                    className="primary"
                    disabled={full || !!busy}
                    onClick={() => {
                      try {
                        const cs = JSON.parse(constraints) as Constraint[];
                        if (!Array.isArray(cs)) throw Error("约束必须为数组");
                        void task(
                          "采样并比较候选牌",
                          "sample",
                          [position, sampleCount, sampleSeed, cs, objective],
                          setSample,
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    分析当前最佳选择
                  </button>
                  {full && (
                    <p className="hint">
                      在「编辑牌局」中将两家手牌设为 ? 即可使用。
                    </p>
                  )}
                  {sample && (
                    <>
                      <p>
                        {sample.samples} 个有效分布 · 种子 {sample.seed}
                        <br />
                        下表为当前行动方完成目标的估计概率
                      </p>
                      {sample.moves.map((m) => (
                        <button
                          className="sample-move"
                          key={m.card}
                          onClick={() => playCard(m.card)}
                        >
                          <b>{fmt(m.card)}</b>
                          <span>
                            {(m.success * 100).toFixed(1)}%
                            <small>
                              区间 {(m.interval[0] * 100).toFixed(0)}–
                              {(m.interval[1] * 100).toFixed(0)}%
                            </small>
                          </span>
                          <span>
                            {m.expected.toFixed(2)}
                            <small>庄家期望墩数</small>
                          </span>
                        </button>
                      ))}
                      <p className="hint">
                        区间仅反映采样误差。DDS
                        假设后续全知，可能高估实际路线；应随真实出牌更新。
                      </p>
                    </>
                  )}
                </div>
              )}
              {tab === "lead" && singleDummyEnabled && (
                <div className="experiment lead-analysis">
                  <span className="experiment-label">SINGLE DUMMY</span>
                  <button className="light-button" onClick={closeSingleDummy}>关闭首攻分析 · 返回原牌局</button>
                  <h3>只看首攻手，比较每一张牌</h3>
                  <p>
                    固定{LABEL[position.leader]}家 13 张手牌，对其余 39
                    张按约束重复发牌，每个分布均由 DDS 评估。
                  </p>
                  <div className="simulation-count">
                    <div>
                      <strong>模拟次数</strong>
                      <small>次数越多越稳定，耗时也更长</small>
                    </div>
                    <div className="count-options">
                      {[250, 1000, 2500, 5000].map((count) => (
                        <button
                          key={count}
                          disabled={!!busy}
                          aria-pressed={leadCount === count}
                          onClick={() => {setLeadCount(count);setLeadSample(null);}}
                        >
                          {count}
                        </button>
                      ))}
                      <label>
                        <span>自定义</span>
                        <input
                          aria-label="自定义模拟次数"
                          disabled={!!busy}
                          type="number"
                          min="16"
                          max="5000"
                          value={leadCount}
                          onChange={(e) =>
                            {setLeadCount(Number(e.target.value));setLeadSample(null);}
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <fieldset disabled={!!busy} className="lead-config"><LeadConstraints key={board.singleDummySourceId??board.id} leader={position.leader} declarer={position.contract.declarer} dealer={board.dealer} auction={board.auction} value={leadConstraints} onValidityChange={setLeadInputValid} onChange={cs=>{setLeadConstraints(cs);setLeadSample(null);}} /></fieldset>
                  <label>求解模式
                    <select aria-label="首攻求解模式" disabled={!!busy} value={leadMode} onChange={e=>{setLeadMode(e.target.value as 'beat'|'exact');setLeadSample(null);}}>
                      <option value="beat">快速 · 仅击败率</option>
                      <option value="exact">精确 · 击败率与平均墩数</option>
                    </select>
                  </label>
                  <p className="hint">{leadMode==='beat'?'只判断各首攻能否击败定约，不计算平均墩数。':'计算各首攻的精确墩数，耗时较长。'} 按设备能力并行计算。</p>
                  <div className="lead-readiness">
                    <span>首攻方</span>
                    <b>{LABEL[position.leader]}家</b>
                    <span>已知手牌</span>
                    <b>
                      {SEATS.filter((seat) => position.hands[seat] !== null).length}{" "}
                      家
                    </b>
                  </div>
                  {SEATS.filter((seat) => position.hands[seat] !== null).length !==
                    1 || position.hands[position.leader]?.length !== 13 ? (
                    <div className="lead-setup">
                      <p>
                        分析需要只保留首攻方手牌，其余三家设为 ?。
                      </p>
                      {full && (
                        <button
                          className="light-button"
                          onClick={prepareSingleDummyCopy}
                        >
                          <Copy size={14} /> 创建单明手副本
                        </button>
                      )}
                      <button
                        className="light-button"
                        onClick={() => setEditing(structuredClone(board))}
                      >
                        <Settings2 size={14} /> 编辑当前牌局
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="sample-fields">
                        <label>
                          随机种子
                          <input
                            type="number"
                            value={sampleSeed}
                            onChange={(e) =>
                              setSampleSeed(Number(e.target.value))
                            }
                          />
                        </label>
                      </div>
                      <label>
                        排序目标
                        <select
                          disabled={!!busy||leadMode==='beat'}
                          value={leadMode==='beat'?'contract':objective}
                          onChange={(e) =>
                            {setObjective(e.target.value as typeof objective);setLeadSample(null);}
                          }
                        >
                          <option value="contract">击败定约概率优先</option>
                          <option value="tricks">庄家平均墩数最少</option>
                        </select>
                      </label>
                      <button
                        className="primary"
                        disabled={!!busy||!leadInputValid}
                        onClick={() => {
                          try {
                            const cs = leadConstraints;
                            validateConstraints(cs);
                            void task(
                              "正在比较所有首攻",
                              "openingLead",
                              [
                                position,
                                leadCount,
                                sampleSeed,
                                cs,
                                objective,
                                leadMode,
                              ],
                              setLeadSample,
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        开始首攻分析
                      </button>
                    </>
                  )}
                  {leadSample && (
                    <div className="lead-ranking">
                      <div className="lead-ranking-head">
                        <span>{leadSample.samples} 个有效分布 / 目标 {leadCount} · 尝试 {leadSample.attempts} 次{leadSample.samples<leadCount?' · 未达到目标，约束接受率较低':''}</span>
                        <small>种子 {leadSample.seed} · {leadSample.workers} 个线程 · 采样 {(leadSample.samplingMs/1000).toFixed(1)} 秒 / 求解 {(leadSample.solveMs/1000).toFixed(1)} 秒</small>
                      </div>
                      {leadSample.moves.map((move, index) => (
                        <div
                          className={
                            index === 0
                              ? "sample-move best-lead"
                              : "sample-move"
                          }
                          key={move.card}
                        >
                          <b
                            className={
                              ["H", "D"].includes(suit(move.card)) ? "red" : ""
                            }
                          >
                            {fmt(move.card)}
                          </b>
                          <span>
                            {(move.success * 100).toFixed(1)}%
                            <small>
                              击败定约 · 95% 区间{" "}
                              {(move.interval[0] * 100).toFixed(0)}–
                              {(move.interval[1] * 100).toFixed(0)}%
                            </small>
                          </span>
                          <span>
                            {move.expected===null?'—':move.expected.toFixed(2)}
                            <small>{move.expected===null?'快速模式不计算墩数':'庄家平均墩数'}</small>
                          </span>
                          {index === 0 && <em>首选</em>}
                        </div>
                      ))}
                      <p className="hint">
                        区间只表示有限采样的不确定性；DDS
                        在首攻后按四明手最优打法求解。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
          {review && (
            <section className="line-panel">
              <h2>原始记录复核</h2>
              <div className="record-list">
                {review.map((m, i) => (
                  <span key={i} className={m.loss ? "mistake" : ""}>
                    {i + 1}. {m.seat} {fmt(m.card)} → {m.tricks} 墩
                    {m.loss ? `（损失 ${m.loss}）` : ""}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  let p = structuredClone(board.position);
                  const positions = [p];
                  for (const card of board.record) {
                    p = play(p, card);
                    positions.push(p);
                  }
                  updateSession((s) => {
                    const id = crypto.randomUUID();
                    s.branches.push({
                      id,
                      name: "导入记录",
                      positions,
                      cursor: 0,
                    });
                    s.active = id;
                    return s;
                  });
                }}
              >
                在牌桌上回放此记录
              </button>
            </section>
          )}
          {lineOpen && lineResult && (
            <section className="line-panel" ref={lineAnchor}>
              <div className="line-panel-heading">
                <div className="eyebrow">FOLLOW THE TRACE</div>
                <button
                  onClick={() => setLineOpen(false)}
                  aria-label="收起牌路"
                >
                  <X size={18} />
                </button>
              </div>
              <h2>每一墩，都有迹可循。</h2>
              <p>
                从当前局面出发，双方最佳应对下的一条完整样例。并列最优路线可能不同。
              </p>
              <div className="line-meta">
                <span>
                  庄家可得 <b>{lineResult.line.initialTricks}</b> 墩
                </span>
                <span>
                  剩余 <b>{lineResult.line.steps.length}</b> 张
                </span>
                <button className="primary" onClick={applyLine}>
                  <Play size={15} /> 放到牌桌逐张回放
                </button>
                <button
                  onClick={() =>
                    download(
                      "TrickTrace-line.json",
                      JSON.stringify(
                        { start: position, ...lineResult },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  <Download size={16} />
                </button>
              </div>
              <div className="line-tricks">
                {lineResult.line.final.history
                  .slice(position.history.length)
                  .map((t, i) => (
                    <div className="line-trick" key={i}>
                      <span className="trick-no">
                        {String(position.history.length + i + 1).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <div className="line-cards">
                        {t.cards.map((c, cardIndex) => (
                          <span key={c.seat}>
                            <small>
                              {c.seat} ·{" "}
                              {cardIndex
                                ? "跟牌"
                                : i === 0 && position.history.length === 0
                                  ? "首攻"
                                  : "攻牌"}
                            </small>
                            <b
                              className={
                                ["H", "D"].includes(suit(c.card)) ? "red" : ""
                              }
                            >
                              {fmt(c.card)}
                            </b>
                          </span>
                        ))}
                      </div>
                      <span className="winner">{LABEL[t.winner]}家赢墩</span>
                    </div>
                  ))}
              </div>
              <div className="tactics">
                <h3>打法与关键节点</h3>
                {lineResult.tactics.items.length ? (
                  lineResult.tactics.items.map((t, i) => (
                    <article key={i}>
                      <div>
                        <span className="tactic-index">第 {t.trick} 墩</span>
                        <strong>{t.title}</strong>
                        <small
                          className={t.status === "verified" ? "verified" : ""}
                        >
                          {t.status === "verified"
                            ? "已验证"
                            : t.status === "conditional"
                              ? "条件结构"
                              : "待验证"}
                        </small>
                      </div>
                      <p>{t.explanation}</p>
                      <details>
                        <summary>查看验证依据</summary>
                        {t.evidence.map((e, j) => (
                          <p key={j}>{e}</p>
                        ))}
                      </details>
                    </article>
                  ))
                ) : (
                  <p>
                    这条样例未识别到有充分证据的特殊战术。每张最优选择已由 DDS
                    求解；不强行给普通出牌贴上战术名称。
                  </p>
                )}
                {!lineResult.tactics.complete && (
                  <p>战术搜索达到时间预算，尚有分支未验证。</p>
                )}
              </div>
            </section>
          )}
          <footer>
            <span>墩迹 TrickTrace</span>
            <span>循牌而行，见墩之迹。</span>
            <a
              href="https://github.com/dds-bridge/dds"
              target="_blank"
              rel="noreferrer"
            >
              Powered by DDS ↗
            </a>
          </footer>
        </section>
      </main>
      {editing && (
        <Editor
          board={editing}
          imageURL={imageResult ? imageURL : ""}
          recognition={imageResult}
          onClose={() => {
            setEditing(null);
            setImageResult(null);
          }}
          onSave={acceptEdit}
        />
      )}
      {paste && (
        <div className="modal-backdrop">
          <section className="modal compact">
            <button
              className="close"
              onClick={() => setPaste(false)}
              aria-label="关闭"
            >
              <X />
            </button>
            <h2>粘贴牌谱</h2>
            <p>PBN、DLM、BBO LIN 或项目 JSON</p>
            <textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'[Deal "N:AKQ.JT9.876.5432 ..."]'}
            />
            <button
              className="primary"
              onClick={() => {
                try {
                  addBoards(importBoards(pasteText));
                } catch (e) {
                  setError((e as Error).message);
                  setPaste(false);
                }
              }}
            >
              导入牌局
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section className="modal compact">
            <button
              className="close"
              onClick={() => setHelp(false)}
              aria-label="关闭"
            >
              <X />
            </button>
            <div className="eyebrow">QUICK GUIDE</div>
            <h2>从一张截图，到一条牌路。</h2>
            <ol>
              <li>
                上传截图或导入文件。识牌后对照原图，确认四家方位、手牌和定约。
              </li>
              <li>
                手输按 ♠ ♥ ♦ ♣ 顺序，用点分隔。例：AK73.Q94.KQ98.A3；缺门填
                -，未知整手填 ?。
              </li>
              <li>
                点击牌桌中的合法牌查看变化；绿色数字表示当前一方的最优选择，数字均为庄家最终墩数。
              </li>
              <li>
                点击牌桌下方按钮，展开完整样例；放到牌桌后可逐张回放、回退并探索分支。
              </li>
              <li>
                只知道两家牌时使用实验分析。录入实际出牌以更新未知分布；残局须提供完整已出牌信息。
              </li>
              <li>
                保存项目 JSON 可保留分支和进度；导出 PBN 适合交换完整初始牌局。
              </li>
            </ol>
            <p>
              数据保存在当前浏览器。清理浏览器数据前请导出项目。战术名称仅在证据支持时显示，复杂组合可能标记为条件结构。当前识牌为测试版：扇形与叠放手牌仍可能漏牌或误认，方位、定约及当前墩必须核对；复杂挤牌尚未完成完整分类验收。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function Editor({
  board,
  imageURL,
  recognition,
  onClose,
  onSave,
}: {
  board: Board;
  imageURL: string;
  recognition: Recognition | null;
  onClose: () => void;
  onSave: (b: Board) => void;
}) {
  const [b, setB] = useState(() => structuredClone(board)),
    [hands, setHands] = useState(() =>
      SEATS.map((s) => handText(board.position.hands[s])),
    ),
    [err, setErr] = useState(""),
    [inputMode, setInputMode] = useState<"cards" | "text">("cards"),
    [current, setCurrent] = useState(() =>
      board.position.current.map((c) => c.card).join(" "),
    );
  const patch = (fn: (b: Board) => void) =>
    setB((old) => {
      const q = structuredClone(old);
      fn(q);
      return q;
    });
  function save() {
    try {
      const q = structuredClone(b);
      SEATS.forEach((s, i) => (q.position.hands[s] = parseHand(hands[i])));
      q.position.current = current.trim()
        ? current
            .toUpperCase()
            .replace(/10/g, "T")
            .split(/\s+/)
            .map((card, i) => ({
              seat: next(q.position.leader, i),
              card: card as Card,
            }))
        : [];
      const e = validate(q.position, false);
      if (e.length) throw Error(e.join("；"));
      q.warnings = [];
      onSave(q);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className={`modal editor ${imageURL ? "with-image" : ""}`}>
        <button className="close" onClick={onClose} aria-label="关闭">
          <X />
        </button>
        <div className="editor-content">
          <div className="eyebrow">
            {imageURL ? "RECOGNITION REVIEW" : "DEAL EDITOR"}
          </div>
          <h2>{imageURL ? "核对识别结果" : "编辑牌局"}</h2>
          <p>
            {imageURL
              ? "先确认牌张与方位，再开始分析。标为未知的信息不会自动猜填。"
              : "手牌依次为 ♠ ♥ ♦ ♣，以点分隔。缺门用 -，未知整手用 ?。"}
          </p>
          {recognition && (
            <div className="notice">{recognition.warnings.join("；")}</div>
          )}
          {err && (
            <div role="alert" className="notice error">
              {err}
            </div>
          )}
          <div className="editor-number">
            <label>
              第几副牌
              <input
                type="number"
                min="1"
                max="99"
                value={b.number ?? 1}
                onChange={(e) => {
                  try {
                    const n = Number(e.target.value);
                    const meta = boardMetadata(n);
                    patch((q) => {
                      if (/^牌局 \d+$/.test(q.name)) q.name = `牌局 ${n}`;
                      Object.assign(q, meta);
                    });
                    setErr("");
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              />
            </label>
            <span>
              按编号自动设置发牌人和局况
              <br />
              可在下方单独调整
            </span>
          </div>
          <label>
            牌局名称
            <input
              value={b.name}
              onChange={(e) => patch((q) => (q.name = e.target.value))}
            />
          </label>
          <div className="editor-input-tabs">
            <button
              aria-pressed={inputMode === "cards"}
              onClick={() => setInputMode("cards")}
            >
              点击选牌
            </button>
            <button
              aria-pressed={inputMode === "text"}
              onClick={() => setInputMode("text")}
            >
              文本输入
            </button>
          </div>
          {inputMode === "cards" && (
            <CardPicker hands={hands} onChange={setHands} />
          )}
          <div className="hand-inputs" hidden={inputMode !== "text"}>
            {SEATS.map((s, i) => (
              <label key={s}>
                <span>
                  {s} · {LABEL[s]}家
                </span>
                <input
                  value={hands[i]}
                  onChange={(e) =>
                    setHands((old) =>
                      old.map((v, j) => (i === j ? e.target.value : v)),
                    )
                  }
                  spellCheck={false}
                />
                <small>
                  {(() => {
                    try {
                      return parseHand(hands[i])?.length ?? "?";
                    } catch {
                      return "!";
                    }
                  })()}{" "}
                  张
                </small>
              </label>
            ))}
          </div>
          <div className="editor-fields">
            <label>
              定约
              <select
                value={b.position.contract.level}
                onChange={(e) =>
                  patch(
                    (q) => (q.position.contract.level = Number(e.target.value)),
                  )
                }
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              将牌
              <select
                value={b.position.contract.strain}
                onChange={(e) =>
                  patch(
                    (q) =>
                      (q.position.contract.strain = e.target
                        .value as Position["contract"]["strain"]),
                  )
                }
              >
                {STRAINS.map((s) => (
                  <option key={s} value={s}>
                    {s === "NT" ? "NT" : SYMBOL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              庄家
              <select
                value={b.position.contract.declarer}
                onChange={(e) =>
                  patch((q) => {
                    q.position.contract.declarer = e.target.value as Seat;
                    q.position.leader = next(e.target.value as Seat);
                  })
                }
              >
                {SEATS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              加倍
              <select
                value={b.position.contract.doubled}
                onChange={(e) =>
                  patch(
                    (q) =>
                      (q.position.contract.doubled = Number(e.target.value) as
                        0 | 1 | 2),
                  )
                }
              >
                <option value={0}>无</option>
                <option value={1}>X</option>
                <option value={2}>XX</option>
              </select>
            </label>
            <label>
              发牌
              <select
                value={b.dealer}
                onChange={(e) =>
                  patch((q) => (q.dealer = e.target.value as Seat))
                }
              >
                {SEATS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              局况
              <select
                value={b.vulnerability}
                onChange={(e) =>
                  patch(
                    (q) =>
                      (q.vulnerability = e.target
                        .value as Board["vulnerability"]),
                  )
                }
              >
                {["None", "NS", "EW", "All"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <details open={!!current}>
            <summary>残局／当前墩设置</summary>
            <div className="editor-fields">
              <label>
                本墩引牌方
                <select
                  value={b.position.leader}
                  onChange={(e) =>
                    patch((q) => (q.position.leader = e.target.value as Seat))
                  }
                >
                  {SEATS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                NS 已得墩
                <input
                  type="number"
                  min="0"
                  max="13"
                  value={b.position.won[0]}
                  onChange={(e) =>
                    patch((q) => (q.position.won[0] = Number(e.target.value)))
                  }
                />
              </label>
              <label>
                EW 已得墩
                <input
                  type="number"
                  min="0"
                  max="13"
                  value={b.position.won[1]}
                  onChange={(e) =>
                    patch((q) => (q.position.won[1] = Number(e.target.value)))
                  }
                />
              </label>
            </div>
            <label>
              当前墩已出牌，按顺序空格分隔
              <input
                placeholder="如 SJ S2"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <p>
              当前墩中的牌不应再次出现在剩余手牌中。两家牌残局需要完整历史才能确定未知牌池。
            </p>
          </details>
          <div className="modal-actions">
            <button onClick={onClose}>取消</button>
            <button className="primary" onClick={save}>
              <Check size={16} /> 确认并分析
            </button>
          </div>
        </div>
        {imageURL && <ImageReview url={imageURL} recognition={recognition} />}
      </section>
    </div>
  );
}
