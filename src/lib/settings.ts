/**
 * Configuración del jugador: valores por defecto y validación.
 * Misma estructura que Monopolio del janeo, sin vista 3D y sin atajos definidos todavía.
 */

export type HotkeyAction = never

/** Acciones con atajo de teclado. Por ahora no hay ninguna. */
export const HOTKEY_ACTIONS: { id: HotkeyAction; label: string }[] = []

export const UI_SCALE_MIN = 75
export const UI_SCALE_MAX = 125
export const UI_SCALE_STEP = 5

export type Theme = 'gz' | 'dark'
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'gz', label: 'Modo GZ' },
  { id: 'dark', label: 'Modo oscuro' },
]

export interface Settings {
  v: 1
  audio: {
    musicVolume: number
    sfxVolume: number
    /** Archivo de la canción elegida (null = la primera de la lista) */
    trackFile: string | null
  }
  gameplay: {
    /** Tamaño de la interfaz en % (75–125) */
    uiScale: number
    hotkeysEnabled: boolean
    /** Mostrar las instrucciones (pistas) de los dos lados del tablero: izquierda y derecha, arriba y abajo */
    bothSideClues: boolean
    /** Colores: Modo GZ (violeta) o Modo oscuro (negro y blanco) */
    theme: Theme
  }
}

export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  audio: { musicVolume: 0.5, sfxVolume: 0.7, trackFile: null },
  gameplay: { uiScale: 100, hotkeysEnabled: true, bothSideClues: false, theme: 'gz' },
}

export const cloneSettings = (s: Settings): Settings => ({
  v: 1,
  audio: { ...s.audio },
  gameplay: { ...s.gameplay },
})

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/** Acepta cualquier cosa y devuelve una configuración completa y válida (lo que falte o sea inválido, por defecto). */
export function sanitizeSettings(input: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, any>
  const audio = (o.audio && typeof o.audio === 'object' ? o.audio : {}) as Record<string, unknown>
  const gp = (o.gameplay && typeof o.gameplay === 'object' ? o.gameplay : {}) as Record<string, unknown>
  const scale = Math.round(num(gp.uiScale, UI_SCALE_MIN, UI_SCALE_MAX, d.gameplay.uiScale) / UI_SCALE_STEP) * UI_SCALE_STEP
  return {
    v: 1,
    audio: {
      musicVolume: num(audio.musicVolume, 0, 1, d.audio.musicVolume),
      sfxVolume: num(audio.sfxVolume, 0, 1, d.audio.sfxVolume),
      trackFile: typeof audio.trackFile === 'string' && audio.trackFile.length <= 200 ? audio.trackFile : null,
    },
    gameplay: {
      uiScale: scale,
      hotkeysEnabled: typeof gp.hotkeysEnabled === 'boolean' ? gp.hotkeysEnabled : d.gameplay.hotkeysEnabled,
      bothSideClues: typeof gp.bothSideClues === 'boolean' ? gp.bothSideClues : d.gameplay.bothSideClues,
      theme: gp.theme === 'dark' || gp.theme === 'gz' ? gp.theme : d.gameplay.theme,
    },
  }
}
