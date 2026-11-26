/** Atajos de teclado: por ahora no hay ninguno definido. Queda la ventana lista para cuando se agreguen. */
export default function HotkeysModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop hk-backdrop" onClick={onClose}>
      <div className="modal hk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Atajos de teclado">
        <div className="modal-header">
          <h2>Atajos de teclado</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">
          <p className="muted">Todavía no hay atajos configurables.</p>
          <div className="hk-actions">
            <span />
            <button className="btn primary" onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    </div>
  )
}
