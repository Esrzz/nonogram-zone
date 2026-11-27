import { useState } from 'react'
import { bestBySize } from '../lib/history'
import type { HistoryEntry } from '../lib/history'

interface Props {
  name: string
  list: HistoryEntry[]
  onClear: () => void
}

export const fmtTime = (ms: number) => {
  if (ms <= 0) return '—'
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Historial de nonogramas resueltos del perfil, con el mejor tiempo por tamaño. */
export default function HistoryPanel({ name, list, onClear }: Props) {
  const [confirm, setConfirm] = useState(false)
  const best = bestBySize(list)
  return (
    <main className="stage hist-stage">
      <div className="hist card">
        <h2>Historial de {name}</h2>
        {list.length === 0 ? (
          <p className="muted">Todavía no resolviste ningún nonograma. Los que resuelvas sin mostrar la solución quedan anotados acá.</p>
        ) : (
          <>
            <p className="muted">{list.length} resuelto{list.length === 1 ? '' : 's'}</p>
            <div className="hist-best" aria-label="Mejor tiempo por tamaño">
              {best.map((b) => (
                <div key={b.size} className="hist-chip">
                  <strong>{b.size}×{b.size}</strong>
                  <span>{fmtTime(b.ms === Infinity ? 0 : b.ms)}</span>
                  <small>{b.count} resuelto{b.count === 1 ? '' : 's'}</small>
                </div>
              ))}
            </div>
            <ul className="hist-list">
              {list.map((h) => (
                <li key={h.id}>
                  <div>
                    <strong>{h.label}</strong>
                    <span className="muted small"> · {h.size}×{h.size}</span>
                    <div className="muted small">{fmtDate(h.at)}</div>
                  </div>
                  <span className="hist-time">⏱ {fmtTime(h.ms)}</span>
                </li>
              ))}
            </ul>
            {confirm ? (
              <div className="hist-confirm">
                <span>¿Borrar todo el historial?</span>
                <button className="btn ghost" onClick={() => { onClear(); setConfirm(false) }}>Sí, borrar</button>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="link" onClick={() => setConfirm(true)}>Borrar historial</button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
