import { useEffect, useRef, useState } from 'react'
import Lobby from './Lobby'
import RoomGame from './RoomGame'
import { useRoom } from '../lib/roomClient'
import { generatePuzzle } from '../lib/generator'

interface Props {
  code: string
  token: string
  meId: string
  onLeave: () => void
  /** Se completó el nonograma en equipo (ms) */
  onDone: (size: number, ms: number) => void
}

/** Una sala ya abierta: conexión, lobby o partida según la fase. */
export default function RoomScreen({ code, token, meId, onLeave, onDone }: Props) {
  const { room, conn, error, epoch, skew, send, registerCells } = useRoom(code, token)
  const [starting, setStarting] = useState(false)
  const reported = useRef<number | null>(null)

  useEffect(() => {
    if (room?.phase === 'lobby') setStarting(false)
    const g = room?.game
    if (room?.phase === 'done' && g?.doneAt && reported.current !== g.startedAt) {
      reported.current = g.startedAt
      onDone(g.size, g.doneAt - g.startedAt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.game?.doneAt])

  const start = () => {
    if (!room) return
    setStarting(true)
    // Se deja pintar el aviso antes de generar (en 50×50 puede tardar un momento)
    setTimeout(() => {
      const p = generatePuzzle(room.config.size)
      send({ t: 'start', solution: Array.from(p.solution, (v) => (v ? '1' : '0')).join('') })
    }, 30)
  }

  if (conn === 'closed' || (!room && error)) {
    return (
      <main className="stage">
        <div className="card multi-home">
          <h2>No se pudo entrar a la sala</h2>
          <p className="err" role="alert">{error?.msg ?? 'La conexión se cerró.'}</p>
          <button className="btn primary" onClick={onLeave}>Volver</button>
        </div>
      </main>
    )
  }
  if (!room) {
    return (
      <main className="stage">
        <div className="card multi-home"><p className="muted">Conectando con la sala {code}…</p></div>
      </main>
    )
  }
  return (
    <>
      {conn !== 'open' && <div className="conn-banner" role="status">Reconectando…</div>}
      {error && <div className="conn-banner err" role="alert">{error.msg}</div>}
      {room.phase === 'lobby' || !room.game ? (
        <Lobby room={room} meId={meId} send={send} onStart={start} starting={starting} onLeave={onLeave} />
      ) : (
        <RoomGame room={room} meId={meId} epoch={epoch} skew={skew} send={send} register={registerCells} onLeave={onLeave} />
      )}
    </>
  )
}
