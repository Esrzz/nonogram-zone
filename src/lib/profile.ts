import fallback from '../data/avatars.json'

export interface DiscordAvatar {
  id: string
  name: string
  avatar: string | null
}

/** Copia local de los perfiles: se usa si el Worker no responde. */
export const FALLBACK_MEMBERS = fallback as DiscordAvatar[]

/** Minúsculas, sin acentos, sin espacios ni símbolos: "Kawaga." -> "kawaga" */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Miembro cuyo nombre coincide exactamente con el escrito, o null. */
export function findAvatar(name: string, list: DiscordAvatar[]): DiscordAvatar | null {
  const key = normalizeName(name)
  if (!key) return null
  return list.find((m) => normalizeName(m.name) === key) ?? null
}

/** Miembros cuyo nombre empieza con lo escrito (para sugerir). */
export function suggest(name: string, list: DiscordAvatar[], max = 5): DiscordAvatar[] {
  const key = normalizeName(name)
  if (!key) return []
  return list.filter((m) => normalizeName(m.name).startsWith(key)).slice(0, max)
}

export const NAME_MAX = 20

/** Nombre válido: 2 a 20 caracteres. */
export function validName(name: string): boolean {
  const t = name.trim()
  return t.length >= 2 && t.length <= NAME_MAX
}
