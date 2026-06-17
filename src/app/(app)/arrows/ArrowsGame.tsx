"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, type LucideIcon } from "lucide-react";
import { genLevel, canExit, countArrows, DELTA, type Grid, type Dir } from "@/lib/arrows";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";
import Confetti from "@/components/Confetti";

const ICON: Record<Dir, LucideIcon> = { U: ArrowUp, D: ArrowDown, L: ArrowLeft, R: ArrowRight };

type Exiting = { r: number; c: number; dir: Dir } | null;

export default function ArrowsGame({
  startLevel,
  partnerLevel,
  partnerName,
  saveLevel,
}: {
  startLevel: number;
  partnerLevel: number | null;
  partnerName: string;
  saveLevel: (level: number) => Promise<void>;
}) {
  const [level, setLevel] = useState(startLevel);
  const [grid, setGrid] = useState<Grid>(() => genLevel(startLevel));
  const [moves, setMoves] = useState(0);
  const [exiting, setExiting] = useState<Exiting>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);

  const size = grid.length;

  function load(l: number) {
    setLevel(l);
    setGrid(genLevel(l));
    setMoves(0);
    setWon(false);
    setExiting(null);
    setShake(null);
    setBusy(false);
  }

  function restart() {
    tap(HAPTIC.tick);
    load(level);
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
    // Fly off the board, then clear the cell.
    setBusy(true);
    tap(HAPTIC.tick);
    play("tick");
    setExiting({ r, c, dir });
    setMoves((m) => m + 1);
    setTimeout(() => {
      setGrid((g) => {
        const next = g.map((row) => [...row]);
        next[r]![c] = null;
        if (countArrows(next) === 0) {
          setWon(true);
          void saveLevel(level + 1);
          setTimeout(() => load(level + 1), 1500);
        }
        return next;
      });
      setExiting(null);
      setBusy(false);
    }, 260);
  }

  // Keep local grid in sync if the saved start level changes (rare).
  useEffect(() => { load(startLevel); /* eslint-disable-next-line */ }, [startLevel]);

  const remaining = countArrows(grid);

  return (
    <div className="space-y-5">
      {won && <Confetti trigger={`arrows-${level}`} />}

      <div className="flex items-center justify-between">
        <div>
          <span className="label !mb-0">Level</span>
          <div className="font-display text-2xl leading-none">{level}</div>
        </div>
        <div className="text-right">
          <span className="label !mb-0">Arrows left</span>
          <div className="font-display text-2xl leading-none">{remaining}</div>
        </div>
      </div>

      <div
        className="grid gap-2 mx-auto select-none"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: 380 }}
      >
        {grid.map((row, r) =>
          row.map((dir, c) => {
            const key = `${r},${c}`;
            const isExiting = exiting && exiting.r === r && exiting.c === c;
            const exitTransform = isExiting
              ? `translate(${DELTA[exiting!.dir][1] * 140}%, ${DELTA[exiting!.dir][0] * 140}%)`
              : undefined;
            const Icon = dir ? ICON[dir] : null;
            return (
              <div key={key} className="aspect-square">
                {dir && Icon ? (
                  <button
                    onClick={() => tapCell(r, c)}
                    aria-label={`Arrow ${dir}`}
                    className={`w-full h-full rounded-xl2 grid place-items-center bg-accent/12 text-accent border border-accent/20 transition-all duration-200 active:scale-90 hover:bg-accent/20 ${shake === key ? "shake" : ""}`}
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
        <p className="text-center font-display text-lg">Cleared. Next one…</p>
      ) : (
        <p className="muted text-center text-sm">Tap an arrow to send it off the grid. Clear them all.</p>
      )}

      <div className="flex items-center justify-between">
        <button onClick={restart} className="btn inline-flex items-center gap-2 text-sm">
          <RotateCcw size={16} aria-hidden /> Restart
        </button>
        {partnerLevel != null && (
          <span className="muted text-xs">
            You: level {level} · {partnerName}: level {partnerLevel}
          </span>
        )}
      </div>
    </div>
  );
}
