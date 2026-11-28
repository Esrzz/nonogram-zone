/**
 * Trazo bloqueado a una fila o columna (al resolver). Se decide el eje al salir de la primera celda; todo lo que se pinta
 * queda en la línea que pasa por ella, aunque el mouse se desvíe en diagonal.
 */
export interface StrokeLock {
  /** Celda donde empezó el trazo */
  r0: number
  c0: number
  /** null = todavía sin decidir (el mouse no salió de la primera celda) */
  axis: 'h' | 'v' | null
  /** Última celda pintada (siempre sobre la línea del eje, o la primera celda) */
  last: number
}

export const newLock = (start: number, size: number): StrokeLock => ({ r0: Math.floor(start / size), c0: start % size, axis: null, last: start })

/**
 * El mouse pasó por la celda `hover`. Devuelve las celdas a pintar (en orden, desde la última pintada) y actualiza el bloqueo.
 * Con el eje fijo, `last` siempre está en la línea elegida y el recorrido nunca se sale (antes el eje podía cambiar con el
 * trazo ya largo y se pintaban filas y columnas "a lo loco").
 */
export function lockStep(lk: StrokeLock, hover: number, size: number): number[] {
  const origin = lk.r0 * size + lk.c0
  const r = Math.floor(hover / size)
  const c = hover % size
  // El eje se decide una sola vez (al salir de la primera celda) y no cambia hasta soltar el mouse
  if (lk.axis === null && !(r === lk.r0 && c === lk.c0)) lk.axis = Math.abs(c - lk.c0) >= Math.abs(r - lk.r0) ? 'h' : 'v'
  const to = lk.axis === 'v' ? r * size + lk.c0 : lk.axis === 'h' ? lk.r0 * size + c : origin
  const step = lk.axis === 'v' ? size : 1
  const out: number[] = []
  if (to === lk.last) return [to]
  const dir = to > lk.last ? step : -step
  for (let j = lk.last; out.length <= size; j += dir) {
    out.push(j)
    if (j === to) break
  }
  lk.last = to
  return out
}
