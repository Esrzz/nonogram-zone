import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { filledCount, gridClues } from '../lib/nonogram'
import type { Clue } from '../lib/nonogram'
import { useSettings } from '../lib/settingsStore'

export type Cell = 0 | 1 | 2 // 0 vacío, 1 relleno, 2 marca X

const ZOOM_MIN = 1
const ZOOM_MAX = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Mantiene el contenido ampliado dentro del recuadro visible: el desplazamiento va de (visible - contenido) a 0. */
function clampOff(o: { x: number; y: number }, z: number, w: number, h: number) {
  return { x: clamp(o.x, w - w * z, 0), y: clamp(o.y, h - h * z, 0) }
}

/** Rango de pintado (% de celdas) para que un puzzle creado suela tener solución única. Medido con scripts/density.ts. */
export const GOOD_MIN = 45
export const GOOD_MAX = 65

const sameClues = (a: Clue[], b: Clue[]) => a.length === b.length && a.every((c, i) => c.length === b[i].length && c.every((n, k) => n === b[i][k]))

/** Todo lo que un panel lateral necesita saber del tablero. */
export interface BoardCtx {
  cells: Cell[]
  /** Pistas que se muestran (las del puzzle, o las calculadas del dibujo en creación) */
  clues: { rows: Clue[]; cols: Clue[] }
  /** Pistas calculadas de lo pintado */
  painted: { rows: Clue[]; cols: Clue[] }
  filled: number
  total: number
  pct: number
  /** Solo en modo resolver: lo pintado cumple todas las pistas */
  solved: boolean
  clear: () => void
  /** Reemplaza el dibujo (celdas 0/1) */
  fill: (cells: ArrayLike<number>) => void
  zoomBlock: ReactNode
}

interface Props {
  size: number
  /** Dibujo inicial (celdas 0/1) */
  initialCells?: ArrayLike<number>
  /** Si se pasa, es un puzzle a resolver: las pistas son fijas y no se calculan del dibujo */
  target?: { rows: Clue[]; cols: Clue[] }
  children: (ctx: BoardCtx) => ReactNode
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
 * Tablero de nonogramas, para crear (las pistas salen de lo pintado) o resolver (las pistas son fijas).
 * Clic = rellenar, clic derecho = marca X, arrastrar = pintar.
 * Rueda = zoom; rueda apretada y arrastrar = mover. Las pistas viven en tiras fijas a los costados.
 */
export default function NonogramBoard({ size, initialCells, target, children }: Props) {
  const both = useSettings().gameplay.bothSideClues
  const [cells, setCells] = useState<Cell[]>(() =>
    initialCells ? Array.from(initialCells, (c) => (c === 1 ? 1 : 0) as Cell) : Array<Cell>(size * size).fill(0),
  )
  const paint = useRef<Cell | null>(null)
  const slots = Math.ceil(size / 2)

  // Vista: zoom con la rueda y desplazamiento arrastrando con la rueda apretada (botón central)
  const boardRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [vs, setVs] = useState({ w: 0, h: 0 }) // tamaño del recuadro visible (px de maquetación)
  const [panning, setPanning] = useState(false)
  const pan = useRef<{ id: number; x: number; y: number } | null>(null)
  // Modo mover (como "Move mode" de otros sitios): el clic izquierdo arrastra el tablero en vez de pintar
  const [moveMode, setMoveMode] = useState(false)
  // Trazo en curso: sirve para mostrar cuántas celdas lleva la línea que se está pintando
  const [stroke, setStroke] = useState<{ start: number; cur: number; v: Cell; x: number; y: number } | null>(null)
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
    // Rueda apretada, o clic izquierdo en modo mover
    if (!(e.button === 1 || (moveMode && e.button === 0))) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    pan.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    paint.current = null
    setStroke(null)
    setPanning(true)
  }
  // El desplazamiento se calcula con la diferencia de posición del puntero (no con movementX, que cambia
  // según la escala de pantalla del sistema) y se pasa a píxeles de maquetación: el tablero sigue al mouse 1 a 1.
  const movePan = (e: React.PointerEvent) => {
    const st = pan.current
    if (!st || st.id !== e.pointerId) return
    const k = ratio()
    const { zoom: z, off: o, vs: v } = live.current
    const dx = (e.clientX - st.x) / k
    const dy = (e.clientY - st.y) / k
    st.x = e.clientX
    st.y = e.clientY
    setOff(clampOff({ x: o.x + dx, y: o.y + dy }, z, v.w, v.h))
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

  const painted = useMemo(() => gridClues(cells.map((c) => (c === 1 ? 1 : 0)), size, size), [cells, size])
  const clues = target ?? painted
  const filled = useMemo(() => cells.filter((c) => c === 1).length, [cells])
  const total = size * size
  const goal = target ? Math.max(1, filledCount(target.rows)) : total
  const pct = Math.min(100, (filled / goal) * 100)
  const solved = !!target && filled > 0 && sameClues(painted.rows, target.rows) && sameClues(painted.cols, target.cols)

  const apply = (i: number, v: Cell) => {
    setCells((prev) => (prev[i] === v ? prev : prev.map((c, k) => (k === i ? v : c))))
  }

  const down = (e: React.PointerEvent, i: number) => {
    if (e.button === 1 || moveMode) return // la rueda apretada (o el modo mover) mueve la vista, no pinta
    e.preventDefault()
    const t: Cell = e.button === 2 ? 2 : 1
    const v: Cell = cells[i] === t ? 0 : t
    paint.current = v
    setStroke({ start: i, cur: i, v, x: e.clientX, y: e.clientY })
    apply(i, v)
  }
  const enter = (i: number) => {
    if (paint.current === null) return
    apply(i, paint.current)
    setStroke((st) => (st ? { ...st, cur: i } : st))
  }
  const stop = () => {
    paint.current = null
    setStroke(null)
  }
  const move = (e: React.PointerEvent) => {
    movePan(e)
    if (paint.current !== null) setStroke((st) => (st ? { ...st, x: e.clientX, y: e.clientY } : st))
  }

  // Indicador sobre el mouse: largo de la línea que se está pintando (en la fila o columna del trazo)
  let tip: string | null = null
  if (stroke) {
    const dr = Math.floor(stroke.cur / size) - Math.floor(stroke.start / size)
    const dc = (stroke.cur % size) - (stroke.start % size)
    const horizontal = Math.abs(dc) >= Math.abs(dr)
    const step = horizontal ? 1 : size
    const inLine = (j: number) => (horizontal ? Math.floor(j / size) === Math.floor(stroke.cur / size) : j % size === stroke.cur % size)
    if (stroke.v === 0) {
      const n = Math.max(Math.abs(dr), Math.abs(dc)) + 1
      if (n >= 2) tip = `−${n}`
    } else {
      let n = 1
      for (let j = stroke.cur - step; j >= 0 && inLine(j) && cells[j] === stroke.v; j -= step) n++
      for (let j = stroke.cur + step; j < total && inLine(j) && cells[j] === stroke.v; j += step) n++
      if (n >= 2) tip = `${stroke.v === 2 ? '×' : ''}${n}`
    }
  }

  const sepR = (c: number) => (c + 1) % 5 === 0 && c !== size - 1
  const sepB = (r: number) => (r + 1) % 5 === 0 && r !== size - 1

  const ctx: BoardCtx = {
    cells,
    clues,
    painted,
    filled,
    total,
    pct,
    solved,
    clear: () => setCells(Array<Cell>(total).fill(0)),
    fill: (c) => setCells(Array.from(c, (v) => (v === 1 ? 1 : 0) as Cell)),
    zoomBlock: (
      <>
        <div className="ng-zoom">
          <strong>Zoom ×{zoom.toFixed(1)}</strong>
          <button className="link" onClick={resetView} disabled={zoom === 1}>Restablecer vista</button>
        </div>
        <button type="button" className={`btn ghost ng-move${moveMode ? ' on' : ''}`} aria-pressed={moveMode} onClick={() => setMoveMode((m) => !m)}>
          ✥ Modo mover: {moveMode ? 'activado' : 'apagado'}
        </button>
        <p className="ng-zoom-hint">Rueda: acercar y alejar · Rueda apretada y arrastrar: mover. Con el modo mover, el clic izquierdo también mueve el tablero.</p>
      </>
    ),
  }

  return (
    <div className="ng-layout">
      <div
        className="ng-meter"
        role="progressbar"
        aria-label={target ? 'Celdas pintadas respecto de las que pide el puzzle' : 'Porcentaje pintado del tablero'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span className="ng-meter-pct">{pct >= 100 ? 'Completo' : `${Math.round(pct)}%`}</span>
        <div className={`ng-meter-track${pct >= 100 ? ' full' : ''}`}>
          {!target && (
            <div className="ng-meter-band" style={{ bottom: `${GOOD_MIN}%`, height: `${GOOD_MAX - GOOD_MIN}%` }} title={`Rango recomendado: ${GOOD_MIN}–${GOOD_MAX}%`} />
          )}
          <div className="ng-meter-fill" style={{ height: `${pct}%` }} />
        </div>
        <span className="ng-meter-sub">{filled}/{goal}</span>
      </div>

      <div
        ref={boardRef}
        className={`ng${both ? ' both' : ''}${panning ? ' panning' : ''}${moveMode ? ' move-mode' : ''}${solved ? ' solved' : ''}`}
        style={{ ['--n' as string]: size, ['--slots' as string]: slots, ['--tracks' as string]: size + slots * (both ? 2 : 1), ['--z' as string]: zoom }}
        onPointerDown={startPan}
        onPointerMove={move}
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

      <div className="ng-panel">{children(ctx)}</div>
      {stroke && tip &&
        createPortal(
          <div className="ng-tip" style={{ left: stroke.x / ratio(), top: stroke.y / ratio() }} aria-hidden="true">
            {tip}
          </div>,
          document.body,
        )}
    </div>
  )
}
