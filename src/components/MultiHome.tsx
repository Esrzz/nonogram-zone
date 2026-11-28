import { useState } from 'react'
import { CODE_LEN, normalizeCode } from '../lib/roomProtocol'

interface Props {
  /** Sin sesión no se puede jugar en sala */
  hasSession: boolean
  busy: boolean
  error: string | null
  initialCode?: string
  onCreate: () => void
  onJoin: (code: string) => void
}

/** Entrada al multijugador: crear una sala o unirse con un código. */
export default function MultiHome({ hasSession, busy, error, initialCode = '', onCreate, onJoin }: Props) {
  const [code, setCode] = useState(initialCode)
  return (
    <main className="stage">
      <div className="card multi-home">
        <h2>Multijugador</h2>
        {!hasSession && (
          <p className="err" role="alert">
            Para jugar en sala necesitás iniciar sesión (con Discord o con la contraseña de tu perfil). Tocá "Cambiar perfil" para entrar.
          </p>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary" disabled={!hasSession || busy} onClick={onCreate}>
          {busy ? 'Creando…' : 'Crear sala'}
        </button>
        <div className="or"><span>o unite a una</span></div>
        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === CODE_LEN) onJoin(code)
          }}
        >
          <input
            className="input code-input"
            value={code}
            maxLength={CODE_LEN}
            placeholder="CÓDIGO"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            aria-label="Código de la sala"
          />
          <button className="btn ghost" type="submit" disabled={!hasSession || busy || code.length !== CODE_LEN}>Unirme</button>
        </form>
      </div>
    </main>
  )
}
