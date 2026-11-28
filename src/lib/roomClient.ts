import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMsg, ClientMsg, RoomSnapshot, ServerError, ServerMsg } from './roomProtocol'

/** Dirección del servidor de salas (carpeta `server/`). Se puede cambiar con VITE_ROOMS_URL al compilar. */
export const ROOMS_URL = ((import.meta.env.VITE_ROOMS_URL as string | undefined) ?? 'https://nonogram-rooms.gamingzone.workers.dev').replace(/\/+$/, '')

export async function createRoom(token: string): Promise<{ code: string } | { error: string }> {
  try {
    const res = await fetch(`${ROOMS_URL}/rooms`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) return { error: 'Tu sesión venció. Iniciá sesión de nuevo.' }
    if (!res.ok) return { error: 'No se pudo crear la sala. Probá de nuevo en un rato.' }
    return (await res.json()) as { code: string }
  } catch {
    return { error: 'No se pudo conectar con el servidor de salas.' }
  }
}

export type Conn = 'connecting' | 'open' | 'closed'
export interface RoomError {
  code: ServerError | 'offline'
  msg: string
}

const FATAL: ServerError[] = ['no-room', 'full', 'started', 'auth']

/**
 * Conexión a una sala: mantiene el estado, reconecta sola y entrega los cambios de celdas a quien los registre.
 * `epoch` sube cada vez que se vuelve a conectar (el tablero se recrea con el estado completo).
 */
export function useRoom(code: string, token: string) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [conn, setConn] = useState<Conn>('connecting')
  const [error, setError] = useState<RoomError | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [skew, setSkew] = useState(0) // hora del servidor - hora de este equipo
  const wsRef = useRef<WebSocket | null>(null)
  const onCells = useRef<((c: [number, number, number][]) => void) | null>(null)

  useEffect(() => {
    let stop = false
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined
    let opened = 0

    const connect = () => {
      setConn('connecting')
      const ws = new WebSocket(`${ROOMS_URL.replace(/^http/, 'ws')}/rooms/${code}/ws`)
      wsRef.current = ws
      let fatal = false
      ws.onopen = () => {
        attempt = 0
        ws.send(JSON.stringify({ t: 'hello', token } satisfies ClientMsg))
        ping = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 25_000)
      }
      ws.onmessage = (ev) => {
        let m: ServerMsg
        try {
          m = JSON.parse(ev.data as string) as ServerMsg
        } catch {
          return
        }
        if (m.t === 'state') {
          setRoom(m.room)
          setSkew(m.room.now - Date.now())
          setConn('open')
          setError(null)
          if (opened++ > 0) setEpoch((e) => e + 1) // se reconectó: hay que repintar con el estado completo
        } else if (m.t === 'chat') {
          const msg: ChatMsg = m.msg
          setRoom((r) => (r ? { ...r, chat: [...r.chat.filter((c) => c.id !== msg.id), msg].slice(-100) } : r))
        } else if (m.t === 'cells') {
          onCells.current?.(m.c)
        } else if (m.t === 'done') {
          setRoom((r) => (r && r.game ? { ...r, phase: 'done', game: { ...r.game, doneAt: m.doneAt } } : r))
        } else if (m.t === 'error') {
          setError({ code: m.code, msg: m.msg })
          if (FATAL.includes(m.code)) fatal = true
        }
      }
      ws.onclose = () => {
        clearInterval(ping)
        if (stop) return
        if (fatal) return setConn('closed')
        setConn('connecting')
        retry = setTimeout(connect, Math.min(8000, 1000 * 2 ** attempt++))
      }
    }
    connect()
    return () => {
      stop = true
      clearTimeout(retry)
      clearInterval(ping)
      wsRef.current?.close()
    }
  }, [code, token])

  const send = useCallback((m: ClientMsg) => {
    const ws = wsRef.current
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m))
  }, [])
  const registerCells = useCallback((fn: (c: [number, number, number][]) => void) => {
    onCells.current = fn
  }, [])

  return { room, conn, error, epoch, skew, send, registerCells }
}
