import { useEffect, useState } from 'react'
import { keyBinding, mouseBinding, bindingLabel } from '../lib/hotkeys'
import { DEFAULT_HOTKEYS, HOTKEY_ACTIONS } from '../lib/settings'
import type { HotkeyAction } from '../lib/settings'
import { updateSettings } from '../lib/settingsStore'
import { useSettings } from '../lib/settingsStore'

/** Atajos de teclado y de botones extra del mouse: se elige la acción, se toca "Cambiar" y se aprieta la tecla o el botón. */
export default function HotkeysModal({ onClose }: { onClose: () => void }) {
  const { hotkeys, hotkeysEnabled } = useSettings().gameplay
  const [listening, setListening] = useState<HotkeyAction | null>(null)

  useEffect(() => {
    if (!listening) return
    const set = (b: string) => {
      updateSettings((s) => { s.gameplay.hotkeys[listening] = b })
      setListening(null)
    }
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') return setListening(null)
      const b = keyBinding(e)
      if (b) set(b)
    }
    const onMouse = (e: MouseEvent) => {
      const b = mouseBinding(e)
      if (!b) return // izquierdo, rueda y derecho no se pueden asignar
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'mousedown') set(b)
    }
    window.addEventListener('keydown', onKey, true)
    for (const t of ['mousedown', 'mouseup', 'auxclick'] as const) window.addEventListener(t, onMouse, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      for (const t of ['mousedown', 'mouseup', 'auxclick'] as const) window.removeEventListener(t, onMouse, true)
    }
  }, [listening])

  return (
    <div className="modal-backdrop hk-backdrop" onClick={onClose}>
      <div className="modal hk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Atajos de teclado">
        <div className="modal-header">
          <h2>Atajos</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">
          {!hotkeysEnabled && <p className="err">Los atajos están desactivados en Jugabilidad.</p>}
          <p className="muted small">Podés usar una tecla (con Ctrl, Shift o Alt) o un botón extra del mouse. Esc cancela.</p>
          {HOTKEY_ACTIONS.map((a) => (
            <div key={a.id} className="hk-row">
              <div>
                <strong>{a.label}</strong>
                <p className="muted small">{a.hint}</p>
              </div>
              <button type="button" className={`btn ${listening === a.id ? 'primary' : 'ghost'}`} onClick={() => setListening(listening === a.id ? null : a.id)}>
                {listening === a.id ? 'Apretá una tecla o botón…' : bindingLabel(hotkeys[a.id])}
              </button>
              <button type="button" className="link" disabled={hotkeys[a.id] === DEFAULT_HOTKEYS[a.id]} onClick={() => updateSettings((s) => { s.gameplay.hotkeys[a.id] = DEFAULT_HOTKEYS[a.id] })}>
                Restablecer
              </button>
            </div>
          ))}
          <div className="hk-actions">
            <span />
            <button className="btn primary" onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    </div>
  )
}
