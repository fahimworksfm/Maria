"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, Lightbulb, type LucideIcon } from "lucide-react";
import { genLevel, genDaily, canExit, countArrows, findHint, DELTA, type Grid, type Dir } from "@/lib/arrows";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";
import Confetti from "@/components/Confetti";

export type Result = { moves: number; timeMs: number } | null;

const ICON: Record<Dir, LucideIcon> = { U: ArrowUp, D: ArrowDown, L: ArrowLeft, R: ArrowRight };
type Mode = "levels" | "daily";

function fmtTime(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function ArrowsGame({
  startLevel,
  partnerLevel,
  partnerName,
  dailyDate,
  dailyKey,
  myDaily,
  partnerDaily,
  saveLevel,
  recordResult,
}: {
  startLevel: number;
  partnerLevel: number | null;
  partnerName: string;
  dailyDate: string;
  dailyKey: string;
  myDaily: Result;
  partnerDaily: Result;
  saveLevel: (level: number) => Promise<void>;
  recordResult: (puzzleKey: string, moves: number, timeMs: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("levels");
  const [level, setLevel] = useState(startLevel);
  const [grid, setGrid] = useState<Grid>(() => genLevel(startLevel));
  const [moves, setMoves] = useState(0);
  const [exiting, setExiting] = useState<{ r: number; c: number; dir: Dir } | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [hintCell, setHintCell] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dailySolved, setDailySolved] = useState<Result>(myDaily);

  const startedAt = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const loadGrid = useCallback((g: Grid) => {
    setGrid(g);
    setMoves(0);
    setWon(false);
    setExiting(null);
    setShake(null);
    setHintCell(null);
    setBusy(false);
    setElapsed(0);
    startedAt.current = null;
    stopTimer();
  }, [stopTimer]);

  // (Re)load the puzzle when mode/level changes.
  useEffect(() => {
    if (mode === "levels") loadGrid(genLevel(level));
    else loadGrid(genDaily(dailyDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level, dailyDate]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  function ensureTimer() {
    if (startedAt.current == null) {
      startedAt.current = Date.now();
      tickRef.current = setInterval(() => {
        if (startedAt.current != null) setElapsed(Date.now() - startedAt.current);
      }, 100);
    }
  }

  function tapCell(r: number, c: number) {
    if (busy || won) return;
    const dir = grid[r]![c];
    if (!dir) return;
    if (!canExit(grid, r, c)) {
      tap(HAPTIC.tap);
      setShake(`${r},${c}`);
      setTimeout(() => setShake(null), 320);
      return;
    }
    ensureTimer();
    setBusy(true);
    setHintCell(null);
    tap(HAPTIC.tick);
    play("tick");
    setExiting({ r, c, dir });
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setTimeout(() => {
      setGrid((g) => {
        const next = g.map((row) => [...row]);
        next[r]![c] = null;
        if (countArrows(next) === 0) {
          stopTimer();
          const timeMs = startedAt.current ? Date.now() - startedAt.current : 0;
          setElapsed(timeMs);
          setWon(true);
          if (mode === "levels") {
            void saveLevel(level + 1);
            void recordResult(`L${level}`, nextMoves, timeMs);
            setTimeout(() => setLevel((l) => l + 1), 1600);
          } else {
            void recordResult(dailyKey, nextMoves, timeMs);
            setDailySolved({ moves: nextMoves, timeMs });
          }
        }
        return next;
      });
      setExiting(null);
      setBusy(false);
    }, 260);
  }

  function restart() { tap(HAPTIC.tick); loadGrid(mode === "levels" ? genLevel(level) : genDaily(dailyDate)); }

  function hint() {
    if (won || busy) return;
    const h = findHint(grid);
    if (!h) return;
    tap(HAPTIC.tick);
    setHintCell(`${h[0]},${h[1]}`);
    setTimeout(() => setHintCell(null), 1300);
  }

  const size = grid.length;
  const remaining = countArrows(grid);

  return (
    <div className="space-y-5">
      {won && <Confetti trigger={`arrows-${mode}-${level}`} />}

      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl2 bg-panel2/60 border border-line">
        {(["levels", "daily"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { tap(HAPTIC.tick); setMode(m); }}
            className={`py-2 rounded-lg text-sm transition ${mode === m ? "bg-accent/15 text-ink" : "text-muted hover:text-ink"}`}
          >
            {m === "levels" ? "Levels" : "Daily puzzle"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="label !mb-0">{mode === "levels" ? "Level" : "Today"}</span>
          <div className="font-display text-2xl leading-none">{mode === "levels" ? level : dailyDate.slice(5)}</div>
        </div>
        <div className="text-center">
          <span className="label !mb-0">Moves</span>
          <div className="font-display text-2xl leading-none">{moves}</div>
        </div>
        <div className="text-right">
          <span className="label !mb-0">Time</span>
          <div className="font-display text-2xl leading-none tabular-nums">{fmtTime(elapsed)}</div>
        </div>
      </div>

      <div className="grid gap-2 mx-auto select-none" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: 380 }}>
        {grid.map((row, r) =>
          row.map((dir, c) => {
            const k = `${r},${c}`;
            const isExiting = exiting && exiting.r === r && exiting.c === c;
            const exitTransform = isExiting ? `translate(${DELTA[exiting!.dir][1] * 140}%, ${DELTA[exiting!.dir][0] * 140}%)` : undefined;
            const Icon = dir ? ICON[dir] : null;
            return (
              <div key={k} className="aspect-square">
                {dir && Icon ? (
                  <button
                    onClick={() => tapCell(r, c)}
                    aria-label={`Arrow ${dir}`}
                    className={`w-full h-full rounded-xl2 grid place-items-center bg-accent/12 text-accent border transition-all duration-200 active:scale-90 hover:bg-accent/20 ${shake === k ? "shake" : ""} ${hintCell === k ? "ring-2 ring-accent border-accent" : "border-accent/20"}`}
                    style={{ transform: exitTransform, opacity: isExiting ? 0 : 1 }}
                  >
                    <Icon size={Math.max(18, 120 / size)} strokeWidth={2.2} aria-hidden />
                  </button>
                ) : (
                  <div className="w-full h-full rounded-xl2 bg-panel2/40 border border-line/40" />
                )}
              </div>
            );
          })
        )}
      </div>

      {won ? (
        <p className="text-center font-display text-lg">
          {mode === "levels" ? "Cleared. Next one…" : `Solved in ${moves} moves · ${fmtTime(elapsed)}`}
        </p>
      ) : (
        <p className="muted text-center text-sm">Tap an arrow to send it off the grid. Clear them all.</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button onClick={restart} className="btn inline-flex items-center gap-2 text-sm">
            <RotateCcw size={16} aria-hidden /> Restart
          </button>
          <button onClick={hint} className="btn inline-flex items-center gap-2 text-sm" disabled={won}>
            <Lightbulb size={16} aria-hidden /> Hint
          </button>
        </div>
        {mode === "levels" && partnerLevel != null && (
          <span className="muted text-xs text-right">You: lvl {level}<br />{partnerName}: lvl {partnerLevel}</span>
        )}
      </div>

      {mode === "daily" && (
        <div className="card p-4 space-y-2">
          <h3 className="label">Today&apos;s puzzle · you vs {partnerName}</h3>
          <Row who="You" r={dailySolved} />
          <Row who={partnerName} r={partnerDaily} />
          {dailySolved && partnerDaily && (
            <p className="muted text-xs pt-1">
              {scoreLine(dailySolved, partnerDaily, partnerName)}
            </p>
          )}
        </div>
      )}
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
