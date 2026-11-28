// Servidor de salas multijugador de Nonogram Zone.
//
//   POST /rooms              -> crea una sala y devuelve { code } (con "Authorization: Bearer <sesión>")
//   GET  /rooms/<CÓDIGO>/ws  -> WebSocket de la sala; el primer mensaje es { t: "hello", token }
//   GET  /health
//
// Cada sala es un Durable Object (clase Room) que guarda el estado en memoria y en su almacenamiento.
// Las sesiones las valida el Worker de Gaming Zone (AUTH_API), el mismo inicio de sesión de la página.

import { RoomCore } from './roomCore.ts'
import { CODE_ALPHABET, CODE_LEN } from '../../src/lib/roomProtocol.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } })

const HELLO_TIMEOUT_MS = 10_000
const EMPTY_ROOM_MS = 30 * 60_000 // una sala vacía se borra a los 30 minutos
const SAVE_DELAY_MS = 2000
const MAX_MSG_CHARS = 64 * 1024

// ---- Quién es cada sesión (se pregunta al Worker de Gaming Zone y se recuerda un minuto) ----
const known = new Map()
async function whoIs(env, token) {
  if (typeof token !== 'string' || !token || token.length > 2000) return null
  const hit = known.get(token)
  if (hit && hit.until > Date.now()) return hit.user
  try {
    // Con el binding AUTH se llama directo al Worker de Gaming Zone (un Worker no puede hacer fetch a otro workers.dev
    // de la misma cuenta: Cloudflare lo bloquea). Sin binding se usa la dirección pública.
    const init = { headers: { Authorization: `Bearer ${token}` } }
    const res = env.AUTH ? await env.AUTH.fetch('https://auth.internal/auth/me', init) : await fetch(`${env.AUTH_API}/auth/me`, init)
    if (!res.ok) return null
    const u = await res.json()
    if (!u?.id) return null
    const user = { id: String(u.id), name: String(u.name ?? 'Jugador').slice(0, 40) }
    if (known.size > 500) known.clear()
    known.set(token, { user, until: Date.now() + 60_000 })
    return user
  } catch {
    return null
  }
}

const randomCode = () => {
  const b = crypto.getRandomValues(new Uint8Array(CODE_LEN))
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('')
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (url.pathname === '/health') return json({ ok: true })

    if (url.pathname === '/rooms') {
      if (request.method !== 'POST') return json({ error: 'Usá POST' }, 405)
      const m = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')
      const user = m && (await whoIs(env, m[1]))
      if (!user) return json({ error: 'Sesión inválida o vencida' }, 401)
      for (let tries = 0; tries < 6; tries++) {
        const code = randomCode()
        const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/create', {
          method: 'POST',
          body: JSON.stringify({ code, host: user }),
        })
        if (res.status === 204) return json({ code })
      }
      return json({ error: 'No se pudo crear la sala. Probá de nuevo.' }, 503)
    }

    const ws = /^\/rooms\/([A-Za-z0-9]{1,12})\/ws$/.exec(url.pathname)
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Se esperaba un WebSocket' }, 426)
      const code = ws[1].toUpperCase()
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request)
    }

    return json({ error: 'No encontrado' }, 404)
  },
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.core = null
    this.sockets = new Map() // id de jugador -> WebSocket
    this.saveTimer = null
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('room')
      if (saved) this.core = new RoomCore(saved)
    })
  }

  save(now = false) {
    if (!this.core) return
    if (now) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
      return void this.ctx.storage.put('room', this.core.toJSON())
    }
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (this.core) this.ctx.storage.put('room', this.core.toJSON())
    }, SAVE_DELAY_MS)
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket cerrado */
    }
  }

  dispatch(outs) {
    for (const o of outs) {
      if (o.to === null) for (const ws of this.sockets.values()) this.send(ws, o.msg)
      else {
        const ws = this.sockets.get(o.to)
        if (ws) this.send(ws, o.msg)
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/create') {
      if (this.core) return new Response(null, { status: 409 })
      const { code, host } = await request.json()
      this.core = RoomCore.create(code, host)
      this.save(true)
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS)
      return new Response(null, { status: 204 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    server.accept()
    this.attach(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  attach(ws) {
    let me = null // { id, name } cuando ya dijo hola
    const hello = setTimeout(() => !me && ws.close(4001, 'sin hello'), HELLO_TIMEOUT_MS)

    ws.addEventListener('message', async (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > MAX_MSG_CHARS) return
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if (!msg || typeof msg.t !== 'string') return
      if (msg.t === 'ping') return this.send(ws, { t: 'pong' })

      if (!me) {
        if (msg.t !== 'hello') return
        clearTimeout(hello)
        if (!this.core) {
          this.send(ws, { t: 'error', code: 'no-room', msg: 'Esa sala no existe o ya se cerró.' })
          return ws.close(4004, 'no-room')
        }
        const user = await whoIs(this.env, msg.token)
        if (!user) {
          this.send(ws, { t: 'error', code: 'auth', msg: 'Tu sesión venció. Iniciá sesión de nuevo.' })
          return ws.close(4003, 'auth')
        }
        const r = this.core.join(user.id, user.name)
        if (!r.ok) {
          for (const o of r.out) this.send(ws, o.msg)
          return ws.close(4005, 'rechazado')
        }
        me = user
        const old = this.sockets.get(user.id)
        this.sockets.set(user.id, ws)
        if (old && old !== ws) {
          this.send(old, { t: 'error', code: 'bad', msg: 'Entraste desde otra pestaña.' })
          old.close(4006, 'reemplazado')
        }
        await this.ctx.storage.deleteAlarm()
        this.dispatch(r.out)
        return this.save(true)
      }

      const outs = this.core.handle(me.id, msg)
      this.dispatch(outs)
      this.save(outs.some((o) => o.msg.t === 'state')) // las pinceladas se guardan con retraso
    })

    const bye = () => {
      clearTimeout(hello)
      if (!me || this.sockets.get(me.id) !== ws) return
      this.sockets.delete(me.id)
      if (this.core) {
        this.dispatch(this.core.leave(me.id))
        this.save(true)
      }
      if (this.sockets.size === 0) this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS)
    }
    ws.addEventListener('close', bye)
    ws.addEventListener('error', bye)
  }

  // Sala vacía por mucho tiempo: se borra
  async alarm() {
    if (this.sockets.size > 0) return
    this.core = null
    await this.ctx.storage.deleteAll()
  }
}
