export interface Track {
  file: string
  label: string
}

export interface AudioManifest {
  music: Track[]
  sfx: Record<string, string[]>
}

let cached: Promise<AudioManifest> | null = null

/** Lista de audios generada por el plugin de Vite a partir de `public/audio`. */
export function loadManifest(): Promise<AudioManifest> {
  cached ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : { music: [], sfx: {} }))
    .catch(() => ({ music: [], sfx: {} }))
  return cached
}
