// Mide qué porcentaje de celdas pintadas da puzzles de solución única.
// Uso: npx vite-node scripts/density.ts
import { gridClues, solve } from '../src/lib/nonogram'

let seed = 20261125
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

/** Ruido independiente: cada celda se pinta con probabilidad p. */
const noise = (n: number, p: number) => Uint8Array.from({ length: n * n }, () => (rnd() < p ? 1 : 0))

/** Imagen "con formas": ruido suavizado por vecinos, ajustado al % pedido. */
function blobs(n: number, p: number): Uint8Array {
  let f = Float32Array.from({ length: n * n }, () => rnd())
  for (let it = 0; it < 2; it++) {
    const g = new Float32Array(n * n)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0, c = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx
        if (yy >= 0 && yy < n && xx >= 0 && xx < n) { s += f[yy * n + xx]; c++ }
      }
      g[y * n + x] = s / c
    }
    f = g
  }
  const order = Array.from(f.keys()).sort((a, b) => f[a] - f[b])
  const out = new Uint8Array(n * n)
  for (let i = 0; i < Math.round(p * n * n); i++) out[order[i]] = 1
  return out
}

const SAMPLES = 300
const sizes = [5, 10, 15, 20]
const dens = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]

for (const kind of ['ruido', 'formas'] as const) {
  console.log(`\n== ${kind}: % con solución ÚNICA (y % resoluble solo por lógica) sobre ${SAMPLES} tableros ==`)
  console.log('tamaño | ' + dens.map((d) => `${Math.round(d * 100)}%`.padStart(9)).join(' '))
  for (const n of sizes) {
    const cells: string[] = []
    for (const d of dens) {
      let uniq = 0, logic = 0, abort = 0
      const samples = n >= 15 ? 80 : SAMPLES
      for (let i = 0; i < samples; i++) {
        const pic = kind === 'ruido' ? noise(n, d) : blobs(n, d)
        const { rows, cols } = gridClues(pic, n, n)
        const r = solve(rows, cols, { maxNodes: 1_500 })
        if (r.aborted) abort++
        else if (r.count === 1) { uniq++; if (r.logicOnly) logic++ }
      }
      cells.push(`${Math.round((uniq / samples) * 100)}/${Math.round((logic / samples) * 100)}`.padStart(9) + (abort ? '*' : ''))
    }
    console.log(`${String(n).padStart(3)}x${n}`.padEnd(7) + '| ' + cells.join(' '))
  }
}
console.log('\nFormato: única/solo-lógica. * = hubo tableros cortados por el límite de pasos (se cuentan como no únicos).')
