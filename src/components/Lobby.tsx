import { useState } from 'react'
import Chat from './Chat'
import { PALETTE, PLAYERS_MAX, PLAYERS_MIN, ROOM_MODES, ROOM_SIZES } from '../lib/roomProtocol'
import type { ClientMsg, RoomSnapshot } from '../lib/roomProtocol'

interface Props {
  room: RoomSnapshot
  meId: string
  send: (m: ClientMsg) => void
  onStart: () => void
  starting: boolean
  onLeave: () => void
}

/** Lobby de la sala: el host configura modo y tamaño, cada uno elige su color, y el chat queda a la derecha. */
export default function Lobby({ room, meId, send, onStart, starting, onLeave }: Props) {
  const isHost = room.hostId === meId
  const me = room.players.find((p) => p.id === meId)
  const taken = new Set(room.players.filter((p) => p.id !== meId).map((p) => p.color))
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* se copia a mano */
    }
  }
  const mode = ROOM_MODES.find((m) => m.id === room.config.mode)

  return (
    <main className="stage">
      <div className="lobby">
        <div className="card lobby-main">
          <div className="lobby-head">
            <div>
              <span className="muted small">Código de la sala</span>
              <div className="room-code">{room.code}</div>
            </div>
            <button className="btn ghost" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar código'}</button>
          </div>

          <h3>Configuración {isHost ? '' : '(la define el host)'}</h3>
          <label className="field">
            <span>Modo</span>
            <select className="input" disabled={!isHost} value={room.config.mode} onChange={(e) => send({ t: 'config', config: { mode: e.target.value as 'coop' } })}>
              {ROOM_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <span className="muted small">{mode?.hint}</span>
          </label>
          <label className="field">
            <span>Tamaño del nonograma</span>
            <select className="input" disabled={!isHost} value={room.config.size} onChange={(e) => send({ t: 'config', config: { size: Number(e.target.value) } })}>
              {ROOM_SIZES.map((s) => <option key={s} value={s}>{s}×{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Jugadores (máximo)</span>
            <select className="input" disabled={!isHost} value={room.config.maxPlayers} onChange={(e) => send({ t: 'config', config: { maxPlayers: Number(e.target.value) } })}>
              {Array.from({ length: PLAYERS_MAX - PLAYERS_MIN + 1 }, (_, i) => PLAYERS_MIN + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <h3>Tu color</h3>
          <div className="palette" role="radiogroup" aria-label="Tu color">
            {PALETTE.map((c, i) => (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={me?.color === i}
                aria-label={c.name}
                title={taken.has(i) ? `${c.name} (ocupado)` : c.name}
                disabled={taken.has(i)}
                className={`swatch${me?.color === i ? ' on' : ''}`}
                style={{ background: c.hex }}
                onClick={() => send({ t: 'color', color: i })}
              />
            ))}
          </div>

          <h3>Jugadores ({room.players.length}/{room.config.maxPlayers})</h3>
          <ul className="players">
            {room.players.map((p) => (
              <li key={p.id} className={p.connected ? '' : 'off'}>
                <span className="dot" style={{ background: PALETTE[p.color].hex }} />
                {p.name}
                {p.id === room.hostId && <em> · host</em>}
                {p.id === meId && <em> · vos</em>}
                {!p.connected && <em> · desconectado</em>}
              </li>
            ))}
          </ul>

          <div className="lobby-actions">
            {isHost ? (
              <button className="btn primary" disabled={starting} onClick={onStart}>
                {starting ? 'Preparando nonograma…' : 'Iniciar partida'}
              </button>
            ) : (
              <p className="muted">Esperando que el host inicie la partida…</p>
            )}
            <button className="btn ghost" onClick={onLeave}>Salir de la sala</button>
          </div>
        </div>
        <Chat messages={room.chat} players={room.players} onSend={(text) => send({ t: 'chat', text })} />
      </div>
    </main>
  )
}
