// Grid cells are numbers 1–9 or null for empty.

/**
 * Create an N x N grid filled with random integers 1–9.
 * @param {number} size
 * @param {() => number} [rng] Optional RNG returning [0, 1).
 * @returns {(number|null)[][]}
 */
export function createGrid(size, rng = Math.random) {
  const total = size * size;

  // Build a pool with even distribution of 1–9, biasing 5 higher
  // since 5 can only match with itself (no partner sums to 10).
  const pool = [];
  const perValue = Math.floor(total / 10);
  const fiveCount = total - perValue * 8;
  for (let v = 1; v <= 9; v++) {
    const count = v === 5 ? fiveCount : perValue;
    for (let i = 0; i < count; i++) {
      pool.push(v);
    }
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Place values into grid, swapping from the pool to avoid adjacent duplicates
  let idx = 0;
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      const left = c > 0 ? row[c - 1] : null;
      const up = r > 0 ? grid[r - 1][c] : null;

      if (pool[idx] === left || pool[idx] === up) {
        // Try to find a non-adjacent swap candidate in the remaining pool
        let swapped = false;
        for (let k = idx + 1; k < pool.length; k++) {
          if (pool[k] !== left && pool[k] !== up) {
            [pool[idx], pool[k]] = [pool[k], pool[idx]];
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          // Fallback: pick any allowed value
          pool[idx] = pickValueAvoidingAdjacents(grid, row, r, c, rng);
        }
      }

      row.push(pool[idx]);
      idx++;
    }
    grid.push(row);
  }
  return grid;
}

function randomCellValue(rng) {
  // 1–9 inclusive
  return 1 + Math.floor(rng() * 9);
}

/**
 * Strong bias against adjacent duplicates: avoid matching the immediate
 * left/up neighbor values when possible.
 *
 * @param {(number|null)[][]} gridSoFar Fully built previous rows
 * @param {(number|null)[]} currentRow Row being built
 * @param {number} r
 * @param {number} c
 * @param {() => number} rng
 * @returns {number}
 */
function pickValueAvoidingAdjacents(gridSoFar, currentRow, r, c, rng) {
  const forbidden = new Set();

  const left = c > 0 ? currentRow[c - 1] : null;
  const up = r > 0 && gridSoFar[r - 1] ? gridSoFar[r - 1][c] : null;

  if (typeof left === 'number') forbidden.add(left);
  if (typeof up === 'number') forbidden.add(up);

  // If nothing to avoid, keep it simple.
  if (forbidden.size === 0) return randomCellValue(rng);

  // Choose uniformly from allowed values (1–9 excluding forbidden).
  /** @type {number[]} */
  const allowed = [];
  for (let v = 1; v <= 9; v++) {
    if (!forbidden.has(v)) allowed.push(v);
  }

  // Fallback (should be unreachable with only left/up forbidden)
  if (allowed.length === 0) return randomCellValue(rng);

  return allowed[Math.floor(rng() * allowed.length)];
}

function inBounds(grid, row, col) {
  return row >= 0 && row < grid.length && col >= 0 && col < grid.length;
}

function getCell(grid, row, col) {
  if (!inBounds(grid, row, col)) return null;
  return grid[row][col];
}

/**
 * Check whether two cells are aligned horizontally, vertically, or diagonally.
 */
function areAligned(r1, c1, r2, c2) {
  if (r1 === r2) return true; // same row
  if (c1 === c2) return true; // same column
  if (Math.abs(r1 - r2) === Math.abs(c1 - c2)) return true; // diagonal
  return false;
}

/**
 * Compute the step direction between two aligned cells.
 */
function stepDirection(r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  return { dr, dc };
}

/**
 * Validate that all intermediate cells between endpoints are empty (null).
 */
function pathIsClear(grid, r1, c1, r2, c2) {
  const { dr, dc } = stepDirection(r1, c1, r2, c2);

  let r = r1 + dr;
  let c = c1 + dc;

  while (r !== r2 || c !== c2) {
    const value = getCell(grid, r, c);
    if (value !== null) return false;
    r += dr;
    c += dc;
  }
  return true;
}

/**
 * Determine if two cells can be matched according to the game rules.
 *
 * @param {(number|null)[][]} grid
 * @param {{ row: number, col: number }} a
 * @param {{ row: number, col: number }} b
 * @returns {boolean}
 */
export function canMatch(grid, a, b) {
  const { row: r1, col: c1 } = a;
  const { row: r2, col: c2 } = b;

  if (!inBounds(grid, r1, c1) || !inBounds(grid, r2, c2)) return false;
  if (r1 === r2 && c1 === c2) return false;

  const v1 = grid[r1][c1];
  const v2 = grid[r2][c2];

  if (v1 === null || v2 === null) return false;

  if (!areAligned(r1, c1, r2, c2)) return false;
  if (!pathIsClear(grid, r1, c1, r2, c2)) return false;

  if (v1 === v2) return true;
  if (v1 + v2 === 10) return true;

  return false;
}

/**
 * Apply a match: clear both cells if they can match.
 *
 * @param {(number|null)[][]} grid
 * @param {{ row: number, col: number }} a
 * @param {{ row: number, col: number }} b
 * @returns {{ didClear: boolean }}
 */
export function applyMatch(grid, a, b) {
  if (!canMatch(grid, a, b)) {
    return { didClear: false };
  }

  grid[a.row][a.col] = null;
  grid[b.row][b.col] = null;

  return { didClear: true };
}

/**
 * Collapse fully empty rows and refill new rows at the bottom.
 *
 * Modifies the grid in place and returns metadata for rendering updates.
 *
 * @param {(number|null)[][]} grid
 * @param {() => number} [rng]
 * @returns {{
 *   clearedRows: number[],    // indices of rows that were fully empty before collapse
 *   newRowIndices: number[],  // indices of rows that were newly created at the bottom
 * }}
 */
export function collapseAndRefill(grid, rng = Math.random) {
  const size = grid.length;
  const clearedRows = [];
  const keptRows = [];

  for (let r = 0; r < size; r++) {
    const row = grid[r];
    const isEmptyRow = row.every((cell) => cell === null);
    if (isEmptyRow) {
      clearedRows.push(r);
    } else {
      keptRows.push(row);
    }
  }

  const clearedCount = size - keptRows.length;

  if (clearedCount <= 0) {
    return { clearedRows, newRowIndices: [] };
  }

  const newRows = [];
  const newRowIndices = [];

  for (let i = 0; i < clearedCount; i++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      // Build new rows with the same "avoid adjacent duplicates" bias,
      // considering the row above (kept or newly generated).
      row.push(pickValueAvoidingAdjacents(nextGridLike(keptRows, newRows), row, keptRows.length + i, c, rng));
    }
    newRows.push(row);
  }

  const nextGrid = keptRows.concat(newRows);

  for (let r = 0; r < size; r++) {
    grid[r] = nextGrid[r];
  }

  for (let i = 0; i < clearedCount; i++) {
    newRowIndices.push(size - clearedCount + i);
  }

  return { clearedRows, newRowIndices };
}

/**
 * Helper for refill-time generation: creates a lightweight "grid so far"
 * view by stacking keptRows + newRows as it's being built.
 *
 * @param {(number|null)[][]} keptRows
 * @param {(number|null)[][]} newRows
 * @returns {(number|null)[][]}
 */
function nextGridLike(keptRows, newRows) {
  return keptRows.concat(newRows);
}

/**
 * Collapse fully empty columns and refill new columns on the right.
 * Modifies the grid in place.
 *
 * @param {(number|null)[][]} grid
 * @param {() => number} [rng]
 * @returns {{ clearedCols: number[] }}
 */
export function collapseEmptyColumns(grid, rng = Math.random) {
  const size = grid.length;
  const emptyCols = [];

  for (let c = 0; c < size; c++) {
    let allEmpty = true;
    for (let r = 0; r < size; r++) {
      if (grid[r][c] !== null) { allEmpty = false; break; }
    }
    if (allEmpty) emptyCols.push(c);
  }

  if (emptyCols.length === 0) return { clearedCols: [] };

  // For each row, remove empty column values and append new ones on the right
  for (let r = 0; r < size; r++) {
    const kept = [];
    for (let c = 0; c < size; c++) {
      if (!emptyCols.includes(c)) kept.push(grid[r][c]);
    }
    while (kept.length < size) {
      kept.push(1 + Math.floor(rng() * 9));
    }
    grid[r] = kept;
  }

  return { clearedCols: emptyCols };
}

/**
 * Scan the grid to see if any valid moves remain.
 *
 * @param {(number|null)[][]} grid
 * @returns {boolean}
 */
export function hasAnyMoves(grid) {
  const size = grid.length;

  for (let r1 = 0; r1 < size; r1++) {
    for (let c1 = 0; c1 < size; c1++) {
      if (grid[r1][c1] === null) continue;

      for (let r2 = 0; r2 < size; r2++) {
        for (let c2 = 0; c2 < size; c2++) {
          if (r1 === r2 && c1 === c2) continue;
          if (!areAligned(r1, c1, r2, c2)) continue;

          if (canMatch(grid, { row: r1, col: c1 }, { row: r2, col: c2 })) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

