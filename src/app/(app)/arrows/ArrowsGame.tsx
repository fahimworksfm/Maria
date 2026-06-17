"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Undo2, Lightbulb, RotateCcw } from "lucide-react";
import { genLevel, genDaily, canExit, findHintId, headOf, DELTA, type Board, type Piece } from "@/lib/arrows";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";
import Confetti from "@/components/Confetti";

export type Result = { moves: number; timeMs: number } | null;
type Mode = "levels" | "daily";

const NAVY = "#1a1f30"; // flat board background (matches the real game)
const LAV = "#aab4e6"; // flat arrow colour
const RED = "#f0566e";
const SHAFT = 0.32; // line thickness (of one cell)
const TIP = 0.46; // how far the tip reaches past the head-cell centre
const CHEV = 0.3; // chevron arm length
const LIVES = 3;
const EXIT_MS = 380;

function fmtTime(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// The whole arrow is drawn as thin rounded strokes (flat colour, no fill) to
// match the real game: a shaft that runs through the cells tail → head and on to
// a tip just past the head cell, plus an OPEN chevron (a "V") at that tip.
function arrowGeom(p: Piece): { shaft: string; chevron: string } {
  const [dx, dy] = [DELTA[p.dir][1], DELTA[p.dir][0]];
  const px = dy, py = -dx; // perpendicular
  const [hr, hc] = headOf(p);
  const tx = hc + 0.5 + dx * TIP, ty = hr + 0.5 + dy * TIP; // tip
  const body =
    p.cells.length === 1
      ? [[hc + 0.5 - dx * 0.3, hr + 0.5 - dy * 0.3] as [number, number]]
      : p.cells.map(([r, c]) => [c + 0.5, r + 0.5] as [number, number]);
  const shaft = [...body, [tx, ty] as [number, number]].map(([x, y]) => `${x},${y}`).join(" ");
  const left = `${tx - dx * CHEV + px * CHEV},${ty - dy * CHEV + py * CHEV}`;
  const right = `${tx - dx * CHEV - px * CHEV},${ty - dy * CHEV - py * CHEV}`;
  const chevron = `${left} ${tx},${ty} ${right}`;
  return { shaft, chevron };
}

export default function ArrowsGame({
  startLevel, partnerLevel, partnerName, dailyDate, dailyKey, myDaily, partnerDaily, saveLevel, recordResult,
}: {
  startLevel: number; partnerLevel: number | null; partnerName: string;
  dailyDate: string; dailyKey: string; myDaily: Result; partnerDaily: Result;
  saveLevel: (level: number) => Promise<void>;
  recordResult: (puzzleKey: string, moves: number, timeMs: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("levels");
  const [level, setLevel] = useState(startLevel);
  const [board, setBoard] = useState<Board>(() => genLevel(startLevel));
  const [removed, setRemoved] = useState<Piece[]>([]);
  const [lives, setLives] = useState(LIVES);
  const [moves, setMoves] = useState(0);
  const [exitingId, setExitingId] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dailySolved, setDailySolved] = useState<Result>(myDaily);

  const startedAt = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimer = useCallback(() => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } }, []);

  const loadBoard = useCallback((b: Board) => {
    setBoard(b); setRemoved([]); setLives(LIVES); setMoves(0);
    setExitingId(null); setFlashId(null); setHintId(null); setWon(false); setFailed(false); setBusy(false);
    setElapsed(0); startedAt.current = null; stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    loadBoard(mode === "levels" ? genLevel(level) : genDaily(dailyDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level, dailyDate]);
  useEffect(() => () => stopTimer(), [stopTimer]);

  function ensureTimer() {
    if (startedAt.current == null) {
      startedAt.current = Date.now();
      tickRef.current = setInterval(() => { if (startedAt.current != null) setElapsed(Date.now() - startedAt.current); }, 100);
    }
  }

  function tapPiece(p: Piece) {
    if (busy || won || failed) return;
    if (!canExit(board, p)) {
      tap(HAPTIC.tap);
      setFlashId(p.id);
      setTimeout(() => setFlashId(null), 360);
      setLives((lv) => {
        const next = Math.max(0, lv - 1);
        if (next === 0) {
          setFailed(true); stopTimer();
          setTimeout(() => loadBoard(mode === "levels" ? genLevel(level) : genDaily(dailyDate)), 1600);
        }
        return next;
      });
      return;
    }
    ensureTimer();
    setBusy(true); setHintId(null);
    tap(HAPTIC.tick); play("tick");
    setExitingId(p.id);
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    // No other piece can change during the exit (busy gates taps/undo), so the
    // board after this removal is known now — compute the win + its side effects
    // here rather than inside the setBoard updater (which must stay pure).
    const solved = board.pieces.filter((x) => x.id !== p.id).length === 0;
    let timeMs = 0;
    if (solved) { stopTimer(); timeMs = startedAt.current ? Date.now() - startedAt.current : 0; }
    setTimeout(() => {
      setBoard((b) => ({ ...b, pieces: b.pieces.filter((x) => x.id !== p.id) }));
      setRemoved((r) => [...r, p]);
      setExitingId(null); setBusy(false);
      if (solved) {
        setElapsed(timeMs); setWon(true);
        if (mode === "levels") {
          void saveLevel(level + 1);
          void recordResult(`L${level}`, nextMoves, timeMs);
          setTimeout(() => setLevel((l) => l + 1), 1700);
        } else {
          void recordResult(dailyKey, nextMoves, timeMs);
          setDailySolved({ moves: nextMoves, timeMs });
        }
      }
    }, EXIT_MS);
  }

  function undo() {
    if (won || failed || busy || removed.length === 0) return;
    tap(HAPTIC.tick);
    const last = removed[removed.length - 1]!;
    setRemoved((r) => r.slice(0, -1));
    setBoard((b) => ({ ...b, pieces: [...b.pieces, last] }));
    setMoves((m) => Math.max(0, m - 1));
  }
  function restart() { tap(HAPTIC.tick); loadBoard(mode === "levels" ? genLevel(level) : genDaily(dailyDate)); }
  function hint() {
    if (won || failed || busy) return;
    const id = findHintId(board);
    if (id == null) return;
    tap(HAPTIC.tick); setHintId(id);
    setTimeout(() => setHintId(null), 1300);
  }

  const size = board.size;

  return (
    <div className="space-y-5">
      {won && <Confetti trigger={`arrows-${mode}-${level}`} />}

      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl2 bg-panel2/60 border border-line">
        {(["levels", "daily"] as Mode[]).map((m) => (
          <button key={m} onClick={() => { tap(HAPTIC.tick); setMode(m); }}
            className={`py-2 rounded-lg text-sm transition ${mode === m ? "bg-accent/15 text-ink" : "text-muted hover:text-ink"}`}>
            {m === "levels" ? "Levels" : "Daily ♥"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={undo} disabled={removed.length === 0 || won || failed} className="btn btn-ghost p-2" aria-label="Undo"><Undo2 size={18} aria-hidden /></button>
          <button onClick={hint} disabled={won || failed} className="btn btn-ghost p-2" aria-label="Hint"><Lightbulb size={18} aria-hidden /></button>
          <button onClick={restart} className="btn btn-ghost p-2" aria-label="Restart"><RotateCcw size={18} aria-hidden /></button>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: LIVES }).map((_, i) => (
            <Heart key={i} size={20} aria-hidden fill={i < lives ? RED : "transparent"} color={i < lives ? RED : "#46506e"} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-center">
        <Stat label={mode === "levels" ? "Level" : "Today"} value={mode === "levels" ? String(level) : dailyDate.slice(5)} />
        <Stat label="Moves" value={String(moves)} />
        <Stat label="Time" value={fmtTime(elapsed)} />
      </div>

      <div className="relative mx-auto w-full rounded-xl2 overflow-hidden" style={{ maxWidth: 380, aspectRatio: "1 / 1", background: NAVY, boxShadow: won ? "0 0 0 1px rgba(170,180,255,.4), 0 0 36px rgba(170,180,255,.25)" : "none", transition: "box-shadow .6s ease" }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
          {board.pieces.map((p) => {
            const exiting = exitingId === p.id;
            const stroke = flashId === p.id ? RED : LAV;
            const [dx, dy] = [DELTA[p.dir][1], DELTA[p.dir][0]];
            const { shaft, chevron } = arrowGeom(p);
            const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
            return (
              <g key={p.id} onClick={() => tapPiece(p)} role="button" aria-label="arrow"
                style={{
                  cursor: "pointer",
                  transform: exiting ? `translate(${dx * (size + 2)}px, ${dy * (size + 2)}px)` : "none",
                  opacity: exiting ? 0 : 1,
                  transition: `transform ${EXIT_MS}ms cubic-bezier(.45,0,.85,.3), opacity ${EXIT_MS - 80}ms ease-in 80ms`,
                }}>
                {/* whole-cell invisible hit targets — easy to tap */}
                {p.cells.map(([r, c], i) => (
                  <rect key={i} x={c} y={r} width={1} height={1} fill="transparent" style={{ pointerEvents: "all" }} />
                ))}
                {hintId === p.id && (
                  <>
                    <polyline points={shaft} {...line} stroke="#fff" strokeOpacity={0.3} strokeWidth={SHAFT + 0.34} style={{ pointerEvents: "none" }} />
                    <polyline points={chevron} {...line} stroke="#fff" strokeOpacity={0.3} strokeWidth={SHAFT + 0.34} style={{ pointerEvents: "none" }} />
                  </>
                )}
                <polyline points={shaft} {...line} stroke={stroke} strokeWidth={SHAFT} style={{ pointerEvents: "stroke" }} />
                <polyline points={chevron} {...line} stroke={stroke} strokeWidth={SHAFT} style={{ pointerEvents: "stroke" }} />
              </g>
            );
          })}
        </svg>
        {failed && (
          <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(10,12,22,0.72)" }}>
            <p className="font-display text-lg text-ink">Out of hearts — resetting…</p>
          </div>
        )}
      </div>

      {won ? (
        <p className="text-center font-display text-lg">{mode === "levels" ? "Cleared. Next one…" : `Solved in ${moves} moves · ${fmtTime(elapsed)}`}</p>
      ) : (
        <p className="muted text-center text-sm">Tap an arrow to glide it off. Clear them all.</p>
      )}

      {mode === "levels" && partnerLevel != null && (
        <p className="muted text-center text-xs">You: level {level} · {partnerName}: level {partnerLevel}</p>
      )}

      {mode === "daily" && (
        <div className="card p-4 space-y-2">
          <h3 className="label">Today&apos;s heart · you vs {partnerName}</h3>
          <Row who="You" r={dailySolved} />
          <Row who={partnerName} r={partnerDaily} />
          {dailySolved && partnerDaily && <p className="muted text-xs pt-1">{scoreLine(dailySolved, partnerDaily, partnerName)}</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label !mb-0">{label}</span>
      <div className="font-display text-2xl leading-none tabular-nums">{value}</div>
    </div>
  );
}
function Row({ who, r }: { who: string; r: Result }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{who}</span>
      <span className="muted">{r ? `${r.moves} moves · ${fmtTime(r.timeMs)}` : "not yet"}</span>
    </div>
  );
}
function scoreLine(me: NonNullable<Result>, them: NonNullable<Result>, partnerName: string): string {
  if (me.moves !== them.moves) return me.moves < them.moves ? "Fewer moves — you take it 🤍" : `${partnerName} solved it in fewer moves.`;
  if (me.timeMs !== them.timeMs) return me.timeMs < them.timeMs ? "Same moves, you were faster." : `Same moves — ${partnerName} was faster.`;
  return "Dead heat. Of course.";
}
