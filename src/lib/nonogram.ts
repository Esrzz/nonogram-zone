/**
 * Motor de nonogramas: pistas, solver por líneas + búsqueda, y verificación de unicidad.
 * Celdas del solver: -1 = desconocida, 0 = vacía, 1 = rellena.
 */

export type Clue = number[]

/** Pistas de una línea de celdas 0/1 ([] si no hay ninguna celda rellena). */
export function lineClue(line: ArrayLike<number>): Clue {
  const out: number[] = []
  let run = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) run++
    else if (run) { out.push(run); run = 0 }
  }
  if (run) out.push(run)
  return out
}

/** Pistas de filas y columnas de una cuadrícula (rows × cols, fila por fila) de celdas 0/1. */
export function gridClues(cells: ArrayLike<number>, rows: number, cols: number): { rows: Clue[]; cols: Clue[] } {
  const r: Clue[] = []
  const c: Clue[] = Array.from({ length: cols }, () => [])
  const run = new Int32Array(cols)
  for (let y = 0; y < rows; y++) {
    const row: Clue = []
    let n = 0
    for (let x = 0; x < cols; x++) {
      if (cells[y * cols + x] === 1) {
        n++
        run[x]++
      } else {
        if (n) { row.push(n); n = 0 }
        if (run[x]) { c[x].push(run[x]); run[x] = 0 }
      }
    }
    if (n) row.push(n)
    r.push(row)
  }
  for (let x = 0; x < cols; x++) if (run[x]) c[x].push(run[x])
  return { rows: r, cols: c }
}

/** Cantidad de celdas rellenas que piden las pistas (suma de una de las dos listas). */
export const filledCount = (clues: Clue[]): number => clues.reduce((a, c) => a + c.reduce((x, y) => x + y, 0), 0)

/**
 * Resuelve una línea: dadas las pistas y lo que ya se sabe, devuelve la línea con todo lo que se deduce
 * (o null si es imposible). Programación dinámica: qué celdas pueden ser vacías / rellenas en alguna colocación válida.
 */
export function solveLine(clue: Clue, line: Int8Array): Int8Array | null {
  const n = line.length
  const k = clue.length
  const W = k + 2
  const pre = new Uint8Array((n + 2) * W)
  const suf = new Uint8Array((n + 2) * W)

  /** Posición siguiente libre tras colocar el bloque j en i, o -1 si no entra. */
  const fit = (i: number, len: number): number => {
    if (i + len > n) return -1
    for (let t = i; t < i + len; t++) if (line[t] === 0) return -1
    if (i + len === n) return n
    if (line[i + len] === 1) return -1
    return i + len + 1
  }

  pre[0] = 1
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!pre[i * W + j]) continue
      if (i < n && line[i] !== 1) pre[(i + 1) * W + j] = 1
      if (j < k) {
        const nx = fit(i, clue[j])
        if (nx >= 0) pre[nx * W + j + 1] = 1
      }
    }
  }
  if (!pre[n * W + k]) return null

  suf[n * W + k] = 1
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= k; j++) {
      let ok = line[i] !== 1 && suf[(i + 1) * W + j] === 1
      if (!ok && j < k) {
        const nx = fit(i, clue[j])
        ok = nx >= 0 && suf[nx * W + j + 1] === 1
      }
      if (ok) suf[i * W + j] = 1
    }
  }

  const canEmpty = new Uint8Array(n)
  for (let c = 0; c < n; c++) {
    if (line[c] === 1) continue
    for (let j = 0; j <= k; j++) {
      if (pre[c * W + j] && suf[(c + 1) * W + j]) { canEmpty[c] = 1; break }
    }
  }
  const diff = new Int32Array(n + 1)
  for (let j = 0; j < k; j++) {
    for (let i = 0; i + clue[j] <= n; i++) {
      if (!pre[i * W + j]) continue
      const nx = fit(i, clue[j])
      if (nx >= 0 && suf[nx * W + j + 1]) {
        diff[i]++
        diff[i + clue[j]]--
        // la celda de separación que sigue al bloque también queda vacía en esta colocación
        if (i + clue[j] < n) canEmpty[i + clue[j]] = 1
      }
    }
  }
  const out = new Int8Array(n)
  let cover = 0
  for (let c = 0; c < n; c++) {
    cover += diff[c]
    const f = cover > 0
    const e = canEmpty[c] === 1
    if (!f && !e) return null
    out[c] = f && e ? -1 : f ? 1 : 0
  }
  return out
}

/** Propaga línea por línea hasta que no se deduce nada más. false = contradicción. */
function propagate(cells: Int8Array, R: number, C: number, rows: Clue[], cols: Clue[]): boolean {
  const rowDirty = new Uint8Array(R).fill(1)
  const colDirty = new Uint8Array(C).fill(1)
  const rowLine = new Int8Array(C)
  const colLine = new Int8Array(R)
  for (;;) {
    let any = false
    for (let r = 0; r < R; r++) {
      if (!rowDirty[r]) continue
      rowDirty[r] = 0
      for (let c = 0; c < C; c++) rowLine[c] = cells[r * C + c]
      const res = solveLine(rows[r], rowLine)
      if (!res) return false
      for (let c = 0; c < C; c++) {
        if (res[c] !== rowLine[c]) { cells[r * C + c] = res[c]; colDirty[c] = 1; any = true }
      }
    }
    for (let c = 0; c < C; c++) {
      if (!colDirty[c]) continue
      colDirty[c] = 0
      for (let r = 0; r < R; r++) colLine[r] = cells[r * C + c]
      const res = solveLine(cols[c], colLine)
      if (!res) return false
      for (let r = 0; r < R; r++) {
        if (res[r] !== colLine[r]) { cells[r * C + c] = res[r]; rowDirty[r] = 1; any = true }
      }
    }
    if (!any && !rowDirty.includes(1) && !colDirty.includes(1)) return true
  }
}

export interface SolveResult {
  /** Cantidad de soluciones encontradas (se corta en 2: "2" significa "dos o más"). */
  count: 0 | 1 | 2
  /** Las soluciones halladas (hasta 2), celdas 0/1. */
  solutions: Uint8Array[]
  /** true si bastó la lógica por líneas, sin probar y descartar. */
  logicOnly: boolean
  /** true si se cortó por límite de pasos: el resultado no es definitivo. */
  aborted: boolean
  nodes: number
}

export function solve(rows: Clue[], cols: Clue[], opts: { maxNodes?: number } = {}): SolveResult {
  const R = rows.length
  const C = cols.length
  const maxNodes = opts.maxNodes ?? 200_000
  const solutions: Uint8Array[] = []
  let nodes = 0
  let aborted = false

  // Chequeo rápido: las dos listas de pistas deben sumar lo mismo
  if (filledCount(rows) !== filledCount(cols)) {
    return { count: 0, solutions, logicOnly: true, aborted: false, nodes: 0 }
  }

  const search = (cells: Int8Array) => {
    if (aborted || solutions.length >= 2) return
    if (++nodes > maxNodes) { aborted = true; return }
    if (!propagate(cells, R, C, rows, cols)) return
    const idx = cells.indexOf(-1)
    if (idx < 0) { solutions.push(Uint8Array.from(cells)); return }
    for (const v of [1, 0] as const) {
      const next = cells.slice()
      next[idx] = v
      search(next)
    }
  }

  const root = new Int8Array(R * C).fill(-1)
  const rootOk = propagate(root, R, C, rows, cols)
  if (!rootOk) return { count: 0, solutions, logicOnly: true, aborted: false, nodes: 1 }
  if (!root.includes(-1)) {
    return { count: 1, solutions: [Uint8Array.from(root)], logicOnly: true, aborted: false, nodes: 1 }
  }
  search(root)
  return { count: Math.min(solutions.length, 2) as 0 | 1 | 2, solutions, logicOnly: false, aborted, nodes }
}

/**
 * Solo la lógica por líneas (sin probar y descartar). Devuelve el estado final: -1 en las celdas que la lógica no
 * pudo decidir, o null si las pistas se contradicen. Si no queda ningún -1, el puzzle es único y se resuelve por lógica.
 */
export function logicSolve(rows: Clue[], cols: Clue[]): Int8Array | null {
  const cells = new Int8Array(rows.length * cols.length).fill(-1)
  return propagate(cells, rows.length, cols.length, rows, cols) ? cells : null
}
