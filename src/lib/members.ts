import { useEffect, useState } from 'react'
import { FALLBACK_MEMBERS, type DiscordAvatar } from './profile'

// Worker de Gaming Zone: ahí están los perfiles con los avatares actualizados.
export const API = import.meta.env.VITE_API_URL ?? 'https://gaming-zone-api.gamingzone.workers.dev'

interface RawMember {
  id?: unknown
  name?: unknown
  avatar?: unknown
}

/** Trae los perfiles del Worker. Si falla, devuelve la copia local. */
export function useMembers(): { members: DiscordAvatar[]; live: boolean } {
  const [state, setState] = useState({ members: FALLBACK_MEMBERS, live: false })

  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/members`, { signal: ctrl.signal })
        if (!res.ok) return
        const data = (await res.json()) as { members?: RawMember[] }
        const list: DiscordAvatar[] = (data.members ?? [])
          .filter((m) => typeof m.id === 'string' && typeof m.name === 'string')
          .map((m) => ({
            id: m.id as string,
            name: m.name as string,
            avatar: typeof m.avatar === 'string' ? m.avatar : null,
          }))
        if (list.length > 0) setState({ members: list, live: true })
      } catch {
        /* sin red o CORS: queda la copia local */
      }
    })()
    return () => ctrl.abort()
  }, [])

  return state
}
