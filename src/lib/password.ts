import { API } from './members'

/**
 * Contraseña de perfil (la guarda el Worker de Gaming Zone, solo como hash). Se crea al entrar con Discord por primera
 * vez; después, quien entra solo con el nombre de ese perfil tiene que ponerla.
 */
export const PW_MIN = 6
export const PW_MAX = 72

export interface PwStatus {
  member: boolean
  protected: boolean
}

const post = (path: string, body: unknown, token?: string) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })

/** ¿Ese nombre es de un miembro con contraseña? null si no se pudo consultar (sin conexión). */
export async function pwStatus(name: string): Promise<PwStatus | null> {
  try {
    const res = await fetch(`${API}/nz/pw/status?name=${encodeURIComponent(name)}`)
    return res.ok ? ((await res.json()) as PwStatus) : null
  } catch {
    return null
  }
}

/** ¿La sesión ya tiene contraseña? null si no se pudo saber. */
export async function pwHasPassword(token: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API}/nz/pw/me`, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? !!((await res.json()) as { set: boolean }).set : null
  } catch {
    return null
  }
}

export type PwSetResult = 'ok' | 'wrong' | 'locked' | 'invalid' | 'session' | 'error'

export async function pwSet(token: string, password: string, current?: string): Promise<PwSetResult> {
  try {
    const res = await post('/nz/pw/set', { password, current }, token)
    if (res.status === 204) return 'ok'
    if (res.status === 403) return 'wrong'
    if (res.status === 429) return 'locked'
    if (res.status === 400) return 'invalid'
    if (res.status === 401) return 'session'
    return 'error'
  } catch {
    return 'error'
  }
}

export type PwLoginResult = { ok: true; token: string } | { ok: false; why: 'wrong' | 'locked' | 'error'; left?: number }

export async function pwLogin(name: string, password: string): Promise<PwLoginResult> {
  try {
    const res = await post('/nz/pw/login', { name, password })
    if (res.ok) return { ok: true, token: ((await res.json()) as { token: string }).token }
    if (res.status === 429) return { ok: false, why: 'locked' }
    if (res.status === 403) return { ok: false, why: 'wrong', left: ((await res.json().catch(() => ({}))) as { left?: number }).left }
    return { ok: false, why: 'error' }
  } catch {
    return { ok: false, why: 'error' }
  }
}

export const validPassword = (p: string) => p.length >= PW_MIN && p.length <= PW_MAX
