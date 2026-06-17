"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Undo2, Lightbulb, RotateCcw } from "lucide-react";
import { genLevel, genDaily, canExit, findHintId, headOf, DELTA, type Board, type Piece } from "@/lib/arrows";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";
import Confetti from "@/components/Confetti";

export type Result = { moves: number; timeMs: number } | null;
type Mode = "levels" | "daily";

const NAVY = "#171c2e";
const NAVY2 = "#252e49";
const PIPE = "#aab4ff";
const RED = "#f0566e";
const LIVES = 3;

function fmtTime(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function piecePoints(p: Piece): string {
  if (p.cells.length === 1) {
    const [r, c] = p.cells[0]!;
    const [dr, dc] = DELTA[p.dir];
    return `${c + 0.5 - dc * 0.2},${r + 0.5 - dr * 0.2} ${c + 0.5 + dc * 0.2},${r + 0.5 + dr * 0.2}`;
  }
  return p.cells.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(" ");
}

function arrowHead(p: Piece): string {
  const [hr, hc] = headOf(p);
  const [dx, dy] = [DELTA[p.dir][1], DELTA[p.dir][0]]; // (x,y)
  const x = hc + 0.5, y = hr + 0.5;
  const px = dy, py = -dx; // perpendicular
  const tip = `${x + dx * 0.46},${y + dy * 0.46}`;
  const a = `${x + px * 0.3 + dx * 0.04},${y + py * 0.3 + dy * 0.04}`;
  const b = `${x - px * 0.3 + dx * 0.04},${y - py * 0.3 + dy * 0.04}`;
  return `${tip} ${a} ${b}`;
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
    setTimeout(() => {
      setBoard((b) => {
        const pieces = b.pieces.filter((x) => x.id !== p.id);
        if (pieces.length === 0) {
          stopTimer();
          const timeMs = startedAt.current ? Date.now() - startedAt.current : 0;
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
        return { ...b, pieces };
      });
      setRemoved((r) => [...r, p]);
      setExitingId(null); setBusy(false);
    }, 240);
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

      <div className="relative mx-auto w-full rounded-xl2 overflow-hidden" style={{ maxWidth: 380, aspectRatio: "1 / 1", background: NAVY, border: `1px solid ${NAVY2}` }}>
        <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(${NAVY2} 1px, transparent 1px), linear-gradient(90deg, ${NAVY2} 1px, transparent 1px)`, backgroundSize: `${100 / size}% ${100 / size}%`, opacity: 0.5 }} />
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
          {board.pieces.map((p) => {
            const exiting = exitingId === p.id;
            const color = flashId === p.id ? RED : PIPE;
            const [dx, dy] = [DELTA[p.dir][1], DELTA[p.dir][0]];
            return (
              <g key={p.id}
                onClick={() => tapPiece(p)}
                style={{
                  cursor: "pointer",
                  transform: exiting ? `translate(${dx * 420}px, ${dy * 420}px)` : "none",
                  opacity: exiting ? 0 : 1,
                  transition: "transform .26s ease, opacity .26s ease",
                }}>
                {hintId === p.id && (
                  <polyline points={piecePoints(p)} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.92} strokeLinecap="round" strokeLinejoin="round" />
                )}
                <polyline points={piecePoints(p)} fill="none" stroke={color} strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "stroke" }} />
                <polygon points={arrowHead(p)} fill={color} style={{ pointerEvents: "fill" }} />
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
        <p className="muted text-center text-sm">Tap a pipe to drive it off the grid. Clear them all.</p>
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
