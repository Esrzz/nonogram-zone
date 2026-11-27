import { useState } from 'react'
import { PW_MAX, PW_MIN, pwSet, validPassword } from '../lib/password'

interface Props {
  /** create: primera vez con Discord (obligatoria). change: cambiar la que ya existe. */
  mode: 'create' | 'change'
  token: string
  onDone: () => void
  /** create: cerrar sesión; change: cerrar la ventana */
  onCancel: () => void
  /** La sesión venció: hay que volver a entrar */
  onSessionLost: () => void
}

/** Crear o cambiar la contraseña del perfil. */
export default function PasswordModal({ mode, token, onDone, onCancel, onSessionLost }: Props) {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validPassword(pw)) return setError(`Usá entre ${PW_MIN} y ${PW_MAX} caracteres.`)
    if (pw !== pw2) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    setError(null)
    const r = await pwSet(token, pw, mode === 'change' ? current : undefined)
    setBusy(false)
    if (r === 'ok') return onDone()
    if (r === 'session') return onSessionLost()
    setError(
      r === 'wrong' ? 'La contraseña actual no es correcta.'
        : r === 'locked' ? 'Demasiados intentos. Probá de nuevo en 15 minutos.'
        : r === 'invalid' ? `Usá entre ${PW_MIN} y ${PW_MAX} caracteres.`
        : 'No se pudo guardar ahora. Probá de nuevo en un rato.',
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onSubmit={submit}>
        <div className="pw-body">
          <h2 id="pw-title">{mode === 'create' ? 'Creá una contraseña para tu perfil' : 'Cambiar contraseña'}</h2>
          {mode === 'create' && (
            <p className="muted">
              Así nadie puede entrar como vos solo escribiendo tu nombre. Con Discord seguís entrando sin contraseña; se la
              piden a quien entre con el nombre nada más.
            </p>
          )}
          {mode === 'change' && (
            <input className="input" type="password" autoComplete="current-password" placeholder="Contraseña actual" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="Contraseña actual" autoFocus />
          )}
          <input className="input" type="password" autoComplete="new-password" placeholder={`Contraseña nueva (mínimo ${PW_MIN})`} maxLength={PW_MAX} value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Contraseña nueva" autoFocus={mode === 'create'} />
          <input className="input" type="password" autoComplete="new-password" placeholder="Repetila" maxLength={PW_MAX} value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Repetir contraseña" />
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy || !pw || !pw2 || (mode === 'change' && !current)}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          <button type="button" className="link" onClick={onCancel}>
            {mode === 'create' ? 'Cerrar sesión' : 'Cancelar'}
          </button>
        </div>
      </form>
    </div>
  )
}
