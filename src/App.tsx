import { useEffect, useState } from 'react'
import AuroraBackground from './components/AuroraBackground'
import Avatar from './components/Avatar'
import Header from './components/Header'
import CreatePanel from './components/CreatePanel'
import Menu from './components/Menu'
import NonogramBoard from './components/NonogramBoard'
import SolvePanel from './components/SolvePanel'
import SettingsModal from './components/SettingsModal'
import { useMembers } from './lib/members'
import { generatePuzzle, monthlyPuzzle, worldRacePuzzle, WORLD_RACE_EDITION } from './lib/generator'
import type { Puzzle } from './lib/generator'
import { gridClues } from './lib/nonogram'
import { loadSaved, persistSaved, profileKey, stringToCells } from './lib/saved'
import type { SavedNonogram } from './lib/saved'
import { findAvatar, NAME_MAX, suggest, validName } from './lib/profile'
import { play as playSfx } from './lib/sfx'
import { useAudio } from './lib/useAudio'

interface Profile {
  id: string | null
  name: string
  avatar: string | null
}

type Screen = 'menu' | 'create' | 'solve'

/** Puzzle en pantalla en el modo resolver; `n` cambia con cada uno para reiniciar el tablero. */
interface Playing extends Puzzle {
  n: number
  label: string
  edition?: boolean
}

const SIZE_CREATE = 10
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [screen, setScreen] = useState<Screen>('menu')
  const [saved, setSaved] = useState<SavedNonogram[]>([])
  // Dibujo a cargar en el editor; `n` cambia para reiniciar el tablero con ese dibujo
  const [editor, setEditor] = useState<{ n: number; size: number; cells?: Uint8Array }>({ n: 0, size: SIZE_CREATE })
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { members } = useMembers()
  const { prefs, tracks, setMusicVolume, setSfxVolume, setTrack, startMusic } = useAudio()

  // Sonido de clic en cualquier botón habilitado (los botones con sonido propio lo evitan con data-nosound)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, a, [role="button"], input[type="checkbox"]')
      if (!el || (el as HTMLButtonElement).disabled || el.hasAttribute('data-nosound')) return
      playSfx('click')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const match = findAvatar(draft, members)
  const hints = match ? [] : suggest(draft, members)

  const confirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validName(draft)) return
    const m = findAvatar(draft, members)
    const p = { id: m?.id ?? null, name: m?.name ?? draft.trim(), avatar: m?.avatar ?? null }
    setProfile(p)
    setSaved(loadSaved(profileKey(p)))
    setScreen('menu')
    startMusic() // la música arranca con la primera interacción
  }

  const key = profile ? profileKey(profile) : ''

  const saveNonogram = (item: Omit<SavedNonogram, 'id' | 'createdAt'>): boolean => {
    const next = [{ ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() }, ...saved]
    if (!persistSaved(key, next)) return false
    setSaved(next)
    return true
  }
  const deleteNonogram = (id: string) => {
    const next = saved.filter((s) => s.id !== id)
    persistSaved(key, next)
    setSaved(next)
  }
  const editNonogram = (item: SavedNonogram) => {
    setEditor((e) => ({ n: e.n + 1, size: item.size, cells: stringToCells(item.cells) }))
    setScreen('create')
  }
  // Generar tableros grandes tarda un rato: se muestra "Generando…" y se deja pintar antes de calcular
  const start = (make: () => Puzzle, label: string, edition = false) => {
    setBusy(true)
    setTimeout(() => {
      const puzzle = make()
      setPlaying((p) => ({ ...puzzle, n: (p?.n ?? 0) + 1, label, edition }))
      setScreen('solve')
      setBusy(false)
    }, 30)
  }
  const newRandom = (size: number) => start(() => generatePuzzle(size), 'Aleatorio')
  const now = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const playMonthly = () => start(() => monthlyPuzzle(now.getFullYear(), now.getMonth() + 1), `Mensual · ${monthLabel}`, true)
  const playWorld = () => start(() => worldRacePuzzle(), `Carrera mundial · edición ${WORLD_RACE_EDITION}`, true)
  const playSaved = (item: SavedNonogram) => {
    const solution = stringToCells(item.cells)
    const { rows, cols } = gridClues(solution, item.size, item.size)
    setPlaying((p) => ({ size: item.size, solution, rows, cols, logic: item.logic, n: (p?.n ?? 0) + 1, label: item.name }))
    setScreen('solve')
  }

  return (
    <>
      <AuroraBackground />
      {profile ? (
        <>
          <Header
            name={profile.name}
            avatar={profile.avatar}
            onSettings={() => setSettingsOpen(true)}
            onMenu={screen === 'menu' ? undefined : () => setScreen('menu')}
            onLogout={() => {
              setProfile(null)
              setDraft('')
              setScreen('menu')
              setPlaying(null)
            }}
          />
          {screen === 'menu' && (
            <Menu
              savedCount={saved.length}
              onCreate={() => setScreen('create')}
              onSolve={() => (playing && !playing.edition ? setScreen('solve') : newRandom(10))}
              onMonthly={playMonthly}
              onWorld={playWorld}
              monthLabel={monthLabel}
            />
          )}
          {screen === 'create' && (
            <main className="stage play">
              <NonogramBoard key={`c${editor.n}`} size={editor.size} initialCells={editor.cells}>
                {(ctx) => (
                  <CreatePanel
                    ctx={ctx}
                    size={editor.size}
                    saved={saved}
                    onSave={saveNonogram}
                    onLoad={editNonogram}
                    onPlay={playSaved}
                    onDelete={deleteNonogram}
                  />
                )}
              </NonogramBoard>
            </main>
          )}
          {screen === 'solve' && playing && (
            <main className="stage play">
              <NonogramBoard key={`s${playing.n}`} size={playing.size} target={{ rows: playing.rows, cols: playing.cols }}>
                {(ctx) => (
                  <SolvePanel
                    ctx={ctx}
                    size={playing.size}
                    label={playing.label}
                    solution={playing.solution}
                    logic={playing.logic}
                    onNew={newRandom}
                    edition={playing.edition}
                  />
                )}
              </NonogramBoard>
            </main>
          )}
        </>
      ) : (
        <main className="stage">
          <div className="brandline">
            <div className="brand-top">Gaming Zone</div>
            <h1>Nonogram Zone</h1>
          </div>
          <form className="card" onSubmit={confirm}>
            <h2>¿Quién sos?</h2>
            <p className="muted">Escribí tu nombre de Discord para traer tu avatar, o elegí un nombre nuevo.</p>
            <div className="name-row">
              <Avatar name={draft || '?'} src={match?.avatar} size={52} />
              <input
                className="input"
                autoFocus
                maxLength={NAME_MAX}
                placeholder="Tu nombre"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Nombre de perfil"
              />
            </div>
            <p className="hint">
              {match ? `Perfil de Discord encontrado: ${match.name}` : ''}
            </p>
            {hints.length > 0 && (
              <ul className="suggest">
                {hints.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setDraft(m.name)}>
                      <Avatar name={m.name} src={m.avatar} size={28} />
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn primary" type="submit" disabled={!validName(draft)}>
              Entrar
            </button>
          </form>
        </main>
      )}
      {busy && <div className="gen-busy" role="status">Generando nonograma…</div>}
      {settingsOpen && (
        <SettingsModal
          musicVolume={prefs.musicVolume}
          sfxVolume={prefs.sfxVolume}
          tracks={tracks}
          trackFile={prefs.trackFile}
          onMusicVolume={setMusicVolume}
          onSfxVolume={setSfxVolume}
          onTrack={setTrack}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
