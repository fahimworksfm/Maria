// Arrows puzzle engine — multi-cell sliding "pipe" pieces (original take on the
// Arrows – Puzzle Escape mechanic): each piece is a straight run of cells with an
// arrowhead at one end; tap it to slide it off the board in its head direction if
// the path beyond the head to the edge is clear. Pieces block each other.
//
// Levels are deterministic (seeded by level / date) and always solvable by
// reverse-construction: a piece is only placed where its exit path is clear of
// already-placed pieces, so the reverse of the placement order is a valid solve.

export type Dir = "U" | "D" | "L" | "R";
export const DELTA: Record<Dir, [number, number]> = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const DIRS: Dir[] = ["U", "D", "L", "R"];

export type Piece = { id: number; cells: [number, number][]; dir: Dir }; // cells ordered tail → head
export type Board = { size: number; pieces: Piece[] };

const ckey = (r: number, c: number) => `${r},${c}`;

function occupancy(pieces: Piece[], exceptId?: number): Set<string> {
  const s = new Set<string>();
  for (const p of pieces) {
    if (p.id === exceptId) continue;
    for (const [r, c] of p.cells) s.add(ckey(r, c));
  }
  return s;
}

export function headOf(p: Piece): [number, number] {
  return p.cells[p.cells.length - 1]!;
}

export function canExit(board: Board, piece: Piece): boolean {
  const occ = occupancy(board.pieces, piece.id);
  const [dr, dc] = DELTA[piece.dir];
  let [r, c] = headOf(piece);
  r += dr; c += dc;
  while (r >= 0 && r < board.size && c >= 0 && c < board.size) {
    if (occ.has(ckey(r, c))) return false;
    r += dr; c += dc;
  }
  return true;
}

export function findHintId(board: Board): number | null {
  for (const p of board.pieces) if (canExit(board, p)) return p.id;
  return null;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genBoard(seed: number, size: number, target: number, maxLen: number): Board {
  const rand = mulberry32(seed);
  const occ = new Set<string>();
  const pieces: Piece[] = [];
  let id = 1;
  let attempts = 0;
  while (pieces.length < target && attempts < target * 120) {
    attempts++;
    const dir = DIRS[Math.floor(rand() * 4)]!;
    const len = 1 + Math.floor(rand() * maxLen);
    const hr = Math.floor(rand() * size);
    const hc = Math.floor(rand() * size);
    const [dr, dc] = DELTA[dir];

    // Body extends opposite the head direction. Build tail → head.
    const cells: [number, number][] = [];
    let ok = true;
    for (let i = len - 1; i >= 0; i--) {
      const r = hr - dr * i;
      const c = hc - dc * i;
      if (r < 0 || r >= size || c < 0 || c >= size || occ.has(ckey(r, c))) { ok = false; break; }
      cells.push([r, c]);
    }
    if (!ok) continue;

    // Exit path from head to edge must be clear of already-placed pieces.
    let er = hr + dr;
    let ec = hc + dc;
    let clear = true;
    while (er >= 0 && er < size && ec >= 0 && ec < size) {
      if (occ.has(ckey(er, ec))) { clear = false; break; }
      er += dr; ec += dc;
    }
    if (!clear) continue;

    for (const [r, c] of cells) occ.add(ckey(r, c));
    pieces.push({ id: id++, cells, dir });
  }
  return { size, pieces };
}

export function genLevel(level: number): Board {
  const size = Math.min(4 + Math.floor((level - 1) / 3), 6); // 4 → 6
  const target = Math.min(2 + level, Math.floor((size * size) / 3));
  const maxLen = size >= 6 ? 4 : 3;
  return genBoard(level * 9973 + 7, size, target, maxLen);
}

export function genDaily(dateStr: string): Board {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  return genBoard((h >>> 0) + 12345, 6, 9, 4);
}
