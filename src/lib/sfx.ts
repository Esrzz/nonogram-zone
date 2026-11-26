import { loadManifest } from './audioManifest'

/** Efectos de sonido: se leen de `public/audio/Efectos/<nombre>/`. Todavía no hay ninguno cargado. */
let volume = 0.7
let sfx: Record<string, string[]> = {}
void loadManifest().then((m) => { sfx = m.sfx })

export function setSfxVolume(v: number) {
  volume = v
}

export function play(name: string) {
  const urls = sfx[name]
  if (!urls || urls.length === 0) return
  const a = new Audio(urls[Math.floor(Math.random() * urls.length)])
  a.volume = volume
  void a.play().catch(() => { /* bloqueado */ })
}
