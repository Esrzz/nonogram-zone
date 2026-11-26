import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, cloneSettings, sanitizeSettings } from './settings'
import type { Settings } from './settings'

const KEY = 'nz-settings'

function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? sanitizeSettings(JSON.parse(raw)) : cloneSettings(DEFAULT_SETTINGS)
  } catch {
    return cloneSettings(DEFAULT_SETTINGS)
  }
}

let current: Settings = readLocal()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* sin almacenamiento */ }
}

export const getSettings = (): Settings => current
export const subscribeSettings = (cb: () => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
export const useSettings = (): Settings => useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS)

/** Cambia la configuración (se valida) y la guarda en este navegador. Más adelante se sincroniza con el perfil. */
export function updateSettings(change: (draft: Settings) => void) {
  const draft = cloneSettings(current)
  change(draft)
  current = sanitizeSettings(draft)
  saveLocal()
  emit()
}
