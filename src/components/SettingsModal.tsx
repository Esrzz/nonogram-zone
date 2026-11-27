import { useEffect, useState } from 'react'
import { THEMES, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP } from '../lib/settings'
import { updateSettings, useSettings } from '../lib/settingsStore'
import { useFullscreen } from '../lib/useFullscreen'
import HotkeysModal from './HotkeysModal'
import type { Track } from '../lib/audioManifest'

type Tab = 'video' | 'audio' | 'jugabilidad' | 'otros'

interface Props {
  musicVolume: number
  sfxVolume: number
  tracks: Track[]
  trackFile: string | null
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
  onTrack: (file: string) => void
  onClose: () => void
}

export default function SettingsModal({
  musicVolume,
  sfxVolume,
  tracks,
  trackFile,
  onMusicVolume,
  onSfxVolume,
  onTrack,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('audio')
  const [trackOpen, setTrackOpen] = useState(false)
  const fs = useFullscreen()
  const gameplay = useSettings().gameplay
  const [hotkeysOpen, setHotkeysOpen] = useState(false)
  const currentTrack = tracks.find((t) => t.file === trackFile) ?? tracks[0] ?? null

  useEffect(() => {
    if (!trackOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setTrackOpen(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [trackOpen])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'video',       label: '🖥 Video' },
    { id: 'audio',       label: '🔊 Audio' },
    { id: 'jugabilidad', label: '🎮 Jugabilidad' },
    { id: 'otros',       label: '⚙ Otros' },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Configuraciones">
        <div className="modal-header">
          <h2>Configuraciones</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="modal-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`modal-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'audio' && (
            <div className="settings-section">
              <div className="setting-row">
                <label className="setting-label">
                  Volumen de música
                  <span className="setting-value">{Math.round(musicVolume * 100)}%</span>
                </label>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={musicVolume}
                  onChange={(e) => onMusicVolume(Number(e.target.value))}
                />
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Volumen de efectos
                  <span className="setting-value">{Math.round(sfxVolume * 100)}%</span>
                </label>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sfxVolume}
                  onChange={(e) => onSfxVolume(Number(e.target.value))}
                />
              </div>

              <div className="setting-row">
                <label className="setting-label">Canción de fondo</label>
                {tracks.length === 0 ? (
                  <p className="muted">Todavía no hay canciones. Agregalas en public/audio/Music y aparecen acá.</p>
                ) : (
                  <div className="track-select">
                    <button
                      type="button"
                      className="track-btn track-select-btn active"
                      aria-haspopup="listbox"
                      aria-expanded={trackOpen}
                      onClick={() => setTrackOpen((o) => !o)}
                    >
                      <span className="track-icon">♪</span>
                      {currentTrack?.label}
                      <span className="caret">{trackOpen ? '▲' : '▼'}</span>
                    </button>
                    {trackOpen && (
                      <div className="track-list" role="listbox">
                        {tracks.map((t) => {
                          const active = currentTrack?.file === t.file
                          return (
                            <button
                              key={t.file}
                              role="option"
                              aria-selected={active}
                              className={`track-btn${active ? ' active' : ''}`}
                              onClick={() => { onTrack(t.file); setTrackOpen(false) }}
                            >
                              <span className="track-icon">{active ? '▶' : '♪'}</span>
                              {t.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'video' && (
            <div className="settings-section">
              <div className="setting-row">
                <label className="setting-label">
                  Pantalla completa
                  <span className="setting-value">{fs.on ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Ocupar toda la pantalla</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={fs.on}
                    aria-label="Pantalla completa"
                    className="vtoggle"
                    disabled={!fs.supported}
                    onClick={() => void fs.toggle()}
                  />
                </div>
                {!fs.supported && <p className="setting-hint">Tu navegador no permite la pantalla completa.</p>}
              </div>
            </div>
          )}

          {tab === 'jugabilidad' && (
            <div className="settings-section">
              <div className="setting-row">
                <label className="setting-label">
                  Tamaño de la interfaz
                  <span className="setting-value">{gameplay.uiScale}%</span>
                </label>
                <input
                  type="range"
                  className="slider"
                  aria-label="Tamaño de la interfaz"
                  min={UI_SCALE_MIN}
                  max={UI_SCALE_MAX}
                  step={UI_SCALE_STEP}
                  value={gameplay.uiScale}
                  onChange={(e) => updateSettings((s) => { s.gameplay.uiScale = Number(e.target.value) })}
                />
                <div className="setting-hint scale-hint">
                  <span>{UI_SCALE_MIN}%</span>
                  <button type="button" className="link-btn" disabled={gameplay.uiScale === 100} onClick={() => updateSettings((s) => { s.gameplay.uiScale = 100 })}>
                    Volver a 100%
                  </button>
                  <span>{UI_SCALE_MAX}%</span>
                </div>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Colores
                  <span className="setting-value">{THEMES.find((t) => t.id === gameplay.theme)?.label}</span>
                </label>
                <div className="seg" role="group" aria-label="Colores">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={gameplay.theme === t.id}
                      onClick={() => updateSettings((s) => { s.gameplay.theme = t.id })}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Instrucciones de ambos lados
                  <span className="setting-value">{gameplay.bothSideClues ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Repetir las pistas a la derecha y abajo del tablero</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gameplay.bothSideClues}
                    aria-label="Instrucciones de ambos lados"
                    className="vtoggle"
                    onClick={() => updateSettings((s) => { s.gameplay.bothSideClues = !s.gameplay.bothSideClues })}
                  />
                </div>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Bloquear trazo
                  <span className="setting-value">{gameplay.lockStroke ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Al resolver, el trazo queda en la fila o columna de la primera celda pintada (sin diagonales)</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gameplay.lockStroke}
                    aria-label="Bloquear trazo"
                    className="vtoggle"
                    onClick={() => updateSettings((s) => { s.gameplay.lockStroke = !s.gameplay.lockStroke })}
                  />
                </div>
                <p className="setting-hint">Al crear nonogramas el trazo siempre es libre.</p>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Autocompletar cruces
                  <span className="setting-value">{gameplay.autoCross ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Al tachar todas las pistas de una fila o columna (o tocar una pista de una línea ya completa), se marcan con × las celdas vacías que quedan</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gameplay.autoCross}
                    aria-label="Autocompletar cruces"
                    className="vtoggle"
                    onClick={() => updateSettings((s) => { s.gameplay.autoCross = !s.gameplay.autoCross })}
                  />
                </div>
                <p className="setting-hint">Con el tachado automático activado, también se completan solas las cruces cuando una línea coincide con sus pistas.</p>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Tachado automático
                  <span className="setting-value">{gameplay.autoStrike ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Tachar las pistas de una fila o columna cuando lo pintado coincide con ellas</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gameplay.autoStrike}
                    aria-label="Tachado automático"
                    className="vtoggle"
                    onClick={() => updateSettings((s) => { s.gameplay.autoStrike = !s.gameplay.autoStrike })}
                  />
                </div>
                <p className="setting-hint">También podés tachar y destachar un número a mano tocándolo, incluso los tachados solos. Si la fila deja de coincidir, se destachan solos los automáticos.</p>
              </div>

              <div className="setting-row">
                <label className="setting-label">
                  Atajos de teclado
                  <span className="setting-value">{gameplay.hotkeysEnabled ? 'Sí' : 'No'}</span>
                </label>
                <div className="check" style={{ justifyContent: 'space-between' }}>
                  <span>Habilitar atajos de teclado</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gameplay.hotkeysEnabled}
                    aria-label="Habilitar atajos de teclado"
                    className="vtoggle"
                    onClick={() => updateSettings((s) => { s.gameplay.hotkeysEnabled = !s.gameplay.hotkeysEnabled })}
                  />
                </div>
                <button type="button" className="btn ghost" onClick={() => setHotkeysOpen(true)}>
                  ⌨️ Personalizar atajos
                </button>
              </div>
            </div>
          )}

          {tab === 'otros' && (
            <div className="settings-section">
              <p className="muted">Otras opciones: próximamente.</p>
            </div>
          )}
        </div>
      </div>
      {hotkeysOpen && <HotkeysModal onClose={() => setHotkeysOpen(false)} />}
    </div>
  )
}
