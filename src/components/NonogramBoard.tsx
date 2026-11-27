import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { filledCount, gridClues } from '../lib/nonogram'
import type { Clue } from '../lib/nonogram'
import { useSettings } from '../lib/settingsStore'

export type Cell = 0 | 1 | 2 // 0 vacío, 1 relleno, 2 marca X

const ZOOM_MIN = 1

/** Tableros grandes (más de 25): celdas diminutas, pistas con tamaño propio y dibujo más liviano */
export const BIG_FROM = 25
const zoomMaxFor = (size: number) => (size > 50 ? 16 : size > BIG_FROM ? 10 : 8)

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

interface LineProps {
  clue: number[]
  /** Una letra por número: '1' si está tachado */
  mask: string
  axis: 'r' | 'c'
  idx: number
  side: 'end' | 'start'
  onToggle?: (axis: 'r' | 'c', idx: number, k: number) => void
}

/** Pistas de una fila o columna. Con `onToggle`, tocar un número lo tacha o lo destacha. */
const ClueLine = memo(function ClueLine({ clue, mask, axis, idx, side, onToggle }: LineProps) {
  return (
    <div className={`ng-clue ${axis === 'r' ? 'row' : 'col'} ${side}`}>
      {clue.length === 0 ? (
        <span className="cn zero">0</span>
      ) : (
        clue.map((n, k) => (
          <span
            key={k}
            className={`cn${mask[k] === '1' ? ' struck' : ''}${onToggle ? ' tap' : ''}`}
            onClick={onToggle ? () => onToggle(axis, idx, k) : undefined}
          >
            {n}
          </span>
        ))
      )}
    </div>
  )
})

/**
 * Todas las celdas. El marcado se arma una sola vez; cuando cambian las celdas solo se tocan en el DOM las que cambiaron
 * (con 22 500 celdas, volver a dibujarlas todas con React tardaba cientos de milisegundos por trazo).
 */
const Grid = memo(function Grid({ cells, size, gridRef }: { cells: Cell[]; size: number; gridRef: React.RefObject<HTMLDivElement | null> }) {
  const first = useRef(cells)
  const prev = useRef<Cell[]>(cells)
  const markup = useMemo(() => {
    const init = first.current
    const out = new Array<React.ReactNode>(init.length)
    for (let i = 0; i < init.length; i++) {
      const v = init[i]
      const r = (i / size) | 0
      const c = i - r * size
      const sr = (c + 1) % 5 === 0 && c !== size - 1
      const sb = (r + 1) % 5 === 0 && r !== size - 1
      out[i] = (
        <div key={i} data-i={i} className={`ng-cell${v === 1 ? ' on' : ''}${v === 2 ? ' x' : ''}${sr ? ' sep-r' : ''}${sb ? ' sep-b' : ''}`}>
          {v === 2 ? '×' : ''}
        </div>
      )
    }
    return out
  }, [size])
  useLayoutEffect(() => {
    const el = gridRef.current
    const p = prev.current
    if (!el || p === cells) return
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i]
      if (p[i] === v) continue
      const d = el.children[i] as HTMLElement
      d.classList.toggle('on', v === 1)
      d.classList.toggle('x', v === 2)
      d.textContent = v === 2 ? '×' : ''
    }
    prev.current = cells
  }, [cells, gridRef])
  return <>{markup}</>
})

/**
 * Tablero de nonogramas, para crear (las pistas salen de lo pintado) o resolver (las pistas son fijas).
 * Clic = rellenar, clic derecho = marca X, arrastrar = pintar.
 * Rueda = zoom; rueda apretada y arrastrar = mover. Las pistas viven en tiras fijas a los costados.
 */
export default function NonogramBoard({ size, initialCells, target, children }: Props) {
  const { bothSideClues: both, autoStrike } = useSettings().gameplay
  const zoomMax = zoomMaxFor(size)
  const big = size > BIG_FROM
  const [cells, setCells] = useState<Cell[]>(() =>
    initialCells ? Array.from(initialCells, (c) => (c === 1 ? 1 : 0) as Cell) : Array<Cell>(size * size).fill(0),
  )
  const paint = useRef<Cell | null>(null)

  // Vista: zoom con la rueda y desplazamiento arrastrando con la rueda apretada (botón central)
  const boardRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
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
      const nz = clamp(z * Math.exp(-dy * 0.0015), ZOOM_MIN, zoomMax)
      if (nz === z) return
      const wx = (px - o.x) / z
      const wy = (py - o.y) / z
      setZoom(nz)
      setOff(clampOff({ x: px - wx * nz, y: py - wy * nz }, nz, v.w, v.h))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomMax])

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

  // Espacios para pistas: en un puzzle, lo que pide la pista más larga; al crear, el máximo posible
  const slots = target ? Math.max(1, ...target.rows.map((c) => c.length), ...target.cols.map((c) => c.length)) : Math.ceil(size / 2)

  // Pistas tachadas. `manual`: las que tachó la persona. Con el tachado automático, una línea completa (lo pintado coincide
  // con sus pistas) se tacha sola; `autoOff` guarda las que la persona destachó a pesar de eso. Si la línea deja de cumplirse,
  // se destachan solas las automáticas (y se olvidan los destachados) pero las manuales quedan.
  const [manual, setManual] = useState<Set<string>>(() => new Set())
  const [autoOff, setAutoOff] = useState<Set<string>>(() => new Set())
  const lineDone = (axis: 'r' | 'c', i: number) => {
    if (!autoStrike || !target) return false
    const want = axis === 'r' ? clues.rows[i] : clues.cols[i]
    const got = axis === 'r' ? painted.rows[i] : painted.cols[i]
    return want.length > 0 && sameClues([got], [want])
  }
  const isStruck = (axis: 'r' | 'c', i: number, k: number) => {
    const key = `${axis}${i}:${k}`
    return manual.has(key) || (lineDone(axis, i) && !autoOff.has(key))
  }
  const toggleStrike = (axis: 'r' | 'c', i: number, k: number) => {
    const key = `${axis}${i}:${k}`
    const edit = (set: Set<string>, fn: (n: Set<string>) => void) => {
      const n = new Set(set)
      fn(n)
      return n
    }
    if (isStruck(axis, i, k)) {
      setManual((m) => edit(m, (n) => n.delete(key)))
      if (lineDone(axis, i)) setAutoOff((o) => edit(o, (n) => n.add(key)))
    } else {
      setManual((m) => edit(m, (n) => n.add(key)))
      setAutoOff((o) => (o.has(key) ? edit(o, (n) => n.delete(key)) : o))
    }
  }
  // Una línea que deja de estar completa olvida sus "destachados"
  useEffect(() => {
    if (autoOff.size === 0) return
    const keep = new Set([...autoOff].filter((k) => lineDone(k[0] as 'r' | 'c', Number(k.slice(1).split(':')[0]))))
    if (keep.size !== autoOff.size) setAutoOff(keep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painted, autoStrike])
  const maskFor = (axis: 'r' | 'c', idx: number, clue: number[]) =>
    clue.map((_, k) => (isStruck(axis, idx, k) ? '1' : '0')).join('')
  // Función estable (por ref) para que las pistas no se redibujen todas en cada cambio
  const toggleRef = useRef(toggleStrike)
  toggleRef.current = toggleStrike
  const stableToggle = useCallback((axis: 'r' | 'c', i: number, k: number) => toggleRef.current(axis, i, k), [])
  const strike = target ? stableToggle : undefined
  const rowLines = (side: 'end' | 'start') =>
    clues.rows.map((c, i) => <ClueLine key={i} clue={c} axis="r" idx={i} side={side} mask={maskFor('r', i, c)} onToggle={strike} />)
  const colLines = (side: 'end' | 'start') =>
    clues.cols.map((c, i) => <ClueLine key={i} clue={c} axis="c" idx={i} side={side} mask={maskFor('c', i, c)} onToggle={strike} />)

  const apply = (i: number, v: Cell) => {
    setCells((prev) => {
      if (prev[i] === v) return prev
      const next = prev.slice()
      next[i] = v
      return next
    })
  }
  const cellAt = (e: React.PointerEvent) => {
    const i = (e.target as HTMLElement).dataset?.i
    return i === undefined ? null : Number(i)
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

  const cellPx = vs.w && size ? (vs.w / size) * zoom : 0 // tamaño real de una celda en pantalla

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
        className={`ng${big ? ' big' : ''}${big && cellPx < 7 ? ' tiny' : ''}${both ? ' both' : ''}${panning ? ' panning' : ''}${moveMode ? ' move-mode' : ''}${solved ? ' solved' : ''}`}
        style={{ ['--n' as string]: size, ['--slots' as string]: slots, ['--tracks' as string]: size + slots * (both ? 2 : 1), ['--sides' as string]: both ? 2 : 1, ['--z' as string]: zoom }}
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
              {colLines('end')}
            </div>
          </div>
        </div>
        <div className="ng-strip left">
          <div className="ng-strip-in" style={{ transform: `translateY(${cur.y}px)` }}>
            <div className="ng-clues ng-rows">
              {rowLines('end')}
            </div>
          </div>
        </div>
        <div className="ng-view" ref={viewRef}>
          <div
            ref={gridRef}
            className="ng-grid"
            style={{ transform: `translate(${cur.x}px, ${cur.y}px)` }}
            onPointerDown={(e) => {
              const i = cellAt(e)
              if (i !== null) down(e, i)
            }}
            onPointerOver={(e) => {
              const i = cellAt(e)
              if (i !== null) enter(i)
            }}
          >
            <Grid cells={cells} size={size} gridRef={gridRef} />
          </div>
        </div>
        {both && (
          <>
            <div className="ng-strip right">
              <div className="ng-strip-in" style={{ transform: `translateY(${cur.y}px)` }}>
                <div className="ng-clues ng-rows">
                  {rowLines('start')}
                </div>
              </div>
            </div>
            <div className="ng-strip bottom">
              <div className="ng-strip-in" style={{ transform: `translateX(${cur.x}px)` }}>
                <div className="ng-clues ng-cols">
                  {colLines('start')}
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
