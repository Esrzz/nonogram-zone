import { useEffect, useRef, useState } from 'react'
import { CHAT_MAX, PALETTE } from '../lib/roomProtocol'
import type { ChatMsg, PlayerInfo } from '../lib/roomProtocol'

interface Props {
  messages: ChatMsg[]
  players: PlayerInfo[]
  onSend: (text: string) => void
  /** Más bajo (en la partida) */
  compact?: boolean
}

/** Chat de la sala: mensajes con el color de cada jugador y avisos del sistema. */
export default function Chat({ messages, players, onSend, compact }: Props) {
  const [text, setText] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const colorOf = (id: string | null) => {
    const p = players.find((x) => x.id === id)
    return p ? PALETTE[p.color].hex : undefined
  }

  // Siempre se muestra lo último, salvo que la persona haya subido a leer
  useEffect(() => {
    const el = box.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <section className={`chat${compact ? ' compact' : ''}`} aria-label="Chat de la sala">
      <h3>Chat</h3>
      <div className="chat-log" ref={box} role="log" aria-live="polite">
        {messages.length === 0 && <p className="muted small">Todavía no hay mensajes.</p>}
        {messages.map((m) =>
          m.from === null ? (
            <p key={m.id} className="chat-sys">{m.text}</p>
          ) : (
            <p key={m.id} className="chat-msg">
              <strong style={{ color: colorOf(m.from) }}>{m.name}</strong> {m.text}
            </p>
          ),
        )}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (!t) return
          onSend(t)
          setText('')
        }}
      >
        <input className="input" value={text} maxLength={CHAT_MAX} placeholder="Escribí un mensaje…" onChange={(e) => setText(e.target.value)} aria-label="Mensaje" />
        <button className="btn primary" type="submit" disabled={!text.trim()}>Enviar</button>
      </form>
    </section>
  )
}
