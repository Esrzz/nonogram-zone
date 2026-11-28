import { useState } from 'react'
import { solve } from '../lib/nonogram'
import type { SolveResult } from '../lib/nonogram'
import { cellsToString } from '../lib/saved'
import { encodeSeed } from '../lib/seed'
import type { SavedNonogram } from '../lib/saved'
import { GOOD_MAX, GOOD_MIN } from './NonogramBoard'
import type { BoardCtx } from './NonogramBoard'

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

interface Props {
  ctx: BoardCtx
  size: number
  saved: SavedNonogram[]
  /** Guarda el dibujo actual en el perfil. Devuelve false si no se pudo. */
  onSave: (item: Omit<SavedNonogram, 'id' | 'createdAt'>) => boolean
  onLoad: (item: SavedNonogram) => void
  onPlay: (item: SavedNonogram) => void
  onDelete: (id: string) => void
}

/** Panel del modo crear: verificar solución, guardar en el perfil y lista de nonogramas guardados. */
export default function CreatePanel({ ctx, size, saved, onSave, onLoad, onPlay, onDelete }: Props) {
  const { filled, pct, painted, cells } = ctx
  // El resultado solo vale mientras el dibujo no cambie
  const [shown, setShown] = useState<{ cells: BoardCtx['cells']; report: Report } | null>(null)
  const report = shown && shown.cells === cells ? shown.report : null
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const seed = filled > 0 ? encodeSeed(cells, size) : ''
  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(seed)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* sin permiso: se puede copiar a mano del cuadro */
    }
  }

  const verify = () => {
    const t0 = performance.now()
    const r = solve(painted.rows, painted.cols)
    const rep = describe(r, Math.round(performance.now() - t0), filled)
    setShown({ cells, report: rep })
    return r
  }

  const save = () => {
    const r = solve(painted.rows, painted.cols)
    const finalName = name.trim() || `Nonograma ${saved.length + 1}`
    const ok = onSave({
      name: finalName.slice(0, 30),
      size,
      cells: cellsToString(cells),
      unique: !r.aborted && r.count === 1,
      logic: !r.aborted && r.count === 1 && r.logicOnly,
    })
    setMsg(ok ? { ok: true, text: `Guardado en tu perfil: ${finalName.slice(0, 30)}` } : { ok: false, text: 'No se pudo guardar (almacenamiento lleno o bloqueado).' })
    if (ok) setName('')
  }

  return (
    <>
      <h2>Crear</h2>
      <p className="muted">Pintá la imagen: las pistas se calculan solas. Verificá que tenga solución única y guardala.</p>
      <p className={`ng-range${pct >= GOOD_MIN && pct <= GOOD_MAX ? ' ok' : ''}`}>
        Pintado recomendado: {GOOD_MIN}–{GOOD_MAX}% · ahora {Math.round(pct)}%
      </p>
      {ctx.zoomBlock}
      <button className="btn primary" onClick={verify}>Verificar solución</button>
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
      <button className="btn ghost" disabled={filled === 0 && cells.every((c) => c === 0)} onClick={ctx.clear}>
        Limpiar tablero
      </button>

      <div className="ng-sep" />
      <h3>Semilla para compartir</h3>
      <p className="muted small">Pasásela a otra persona: en Resolver nonogramas puede pegarla en "Cargar semilla" y jugar tu dibujo.</p>
      <div className="save-row">
        <input className="input sm seed-input" readOnly value={seed} placeholder="Pintá algo para ver la semilla" onFocus={(e) => e.currentTarget.select()} aria-label="Semilla del nonograma" />
        <button className="btn ghost" disabled={!seed} onClick={copySeed}>{copied ? '¡Copiada!' : 'Copiar'}</button>
      </div>

      <div className="ng-sep" />
      <h3>Guardar en mi perfil</h3>
      <div className="save-row">
        <input
          className="input sm"
          maxLength={30}
          placeholder="Nombre del nonograma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && filled > 0) save() }}
          aria-label="Nombre del nonograma"
        />
        <button className="btn primary" disabled={filled === 0} onClick={save}>Guardar</button>
      </div>
      {msg && <p className={msg.ok ? 'hint' : 'err'} role="status">{msg.text}</p>}

      <h3>Mis nonogramas ({saved.length})</h3>
      {saved.length === 0 ? (
        <p className="muted small">Todavía no guardaste ninguno.</p>
      ) : (
        <ul className="saved-list">
          {saved.map((s) => (
            <li key={s.id}>
              <div className="saved-info">
                <strong>{s.name}</strong>
                <span className={`badge ${s.unique ? 'ok' : 'warn'}`}>{s.unique ? (s.logic ? 'única · lógica' : 'única') : 'sin verificar / ambigua'}</span>
                <span className="muted small">{s.size}×{s.size}</span>
              </div>
              <div className="saved-actions">
                <button className="link" onClick={() => onLoad(s)}>Editar</button>
                <button className="link" onClick={() => onPlay(s)}>Resolver</button>
                <button className="link danger" onClick={() => onDelete(s.id)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
