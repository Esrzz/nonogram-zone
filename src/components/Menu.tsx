interface Props {
  savedCount: number
  onCreate: () => void
  onSolve: () => void
  onMonthly: () => void
  onWorld: () => void
  monthLabel: string
  onHistory: () => void
  solvedCount: number
}

/** Pantalla que aparece al elegir perfil: crear o resolver nonogramas. */
export default function Menu({ savedCount, onCreate, onSolve, onMonthly, onWorld, monthLabel, onHistory, solvedCount }: Props) {
  return (
    <main className="stage">
      <div className="brandline">
        <div className="brand-top">Gaming Zone</div>
        <h1>Nonogram Zone</h1>
      </div>
      <div className="menu-grid">
        <button className="menu-card" onClick={onCreate}>
          <span className="menu-icon" aria-hidden="true">✎</span>
          <strong>Crear nonogramas</strong>
          <span className="muted">Pintá una imagen, verificá que tenga solución única y guardala en tu perfil.</span>
          <span className="menu-meta">{savedCount === 0 ? 'Sin nonogramas guardados' : `${savedCount} guardado${savedCount === 1 ? '' : 's'}`}</span>
        </button>
        <button className="menu-card" onClick={onSolve}>
          <span className="menu-icon" aria-hidden="true">▦</span>
          <strong>Resolver nonogramas</strong>
          <span className="muted">Te armamos un nonograma al azar, siempre con una única solución.</span>
          <span className="menu-meta">5×5 hasta 25×25</span>
        </button>
        <button className="menu-card" onClick={onMonthly}>
          <span className="menu-icon" aria-hidden="true">▩</span>
          <strong>Mensual 50×50</strong>
          <span className="muted">El nonograma del mes: el mismo para todos, resoluble por lógica.</span>
          <span className="menu-meta">{monthLabel}</span>
        </button>
        <button className="menu-card" onClick={onWorld}>
          <span className="menu-icon" aria-hidden="true">🏁</span>
          <strong>Carrera mundial 150×150</strong>
          <span className="muted">Un tablero gigante, igual para todos. Usá el zoom y llevá la cuenta tachando pistas.</span>
          <span className="menu-meta">Edición 1</span>
        </button>
      </div>
      <button className="btn ghost hist-btn" onClick={onHistory}>
        📜 Mi historial · {solvedCount} resuelto{solvedCount === 1 ? '' : 's'}
      </button>
    </main>
  )
}
