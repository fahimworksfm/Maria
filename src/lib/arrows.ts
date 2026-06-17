// Arrows puzzle engine (original take on the "tap an arrow, it slides off the
// grid if its path is clear; clear the board to win" mechanic).
//
// Levels are generated deterministically from the level number so both partners
// get the same puzzle, and by reverse-construction so every level is solvable:
// we place arrows one at a time only where their straight path to the edge is
// clear of already-placed arrows — the reverse of that placement order is a
// valid solve order.

export type Dir = "U" | "D" | "L" | "R";
export type Cell = Dir | null;
export type Grid = Cell[][];

export const DELTA: Record<Dir, [number, number]> = {
  U: [-1, 0],
  D: [1, 0],
  L: [0, -1],
  R: [0, 1],
};

const DIRS: Dir[] = ["U", "D", "L", "R"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cells the arrow at (r,c) must travel through to leave the board (exclusive of
// its own cell, inclusive to the edge).
export function pathToEdge(r: number, c: number, dir: Dir, size: number): Array<[number, number]> {
  const [dr, dc] = DELTA[dir];
  const cells: Array<[number, number]> = [];
  let nr = r + dr;
  let nc = c + dc;
  while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
    cells.push([nr, nc]);
    nr += dr;
    nc += dc;
  }
  return cells;
}

// Is this arrow free to fly off the board right now? (no occupied cell in path)
export function canExit(grid: Grid, r: number, c: number): boolean {
  const dir = grid[r]![c]!;
  if (!dir) return false;
  for (const [pr, pc] of pathToEdge(r, c, dir, grid.length)) {
    if (grid[pr]![pc]) return false;
  }
  return true;
}

export function countArrows(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell) n++;
  return n;
}

function genGrid(seed: number, size: number, target: number): Grid {
  const rand = mulberry32(seed);
  const grid: Grid = Array.from({ length: size }, () => Array<Cell>(size).fill(null));
  const occupied = new Set<string>();

  let placed = 0;
  let attempts = 0;
  while (placed < target && attempts < target * 60) {
    attempts++;
    const r = Math.floor(rand() * size);
    const c = Math.floor(rand() * size);
    if (occupied.has(`${r},${c}`)) continue;
    const order = [...DIRS].sort(() => rand() - 0.5);
    let chosen: Dir | null = null;
    for (const dir of order) {
      const clear = pathToEdge(r, c, dir, size).every(([pr, pc]) => !occupied.has(`${pr},${pc}`));
      if (clear) { chosen = dir; break; }
    }
    if (!chosen) continue;
    grid[r]![c] = chosen;
    occupied.add(`${r},${c}`);
    placed++;
  }
  return grid;
}

export function genLevel(level: number): Grid {
  const size = Math.min(4 + Math.floor((level - 1) / 4), 7); // 4 → 7 as you progress
  const target = Math.min(3 + level, Math.floor(size * size * 0.55));
  return genGrid(level * 9973 + 7, size, target);
}

// The same puzzle for everyone on a given calendar day (date-seeded).
export function genDaily(dateStr: string): Grid {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  return genGrid((h >>> 0) + 12345, 6, 16);
}

// First currently-exitable arrow — used by the hint button. There is always one
// until the board is clear (removing arrows only frees paths).
export function findHint(grid: Grid): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid.length; c++) {
      if (grid[r]![c] && canExit(grid, r, c)) return [r, c];
    }
  }
  return null;
}
