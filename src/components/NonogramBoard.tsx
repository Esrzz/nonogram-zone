import { useRef, useState } from 'react'

type Cell = 0 | 1 | 2 // 0 vacío, 1 relleno, 2 marca X

interface Props {
  size?: number
}

/** Tablero vacío para ir ajustando estilos. Clic = rellenar, clic derecho = marcar X, arrastrar = pintar. */
export default function NonogramBoard({ size = 10 }: Props) {
  const [cells, setCells] = useState<Cell[]>(() => Array(size * size).fill(0))
  const paint = useRef<Cell | null>(null)
  const clueSlots = Math.ceil(size / 2)

  const apply = (i: number, v: Cell) =>
    setCells((prev) => (prev[i] === v ? prev : prev.map((c, k) => (k === i ? v : c))))

  const down = (e: React.PointerEvent, i: number) => {
    e.preventDefault()
    const target: Cell = e.button === 2 ? 2 : 1
    const v: Cell = cells[i] === target ? 0 : target
    paint.current = v
    apply(i, v)
  }

  const enter = (i: number) => {
    if (paint.current !== null) apply(i, paint.current)
  }

  const stop = () => {
    paint.current = null
  }

  const mark = (i: number) => (i + 1) % 5 === 0 && (i + 1) % size !== 0

  return (
    <div
      className="ng"
      style={{ ['--n' as string]: size, ['--slots' as string]: clueSlots }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ng-corner" />
      <div className="ng-clues ng-cols">
        {Array.from({ length: size }, (_, c) => (
          <div key={c} className="ng-clue" />
        ))}
      </div>
      <div className="ng-clues ng-rows">
        {Array.from({ length: size }, (_, r) => (
          <div key={r} className="ng-clue" />
        ))}
      </div>
      <div className="ng-grid">
        {cells.map((v, i) => (
          <button
            key={i}
            type="button"
            data-nosound
            aria-label={`Fila ${Math.floor(i / size) + 1}, columna ${(i % size) + 1}`}
            className={`ng-cell${v === 1 ? ' on' : ''}${v === 2 ? ' x' : ''}${mark(i) ? ' sep-r' : ''}${
              Math.floor(i / size) % 5 === 4 && Math.floor(i / size) !== size - 1 ? ' sep-b' : ''
            }`}
            onPointerDown={(e) => down(e, i)}
            onPointerEnter={() => enter(i)}
          >
            {v === 2 ? '×' : ''}
          </button>
        ))}
      </div>
    </div>
  )
}
