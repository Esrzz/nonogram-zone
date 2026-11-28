import { useEffect, useMemo, useState } from 'react'
import Chat from './Chat'
import NonogramBoard from './NonogramBoard'
import { PALETTE } from '../lib/roomProtocol'
import type { ClientMsg, RoomSnapshot } from '../lib/roomProtocol'

interface Props {
  room: RoomSnapshot
  meId: string
  epoch: number
  skew: number
  send: (m: ClientMsg) => void
  register: (fn: (c: [number, number, number][]) => void) => void
  onLeave: () => void
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Partida cooperativa: tablero compartido a la izquierda; jugadores, cronómetro y chat a la derecha. */
export default function RoomGame({ room, meId, epoch, skew, send, register, onLeave }: Props) {
  const game = room.game!
  const isHost = room.hostId === meId
  const me = room.players.find((p) => p.id === meId)
  const done = room.phase === 'done'
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (done) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [done])

  // El estado inicial del tablero se toma al montar (y al reconectar, con `epoch`)
  const initial = useMemo(() => Array.from(game.cells, (c) => Number(c) || 0), [epoch, game.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const owners = useMemo(() => game.owners, [epoch, game.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const palette = useMemo(() => PALETTE.map((c) => c.hex), [])
  const elapsed = (done && game.doneAt ? game.doneAt : now + skew) - game.startedAt

  return (
    <main className="stage play">
      <NonogramBoard
        key={`${epoch}-${game.startedAt}`}
        size={game.size}
        initialCells={initial}
        target={{ rows: game.rows, cols: game.cols }}
        shared={{
          palette,
          me: (me?.color ?? 0) + 1,
          initialOwners: owners,
          onPaint: (c) => send({ t: 'paint', c }),
          register,
        }}
      >
        {() => (
          <div className="room-side">
            <div className="card room-info">
              <strong>Sala {room.code}</strong>
              <span className="timer">{fmt(elapsed)}</span>
              <ul className="players compact">
                {room.players.map((p) => (
                  <li key={p.id} className={p.connected ? '' : 'off'}>
                    <span className="dot" style={{ background: PALETTE[p.color].hex }} />
                    {p.name}
                  </li>
                ))}
              </ul>
              {done && <p className="ok" role="status">¡Lo completaron juntos en {fmt(elapsed)}!</p>}
              <div className="lobby-actions">
                {done && isHost && <button className="btn primary" onClick={() => send({ t: 'back' })}>Volver al lobby</button>}
                {done && !isHost && <p className="muted small">El host puede volver al lobby.</p>}
                <button className="btn ghost" onClick={onLeave}>Salir</button>
              </div>
            </div>
            <Chat compact messages={room.chat} players={room.players} onSend={(text) => send({ t: 'chat', text })} />
          </div>
        )}
      </NonogramBoard>
    </main>
  )
}
