import { useEffect, useState } from 'react'
import type { BoardCtx } from './NonogramBoard'

export const SOLVE_SIZES = [5, 10, 15, 20, 25] as const

interface Props {
  ctx: BoardCtx
  size: number
  /** Texto del origen: "Aleatorio" o el nombre del nonograma guardado */
  label: string
  /** Imagen solución, para "Mostrar solución" */
  solution: Uint8Array
  logic: boolean
  onNew: (size: number) => void
  /** Edición fija (mensual, carrera mundial): sin "mostrar solución" ni nuevo aleatorio */
  edition?: boolean
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Panel del modo resolver: cronómetro, aviso de resuelto, mostrar solución y nuevo aleatorio. */
export default function SolvePanel({ ctx, size, label, solution, logic, onNew, edition }: Props) {
  const { filled, solved } = ctx
  const [start, setStart] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [end, setEnd] = useState<number | null>(null)
  const [gaveUp, setGaveUp] = useState(false)

  // El cronómetro arranca con la primera celda pintada y se frena al resolver o al mostrar la solución
  useEffect(() => {
    if (start === null && filled > 0 && !gaveUp) {
      const t = Date.now()
      setStart(t)
      setNow(t)
    }
  }, [filled, start, gaveUp])
  useEffect(() => {
    if (solved && end === null && !gaveUp) setEnd(Date.now())
  }, [solved, end, gaveUp])
  useEffect(() => {
    if (start === null || end !== null) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [start, end])

  const elapsed = start === null ? 0 : Math.max(0, (end ?? now) - start)

  return (
    <>
      <h2>Resolver</h2>
      <p className="muted">
        {label} · {size}×{size} · {logic ? 'se resuelve por lógica' : 'requiere probar y descartar'}
      </p>
      <p className="timer">⏱ {fmt(elapsed)}</p>
      {solved && !gaveUp && (
        <div className="ng-report unique" role="status">
          <strong>✔ ¡Resuelto!</strong>
          <p>Tiempo: {fmt(elapsed)}</p>
        </div>
      )}
      {gaveUp && (
        <div className="ng-report empty" role="status">
          <strong>Solución mostrada</strong>
          <p>Probá con otro nonograma.</p>
        </div>
      )}
      {ctx.zoomBlock}
      {!edition && (
        <>
      <h3>Nuevo aleatorio</h3>
      <div className="seg wrap" role="group" aria-label="Tamaño del nuevo nonograma">
        {SOLVE_SIZES.map((s) => (
          <button key={s} type="button" aria-pressed={false} onClick={() => onNew(s)}>
            {s}×{s}
          </button>
        ))}
      </div>
        </>
      )}
      <button className="btn ghost" onClick={ctx.clear} disabled={solved}>Limpiar tablero</button>
      {!edition && (
      <button
        className="btn ghost"
        disabled={solved || gaveUp}
        onClick={() => {
          setGaveUp(true)
          setEnd(Date.now())
          ctx.fill(solution)
        }}
      >
        Mostrar solución
      </button>
      )}
    </>
  )
}
