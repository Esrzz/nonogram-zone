/**
 * Protocolo de las salas multijugador (lo comparten la página y el servidor de salas en `server/`).
 * Las celdas viajan como texto: un carácter por celda ('0' vacía, '1' pintada, '2' cruz). Los dueños, igual:
 * '0' nadie, '1'–'8' = color 1–8 de la paleta.
 */
import type { Clue } from './nonogram'

export type RoomMode = 'coop'
export const ROOM_MODES: { id: RoomMode; label: string; hint: string }[] = [
  { id: 'coop', label: 'Cooperativo', hint: 'Todos pintan el mismo nonograma, cada uno con su color.' },
]

/** Tamaños elegibles en la sala (máximo 50×50 en cooperativo) */
export const ROOM_SIZES = [5, 10, 15, 20, 25, 30, 40, 50] as const
export const COOP_MAX_SIZE = 50
export const PLAYERS_MIN = 2
export const PLAYERS_MAX = 4

export const PALETTE = [
  { name: 'Rojo', hex: '#ef4444' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Verde', hex: '#22c55e' },
  { name: 'Naranja', hex: '#f59e0b' },
  { name: 'Violeta', hex: '#a855f7' },
  { name: 'Celeste', hex: '#06b6d4' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Lima', hex: '#a3e635' },
] as const

export const CHAT_MAX = 300
export const CODE_LEN = 5
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)

export interface RoomConfig {
  mode: RoomMode
  size: number
  maxPlayers: number
}
export const DEFAULT_CONFIG: RoomConfig = { mode: 'coop', size: 10, maxPlayers: 2 }

export interface PlayerInfo {
  id: string
  name: string
  /** Índice en PALETTE (0–7) */
  color: number
  connected: boolean
}

export interface ChatMsg {
  id: number
  /** id del jugador; null = aviso del sistema */
  from: string | null
  name: string
  text: string
  ts: number
}

export type Phase = 'lobby' | 'playing' | 'done'

export interface GameSnapshot {
  size: number
  rows: Clue[]
  cols: Clue[]
  cells: string
  owners: string
  startedAt: number
  doneAt: number | null
}

export interface RoomSnapshot {
  /** Hora del servidor al armar este estado (para compensar relojes distintos) */
  now: number
  code: string
  phase: Phase
  config: RoomConfig
  hostId: string
  players: PlayerInfo[]
  chat: ChatMsg[]
  game: GameSnapshot | null
}

// ---- Mensajes ----
export type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'ping' }
  | { t: 'chat'; text: string }
  | { t: 'config'; config: Partial<RoomConfig> }
  | { t: 'color'; color: number }
  | { t: 'start'; solution: string }
  | { t: 'paint'; c: [number, number][] }
  | { t: 'back' }

export type ServerError = 'no-room' | 'full' | 'started' | 'auth' | 'bad'

export type ServerMsg =
  | { t: 'state'; room: RoomSnapshot }
  | { t: 'chat'; msg: ChatMsg }
  /** Cambios de celdas: [índice, valor, dueño] */
  | { t: 'cells'; c: [number, number, number][] }
  | { t: 'done'; doneAt: number }
  | { t: 'pong' }
  | { t: 'error'; code: ServerError; msg: string }
