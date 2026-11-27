import { API } from './members'

/**
 * Sesión con Discord: la maneja el Worker de Gaming Zone (el mismo inicio de sesión). Al volver de Discord deja un
 * token firmado en el fragmento de la dirección (#gz_login=...). Se guarda en este navegador y el Worker lo valida.
 */
const KEY = 'nz-session'

export interface Session {
  id: string
  name: string
}

/** Dirección que manda a Discord; `return` le dice al Worker a qué página volver (debe estar en su EXTRA_SITES). */
export const loginUrl = () => `${API}/auth/login?return=${encodeURIComponent(window.location.origin)}`

export function readToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: la sesión dura hasta cerrar la pestaña */
  }
}

/** Lee el nombre y el id del token solo para mostrarlos; la validez la comprueba el Worker. */
export function sessionFromToken(token: string | null): Session | null {
  if (!token) return null
  try {
    const part = token.split('.')[0].replaceAll('-', '+').replaceAll('_', '/')
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0))
    const p = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: string; n?: string; exp?: number }
    return p.sub && typeof p.n === 'string' && (!p.exp || p.exp > Date.now()) ? { id: p.sub, name: p.n } : null
  } catch {
    return null
  }
}

/** Al volver de Discord: lee (y borra de la barra) #gz_login=<sesión> o #gz_login_error=<motivo>. */
export function consumeLoginFragment(): { token: string | null; error: string | null } | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('gz_login')
  const error = params.get('gz_login_error')
  if (!token && !error) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return { token, error }
}

/** false = el Worker dice que la sesión no vale (vencida o inválida). Sin conexión se asume válida. */
export async function checkSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    return res.status !== 401
  } catch {
    return true
  }
}

export const LOGIN_ERRORS: Record<string, string> = {
  denied: 'Cancelaste el inicio de sesión.',
  'not-member': 'Esa cuenta de Discord no está en el servidor. Unite y probá de nuevo.',
  unavailable: 'No se pudo iniciar sesión ahora. Probá de nuevo en un rato.',
  state: 'El inicio de sesión se interrumpió. Probá de nuevo.',
  exchange: 'Discord no respondió bien. Probá de nuevo.',
}
