/**
 * Lógica pura de una sala (sin nada de Cloudflare): se puede probar con vitest.
 * El Durable Object (index.js) solo traduce sockets <-> estos métodos y guarda el estado.
 */
import { gridClues, lineClue } from '../../src/lib/nonogram'
import {
  CHAT_MAX, COOP_MAX_SIZE, DEFAULT_CONFIG, PALETTE, PLAYERS_MAX, PLAYERS_MIN, ROOM_SIZES,
} from '../../src/lib/roomProtocol'
import type { ChatMsg, ClientMsg, Phase, PlayerInfo, RoomConfig, RoomSnapshot, ServerMsg } from '../../src/lib/roomProtocol'

/** Un mensaje saliente: a todos (to = null) o a un jugador */
export interface Out {
  to: string | null
  msg: ServerMsg
}

interface Game {
  size: number
  rows: number[][]
  cols: number[][]
  cells: number[]
  owners: number[]
  startedAt: number
  doneAt: number | null
  /** Filas y columnas que ya coinciden con sus pistas */
  rowOk: boolean[]
  colOk: boolean[]
}

export interface RoomData {
  code: string
  hostId: string
  config: RoomConfig
  phase: Phase
  players: PlayerInfo[]
  chat: ChatMsg[]
  chatSeq: number
  game: Game | null
}

const MAX_CHAT_KEPT = 100
const CHAT_GAP_MS = 600
const MAX_PAINT_BATCH = 800

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

export class RoomCore {
  d: RoomData
  private lastChat = new Map<string, number>()

  constructor(d: RoomData) {
    this.d = d
  }

  static create(code: string, host: { id: string; name: string }): RoomCore {
    return new RoomCore({
      code,
      hostId: host.id,
      config: { ...DEFAULT_CONFIG },
      phase: 'lobby',
      players: [],
      chat: [],
      chatSeq: 0,
      game: null,
    })
  }

  toJSON(): RoomData {
    return this.d
  }

  // ---------- consultas ----------
  get connectedCount() {
    return this.d.players.filter((p) => p.connected).length
  }
  private player(id: string) {
    return this.d.players.find((p) => p.id === id)
  }
  snapshot(now = Date.now()): RoomSnapshot {
    const { code, phase, config, hostId, players, chat, game } = this.d
    return {
      now, code, phase, config, hostId, players, chat,
      game: game && {
        size: game.size, rows: game.rows, cols: game.cols,
        cells: game.cells.join(''), owners: game.owners.join(''),
        startedAt: game.startedAt, doneAt: game.doneAt,
      },
    }
  }
  private state(): Out {
    return { to: null, msg: { t: 'state', room: this.snapshot() } }
  }
  private say(text: string, now: number): Out {
    const msg: ChatMsg = { id: ++this.d.chatSeq, from: null, name: '', text, ts: now }
    this.d.chat.push(msg)
    if (this.d.chat.length > MAX_CHAT_KEPT) this.d.chat.splice(0, this.d.chat.length - MAX_CHAT_KEPT)
    return { to: null, msg: { t: 'chat', msg } }
  }
  private error(to: string, code: 'full' | 'started' | 'bad', msg: string): Out {
    return { to, msg: { t: 'error', code, msg } }
  }

  // ---------- entrada y salida ----------
  /** Una persona se conecta (por primera vez o volviendo). `ok: false` = rechazada. */
  join(id: string, name: string, now = Date.now()): { ok: boolean; out: Out[] } {
    const known = this.player(id)
    if (known) {
      const was = known.connected
      known.connected = true
      known.name = name
      return { ok: true, out: [this.state(), ...(was ? [] : [this.say(`${name} volvió a la sala.`, now)])] }
    }
    if (this.d.phase !== 'lobby') return { ok: false, out: [this.error(id, 'started', 'La partida ya empezó.')] }
    if (this.d.players.length >= this.d.config.maxPlayers) return { ok: false, out: [this.error(id, 'full', 'La sala está llena.')] }
    const taken = new Set(this.d.players.map((p) => p.color))
    const color = PALETTE.findIndex((_, i) => !taken.has(i))
    this.d.players.push({ id, name, color, connected: true })
    return { ok: true, out: [this.state(), this.say(`${name} entró a la sala.`, now)] }
  }

  leave(id: string, now = Date.now()): Out[] {
    const p = this.player(id)
    if (!p) return []
    const out: Out[] = []
    if (this.d.phase === 'lobby') this.d.players = this.d.players.filter((x) => x.id !== id)
    else p.connected = false
    out.push(this.say(`${p.name} salió de la sala.`, now))
    if (this.d.hostId === id) {
      const next = this.d.players.find((x) => x.connected && x.id !== id)
      if (next) {
        this.d.hostId = next.id
        out.push(this.say(`${next.name} es ahora el anfitrión.`, now))
      }
    }
    out.push(this.state())
    return out
  }

  // ---------- mensajes de un jugador ----------
  handle(id: string, msg: ClientMsg, now = Date.now()): Out[] {
    const p = this.player(id)
    if (!p) return []
    switch (msg.t) {
      case 'chat': return this.onChat(p, msg.text, now)
      case 'config': return this.onConfig(id, msg.config)
      case 'color': return this.onColor(p, msg.color)
      case 'start': return this.onStart(id, msg.solution, now)
      case 'paint': return this.onPaint(p, msg.c, now)
      case 'back': return this.onBack(id)
      default: return []
    }
  }

  private onChat(p: PlayerInfo, raw: unknown, now: number): Out[] {
    const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX) : ''
    if (!text) return []
    if (now - (this.lastChat.get(p.id) ?? 0) < CHAT_GAP_MS) return []
    this.lastChat.set(p.id, now)
    const m: ChatMsg = { id: ++this.d.chatSeq, from: p.id, name: p.name, text, ts: now }
    this.d.chat.push(m)
    if (this.d.chat.length > MAX_CHAT_KEPT) this.d.chat.splice(0, this.d.chat.length - MAX_CHAT_KEPT)
    return [{ to: null, msg: { t: 'chat', msg: m } }]
  }

  private onConfig(id: string, c: Partial<RoomConfig> | undefined): Out[] {
    if (id !== this.d.hostId || this.d.phase !== 'lobby' || !c) return []
    const cfg = { ...this.d.config }
    if (c.mode === 'coop') cfg.mode = c.mode
    if (typeof c.size === 'number' && (ROOM_SIZES as readonly number[]).includes(c.size) && c.size <= COOP_MAX_SIZE) cfg.size = c.size
    if (Number.isInteger(c.maxPlayers)) {
      cfg.maxPlayers = Math.min(PLAYERS_MAX, Math.max(PLAYERS_MIN, c.maxPlayers as number, this.d.players.length))
    }
    this.d.config = cfg
    return [this.state()]
  }

  private onColor(p: PlayerInfo, color: unknown): Out[] {
    if (this.d.phase !== 'lobby' || !Number.isInteger(color)) return []
    const c = color as number
    if (c < 0 || c >= PALETTE.length || this.d.players.some((x) => x.id !== p.id && x.color === c)) return []
    p.color = c
    return [this.state()]
  }

  private onStart(id: string, solution: unknown, now: number): Out[] {
    if (id !== this.d.hostId || this.d.phase !== 'lobby') return []
    const n = this.d.config.size
    if (typeof solution !== 'string' || solution.length !== n * n || !/^[01]+$/.test(solution) || !solution.includes('1')) {
      return [this.error(id, 'bad', 'El nonograma no es válido.')]
    }
    const cells0 = Array.from(solution, Number)
    const { rows, cols } = gridClues(cells0, n, n)
    const game: Game = {
      size: n, rows, cols, cells: new Array(n * n).fill(0), owners: new Array(n * n).fill(0),
      startedAt: now, doneAt: null, rowOk: [], colOk: [],
    }
    game.rowOk = rows.map((r) => r.length === 0)
    game.colOk = cols.map((c) => c.length === 0)
    this.d.game = game
    this.d.phase = 'playing'
    return [this.say('¡Empezó la partida!', now), this.state()]
  }

  private lineOk(g: Game, axis: 'r' | 'c', i: number) {
    const line = new Array<number>(g.size)
    for (let j = 0; j < g.size; j++) line[j] = g.cells[axis === 'r' ? i * g.size + j : j * g.size + i]
    return same(lineClue(line), axis === 'r' ? g.rows[i] : g.cols[i])
  }

  private onPaint(p: PlayerInfo, list: unknown, now: number): Out[] {
    const g = this.d.game
    if (this.d.phase !== 'playing' || !g || !Array.isArray(list)) return []
    const changes: [number, number, number][] = []
    const refused: [number, number, number][] = []
    const rows = new Set<number>()
    const cols = new Set<number>()
    for (const item of list.slice(0, MAX_PAINT_BATCH)) {
      if (!Array.isArray(item)) continue
      const [i, v] = item as [number, number]
      if (!Number.isInteger(i) || i < 0 || i >= g.cells.length || (v !== 0 && v !== 1 && v !== 2)) continue
      const owner = v === 0 ? 0 : p.color + 1
      // Lo pintado por otro jugador no se puede borrar ni cambiar: se le devuelve el valor real a quien lo intentó
      if (g.cells[i] === 1 && g.owners[i] !== 0 && g.owners[i] !== p.color + 1) {
        refused.push([i, 1, g.owners[i]])
        continue
      }
      if (g.cells[i] === v && g.owners[i] === owner) continue
      g.cells[i] = v
      g.owners[i] = owner
      changes.push([i, v, owner])
      rows.add(Math.floor(i / g.size))
      cols.add(i % g.size)
    }
    const back: Out[] = refused.length ? [{ to: p.id, msg: { t: 'cells', c: refused } }] : []
    if (!changes.length) return back
    for (const r of rows) g.rowOk[r] = this.lineOk(g, 'r', r)
    for (const c of cols) g.colOk[c] = this.lineOk(g, 'c', c)
    const out: Out[] = [{ to: null, msg: { t: 'cells', c: changes } }, ...back]
    if (g.rowOk.every(Boolean) && g.colOk.every(Boolean)) {
      g.doneAt = now
      this.d.phase = 'done'
      out.push({ to: null, msg: { t: 'done', doneAt: now } }, this.state())
    }
    return out
  }

  private onBack(id: string): Out[] {
    if (id !== this.d.hostId || this.d.phase === 'lobby') return []
    this.d.phase = 'lobby'
    this.d.game = null
    this.d.players = this.d.players.filter((p) => p.connected)
    return [this.state()]
  }
}
