import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gridClues, solve } from '../lib/nonogram'
import type { SolveResult } from '../lib/nonogram'
import { useSettings } from '../lib/settingsStore'

type Cell = 0 | 1 | 2 // 0 vacío, 1 relleno, 2 marca X

const ZOOM_MIN = 1
const ZOOM_MAX = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Mantiene el contenido ampliado dentro del recuadro visible: el desplazamiento va de (visible - contenido) a 0. */
function clampOff(o: { x: number; y: number }, z: number, w: number, h: number) {
  return { x: clamp(o.x, w - w * z, 0), y: clamp(o.y, h - h * z, 0) }
}

/** Rango de pintado recomendado (% de celdas) para que el puzzle suela tener solución única. Medido con scripts/density.ts. */
const GOOD_MIN = 45
const GOOD_MAX = 65

interface Props {
  size?: number
}

type Report =
  | { kind: 'empty' }
  | { kind: 'unique'; logic: boolean; ms: number }
  | { kind: 'multiple'; diff: number; ms: number }
  | { kind: 'none' }
  | { kind: 'unknown' }

function describe(r: SolveResult, ms: number, filled: number): Report {
  if (filled === 0) return { kind: 'empty' }
  if (r.aborted) return { kind: 'unknown' }
  if (r.count === 0) return { kind: 'none' }
  if (r.count === 1) return { kind: 'unique', logic: r.logicOnly, ms }
  const [a, b] = r.solutions
  let diff = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++
  return { kind: 'multiple', diff, ms }
}

function ClueList({ clue }: { clue: number[] }) {
  if (clue.length === 0) return <span className="cn zero">0</span>
  return (
    <>
      {clue.map((n, i) => (
        <span key={i} className="cn">{n}</span>
      ))}
    </>
  )
}

/**
 * Tablero de creación: lo que se pinta define la imagen y las pistas se calculan en vivo.
 * Clic = rellenar, clic derecho = marca X, arrastrar = pintar.
 */
export default function NonogramBoard({ size = 10 }: Props) {
  const both = useSettings().gameplay.bothSideClues
  const [cells, setCells] = useState<Cell[]>(() => Array(size * size).fill(0))
  const [report, setReport] = useState<Report | null>(null)
  const paint = useRef<Cell | null>(null)

  // Vista: zoom con la rueda y desplazamiento arrastrando con la rueda apretada (botón central)
  const boardRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [vs, setVs] = useState({ w: 0, h: 0 }) // tamaño del recuadro visible (px de maquetación)
  const [panning, setPanning] = useState(false)
  const pan = useRef<{ id: number } | null>(null)
  const live = useRef({ zoom: 1, off: { x: 0, y: 0 }, vs: { w: 0, h: 0 } })
  live.current = { zoom, off, vs }

  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const measure = () => setVs({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Relación entre píxeles de pantalla y de maquetación (cambia con el tamaño de interfaz). */
  const ratio = () => {
    const el = viewRef.current
    return el && el.clientWidth ? el.getBoundingClientRect().width / el.clientWidth : 1
  }

  // Rueda: arriba acerca, abajo aleja; el punto bajo el cursor queda fijo. Listener no pasivo para frenar el scroll.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const view = viewRef.current
      if (!view) return
      const { zoom: z, off: o, vs: v } = live.current
      const rect = view.getBoundingClientRect()
      const k = rect.width / (view.clientWidth || 1)
      const px = clamp((e.clientX - rect.left) / k, 0, v.w)
      const py = clamp((e.clientY - rect.top) / k, 0, v.h)
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const nz = clamp(z * Math.exp(-dy * 0.0015), ZOOM_MIN, ZOOM_MAX)
      if (nz === z) return
      const wx = (px - o.x) / z
      const wy = (py - o.y) / z
      setZoom(nz)
      setOff(clampOff({ x: px - wx * nz, y: py - wy * nz }, nz, v.w, v.h))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 1) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pan.current = { id: e.pointerId }
    paint.current = null
    setPanning(true)
  }
  const movePan = (e: React.PointerEvent) => {
    if (!pan.current || pan.current.id !== e.pointerId) return
    const k = ratio()
    const { zoom: z, off: o, vs: v } = live.current
    setOff(clampOff({ x: o.x + e.movementX / k, y: o.y + e.movementY / k }, z, v.w, v.h))
  }
  const endPan = (e: React.PointerEvent) => {
    if (!pan.current || pan.current.id !== e.pointerId) return
    pan.current = null
    setPanning(false)
  }
  const resetView = () => {
    setZoom(1)
    setOff({ x: 0, y: 0 })
  }
  const cur = clampOff(off, zoom, vs.w, vs.h)
  const slots = Math.ceil(size / 2)

  const clues = useMemo(() => gridClues(cells.map((c) => (c === 1 ? 1 : 0)), size, size), [cells, size])
  const filled = useMemo(() => cells.filter((c) => c === 1).length, [cells])
  const total = size * size
  const pct = (filled / total) * 100

  const set = (next: Cell[]) => {
    setCells(next)
    setReport(null) // el resultado anterior ya no corresponde al dibujo
  }
  const apply = (i: number, v: Cell) => {
    if (cells[i] === v) return
    set(cells.map((c, k) => (k === i ? v : c)))
  }

  const down = (e: React.PointerEvent, i: number) => {
    if (e.button === 1) return // la rueda apretada mueve la vista, no pinta
    e.preventDefault()
    const target: Cell = e.button === 2 ? 2 : 1
    const v: Cell = cells[i] === target ? 0 : target
    paint.current = v
    apply(i, v)
  }
  const enter = (i: number) => {
    if (paint.current !== null) apply(i, paint.current)
  }
  const stop = () => { paint.current = null }

  const verify = () => {
    const t0 = performance.now()
    const r = solve(clues.rows, clues.cols)
    setReport(describe(r, Math.round(performance.now() - t0), filled))
  }

  const sepR = (c: number) => (c + 1) % 5 === 0 && c !== size - 1
  const sepB = (r: number) => (r + 1) % 5 === 0 && r !== size - 1

  return (
    <div className="ng-layout">
      <div
        className="ng-meter"
        role="progressbar"
        aria-label="Porcentaje pintado del tablero"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span className="ng-meter-pct">{pct >= 100 ? 'Completo' : `${Math.round(pct)}%`}</span>
        <div className={`ng-meter-track${pct >= 100 ? ' full' : ''}`}>
          <div className="ng-meter-band" style={{ bottom: `${GOOD_MIN}%`, height: `${GOOD_MAX - GOOD_MIN}%` }} title={`Rango recomendado: ${GOOD_MIN}–${GOOD_MAX}%`} />
          <div className="ng-meter-fill" style={{ height: `${pct}%` }} />
        </div>
        <span className="ng-meter-sub">{filled}/{total}</span>
      </div>

      <div
        ref={boardRef}
        className={`ng${both ? ' both' : ''}${panning ? ' panning' : ''}`}
        style={{ ['--n' as string]: size, ['--slots' as string]: slots, ['--tracks' as string]: size + slots * (both ? 2 : 1), ['--z' as string]: zoom }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={(e) => { endPan(e); stop() }}
        onPointerCancel={endPan}
        onPointerLeave={stop}
        onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}
        onAuxClick={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Las pistas están en tiras fijas a los costados: se desplazan con la vista pero nunca salen de pantalla */}
        <div className="ng-strip top">
          <div className="ng-strip-in" style={{ transform: `translateX(${cur.x}px)` }}>
            <div className="ng-clues ng-cols">
              {clues.cols.map((c, i) => <div key={i} className="ng-clue col end"><ClueList clue={c} /></div>)}
            </div>
          </div>
        </div>
        <div className="ng-strip left">
          <div className="ng-strip-in" style={{ transform: `translateY(${cur.y}px)` }}>
            <div className="ng-clues ng-rows">
              {clues.rows.map((c, i) => <div key={i} className="ng-clue row end"><ClueList clue={c} /></div>)}
            </div>
          </div>
        </div>
        <div className="ng-view" ref={viewRef}>
          <div className="ng-grid" style={{ transform: `translate(${cur.x}px, ${cur.y}px)` }}>
            {cells.map((v, i) => {
              const r = Math.floor(i / size)
              const c = i % size
              return (
                <button
                  key={i}
                  type="button"
                  data-nosound
                  aria-label={`Fila ${r + 1}, columna ${c + 1}`}
                  className={`ng-cell${v === 1 ? ' on' : ''}${v === 2 ? ' x' : ''}${sepR(c) ? ' sep-r' : ''}${sepB(r) ? ' sep-b' : ''}`}
                  onPointerDown={(e) => down(e, i)}
                  onPointerEnter={() => enter(i)}
                >
                  {v === 2 ? '×' : ''}
                </button>
              )
            })}
          </div>
        </div>
        {both && (
          <>
            <div className="ng-strip right">
              <div className="ng-strip-in" style={{ transform: `translateY(${cur.y}px)` }}>
                <div className="ng-clues ng-rows">
                  {clues.rows.map((c, i) => <div key={i} className="ng-clue row start"><ClueList clue={c} /></div>)}
                </div>
              </div>
            </div>
            <div className="ng-strip bottom">
              <div className="ng-strip-in" style={{ transform: `translateX(${cur.x}px)` }}>
                <div className="ng-clues ng-cols">
                  {clues.cols.map((c, i) => <div key={i} className="ng-clue col start"><ClueList clue={c} /></div>)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="ng-panel">
        <h2>Creación</h2>
        <p className="muted">Pintá la imagen: las pistas se calculan solas. Verificá si el puzzle tiene solución única.</p>
        <p className={`ng-range${pct >= GOOD_MIN && pct <= GOOD_MAX ? ' ok' : ''}`}>
          Pintado recomendado: {GOOD_MIN}–{GOOD_MAX}% · ahora {Math.round(pct)}%
        </p>
        <div className="ng-zoom">
          <strong>Zoom ×{zoom.toFixed(1)}</strong>
          <button className="link" onClick={resetView} disabled={zoom === 1}>Restablecer vista</button>
        </div>
        <p className="ng-zoom-hint">Rueda: acercar y alejar · Rueda apretada y arrastrar: mover</p>
        <button className="btn primary" onClick={verify}>Verificar solución</button>
        <button className="btn ghost" disabled={filled === 0 && cells.every((c) => c === 0)} onClick={() => set(Array(total).fill(0))}>
          Limpiar tablero
        </button>
        {report && (
          <div className={`ng-report ${report.kind}`} role="status">
            {report.kind === 'empty' && <p>Pintá al menos una celda para poder verificar.</p>}
            {report.kind === 'unique' && (
              <>
                <strong>✔ Tiene solución única</strong>
                <p>{report.logic ? 'Se resuelve solo por lógica, sin adivinar.' : 'Es única, pero hay que probar y descartar para llegar: dificultad alta.'}</p>
                <span className="muted">{report.ms} ms</span>
              </>
            )}
            {report.kind === 'multiple' && (
              <>
                <strong>✖ Tiene varias soluciones</strong>
                <p>No sirve como puzzle: hay otra solución que difiere en {report.diff} celdas. Cambiá alguna celda para desambiguar.</p>
                <span className="muted">{report.ms} ms</span>
              </>
            )}
            {report.kind === 'none' && (
              <>
                <strong>✖ No tiene solución</strong>
                <p>Las pistas se contradicen.</p>
              </>
            )}
            {report.kind === 'unknown' && (
              <>
                <strong>? No se pudo decidir</strong>
                <p>Es demasiado complejo para el límite de tiempo.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
