import { useCallback, useEffect, useRef, useState } from 'react'
import { loadManifest } from './audioManifest'
import type { Track } from './audioManifest'
import { setSfxVolume as applySfxVolume } from './sfx'
import { updateSettings, useSettings } from './settingsStore'

export type { Track }

export function useAudio() {
  const prefs = useSettings().audio
  const [tracks, setTracks] = useState<Track[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startedRef = useRef(false)

  const current = tracks.find((t) => t.file === prefs.trackFile) ?? tracks[0] ?? null

  // Elemento de audio de la música (uno solo) y lista de canciones desde el manifest
  useEffect(() => {
    const el = new Audio()
    el.loop = true
    audioRef.current = el
    let alive = true
    void loadManifest().then((m) => { if (alive) setTracks(m.music) })
    return () => { alive = false; el.pause(); audioRef.current = null }
  }, [])

  // Volúmenes
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = prefs.musicVolume
    applySfxVolume(prefs.sfxVolume)
  }, [prefs.musicVolume, prefs.sfxVolume])

  // Canción: se cambia cuando cambia la elegida (también si llega distinta desde el perfil del servidor)
  useEffect(() => {
    const el = audioRef.current
    if (!el || !current) return
    if (el.getAttribute('data-file') === current.file) return
    const wasPlaying = !el.paused
    el.pause()
    el.src = current.file
    el.setAttribute('data-file', current.file)
    el.load()
    if (wasPlaying || startedRef.current) void el.play().catch(() => { /* bloqueado */ })
  }, [current])

  const setTrack = useCallback((file: string) => updateSettings((s) => { s.audio.trackFile = file }), [])

  // Iniciar música (llamar desde una interacción del usuario la primera vez)
  const startMusic = useCallback(() => {
    const el = audioRef.current
    if (!el || startedRef.current) return
    startedRef.current = true
    if (el.src) void el.play().catch(() => { /* autoplay bloqueado */ })
  }, [])

  const setMusicVolume = useCallback((v: number) => updateSettings((s) => { s.audio.musicVolume = v }), [])
  const setSfxVolume = useCallback((v: number) => updateSettings((s) => { s.audio.sfxVolume = v }), [])

  return { prefs, tracks, current, setMusicVolume, setSfxVolume, setTrack, startMusic }
}
