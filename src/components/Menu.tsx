interface Props {
  savedCount: number
  onCreate: () => void
  onSolve: () => void
}

/** Pantalla que aparece al elegir perfil: crear o resolver nonogramas. */
export default function Menu({ savedCount, onCreate, onSolve }: Props) {
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
          <span className="menu-meta">5×5 · 10×10 · 15×15</span>
        </button>
      </div>
    </main>
  )
}
