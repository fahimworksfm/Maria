// Arrows puzzle engine — snaking "pipe" pieces. Each piece is a connected path
// of cells (tail → head) with an arrowhead at the head; tapping drives it
// head-first off the board if the straight corridor ahead of the head is clear.
// The body trails through the cells the piece vacates, so only the head corridor
// needs to be clear of OTHER pieces. Pieces block each other while present.
//
// Levels are deterministic and always solvable by reverse-construction: a piece
// is only placed where its head corridor is clear of already-placed pieces, so
// the reverse of placement order solves it. (Confirmed with isSolvable.)

export type Dir = "U" | "D" | "L" | "R";
export const DELTA: Record<Dir, [number, number]> = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const DIRS: Dir[] = ["U", "D", "L", "R"];

export type Piece = { id: number; cells: [number, number][]; dir: Dir }; // cells tail → head
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

export function isSolvable(board: Board): boolean {
  let pieces = [...board.pieces];
  let progress = true;
  while (pieces.length && progress) {
    progress = false;
    for (const p of pieces) {
      if (canExit({ size: board.size, pieces }, p)) {
        pieces = pieces.filter((x) => x !== p);
        progress = true;
        break;
      }
    }
  }
  return pieces.length === 0;
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

// Build one snaking piece via a random self-avoiding walk. mask (if given) keeps
// the body inside a target shape. Returns null if it can't place a valid piece.
function buildPiece(
  rand: () => number, size: number, occ: Set<string>, maxLen: number, idGen: () => number, mask?: Set<string>
): Piece | null {
  const sr = Math.floor(rand() * size);
  const sc = Math.floor(rand() * size);
  if (occ.has(ckey(sr, sc)) || (mask && !mask.has(ckey(sr, sc)))) return null;

  const cells: [number, number][] = [[sr, sc]];
  const used = new Set<string>([ckey(sr, sc)]);
  const len = 1 + Math.floor(rand() * maxLen);
  let lastDir: Dir | null = null;
  let [lr, lc] = [sr, sc];

  for (let i = 1; i < len; i++) {
    const cands = DIRS
      .map((d) => ({ d, r: lr + DELTA[d][0], c: lc + DELTA[d][1] }))
      .filter((x) =>
        x.r >= 0 && x.r < size && x.c >= 0 && x.c < size &&
        !occ.has(ckey(x.r, x.c)) && !used.has(ckey(x.r, x.c)) &&
        (!mask || mask.has(ckey(x.r, x.c)))
      );
    if (!cands.length) break;
    const pick = cands[Math.floor(rand() * cands.length)]!;
    cells.push([pick.r, pick.c]);
    used.add(ckey(pick.r, pick.c));
    lr = pick.r; lc = pick.c; lastDir = pick.d;
  }

  const dir = lastDir ?? DIRS[Math.floor(rand() * 4)]!;
  // Head corridor must be clear of already-placed pieces.
  const [dr, dc] = DELTA[dir];
  let er = lr + dr, ec = lc + dc;
  while (er >= 0 && er < size && ec >= 0 && ec < size) {
    if (occ.has(ckey(er, ec))) return null;
    er += dr; ec += dc;
  }
  return { id: idGen(), cells, dir };
}

function packBoard(seed: number, size: number, target: number, maxLen: number, mask?: Set<string>): Board {
  const rand = mulberry32(seed);
  const occ = new Set<string>();
  const pieces: Piece[] = [];
  let nextId = 1;
  const idGen = () => nextId++;
  const cap = mask ? mask.size : target;
  let attempts = 0;
  while (pieces.length < target && attempts < cap * 200) {
    attempts++;
    const p = buildPiece(rand, size, occ, maxLen, idGen, mask);
    if (!p) continue;
    for (const [r, c] of p.cells) occ.add(ckey(r, c));
    pieces.push(p);
    if (mask && occ.size >= mask.size) break;
  }
  return { size, pieces };
}

export function genLevel(level: number): Board {
  const size = Math.min(4 + Math.floor((level - 1) / 3), 6);
  const target = Math.min(2 + level, Math.floor((size * size) / 3));
  const maxLen = size >= 6 ? 4 : 3;
  return packBoard(level * 9973 + 7, size, target, maxLen);
}

// ---- Shaped (picture) puzzles ----
function maskFromArt(art: string[]): { size: number; mask: Set<string> } {
  const size = art.length;
  const mask = new Set<string>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (art[r]![c] === "#") mask.add(ckey(r, c));
    }
  }
  return { size, mask };
}

const HEART = [
  ".##.##.",
  "#######",
  "#######",
  "#######",
  ".#####.",
  "..###..",
  "...#...",
];

export function genShaped(seed: number, art: string[]): Board {
  const { size, mask } = maskFromArt(art);
  // Pack the shape, then trust reverse-construction (solver-validated below).
  let board = packBoard(seed, size, mask.size, 5, mask);
  if (!isSolvable(board)) board = packBoard(seed + 1, size, mask.size, 5, mask);
  return board;
}

export function genDaily(dateStr: string): Board {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  const board = genShaped((h >>> 0) + 12345, HEART);
  // Safety net: if the shaped pack somehow under-fills, it's still solvable.
  return board.pieces.length > 0 ? board : packBoard((h >>> 0) + 99, 6, 9, 4);
}
