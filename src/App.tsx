import { useEffect, useState } from 'react'
import AuroraBackground from './components/AuroraBackground'
import Avatar from './components/Avatar'
import Header from './components/Header'
import CreatePanel from './components/CreatePanel'
import Menu from './components/Menu'
import NonogramBoard from './components/NonogramBoard'
import SolvePanel from './components/SolvePanel'
import PasswordModal from './components/PasswordModal'
import HistoryPanel from './components/HistoryPanel'
import SettingsModal from './components/SettingsModal'
import { useMembers } from './lib/members'
import { pwHasPassword, pwLogin, pwStatus } from './lib/password'
import { checkSession, consumeLoginFragment, LOGIN_ERRORS, loginUrl, readToken, sessionFromToken, storeToken } from './lib/auth'
import { generatePuzzle, monthlyPuzzle, worldRacePuzzle, WORLD_RACE_EDITION } from './lib/generator'
import type { Puzzle } from './lib/generator'
import { gridClues } from './lib/nonogram'
import { loadHistory, persistHistory } from './lib/history'
import type { HistoryEntry, HistoryKind } from './lib/history'
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

type Screen = 'menu' | 'create' | 'solve' | 'history'

/** Puzzle en pantalla en el modo resolver; `n` cambia con cada uno para reiniciar el tablero. */
interface Playing extends Puzzle {
  n: number
  label: string
  kind: HistoryKind
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
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // Sesión con Discord (vía el Worker de Gaming Zone); si no hay, se puede entrar escribiendo un nombre
  const [token, setToken] = useState<string | null>(() => readToken())
  const [loginError, setLoginError] = useState<string | null>(null)
  const session = sessionFromToken(token)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Contraseña de perfil: se pide al entrar con solo el nombre de un perfil protegido; se crea tras el primer login con Discord
  const [pwStep, setPwStep] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwModal, setPwModal] = useState<'create' | 'change' | null>(null)
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

  // Al volver de Discord
  useEffect(() => {
    const r = consumeLoginFragment()
    if (!r) return
    if (r.token && sessionFromToken(r.token)) {
      storeToken(r.token)
      setToken(r.token)
    } else setLoginError(LOGIN_ERRORS[r.error ?? ''] ?? LOGIN_ERRORS.exchange)
  }, [])

  // Si el Worker dice que la sesión ya no vale, se cierra
  useEffect(() => {
    if (!token) return
    let off = false
    checkSession(token).then((ok) => {
      if (!ok && !off) {
        storeToken(null)
        setToken(null)
        setLoginError('Tu sesión venció. Iniciá sesión de nuevo.')
      }
    })
    return () => {
      off = true
    }
  }, [token])

  // Con sesión, el perfil sale de Discord (el avatar llega cuando carga la lista de miembros)
  useEffect(() => {
    if (!session) return
    const m = members.find((x) => x.id === session.id)
    const p = { id: session.id, name: m?.name ?? session.name, avatar: m?.avatar ?? null }
    setProfile((cur) => (cur && cur.id === p.id && cur.name === p.name && cur.avatar === p.avatar ? cur : p))
    if (profile?.id !== session.id) setSaved(loadSaved(profileKey(p)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.name, members])

  const match = findAvatar(draft, members)
  const hints = match ? [] : suggest(draft, members)

  // Si la sesión no tiene contraseña todavía, hay que crearla (obligatorio)
  useEffect(() => {
    if (!token) return
    let off = false
    pwHasPassword(token).then((set) => {
      if (!off && set === false) setPwModal('create')
    })
    return () => {
      off = true
    }
  }, [token])

  const logout = () => {
    storeToken(null)
    setToken(null)
    setProfile(null)
    setPwModal(null)
    setSettingsOpen(false)
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validName(draft) || pwBusy) return
    setPwBusy(true)
    setPwError(null)
    if (pwStep) {
      // Perfil protegido: nombre + contraseña → sesión del Worker
      const r = await pwLogin(draft.trim(), pw)
      setPwBusy(false)
      if (r.ok) {
        storeToken(r.token)
        setToken(r.token)
        setPw('')
        setPwStep(false)
        setScreen('menu')
        startMusic()
        return
      }
      setPwError(
        r.why === 'locked' ? 'Demasiados intentos. Probá de nuevo en 15 minutos.'
          : r.why === 'wrong' ? `Contraseña incorrecta${r.left !== undefined ? ` (${r.left} intento${r.left === 1 ? '' : 's'} más)` : ''}.`
          : 'No se pudo comprobar ahora. Probá de nuevo en un rato.',
      )
      return
    }
    const st = await pwStatus(draft.trim())
    setPwBusy(false)
    if (st?.protected) {
      setPwStep(true)
      return
    }
    const m = findAvatar(draft, members)
    const p = { id: m?.id ?? null, name: m?.name ?? draft.trim(), avatar: m?.avatar ?? null }
    setProfile(p)
    setSaved(loadSaved(profileKey(p)))
    setScreen('menu')
    startMusic() // la música arranca con la primera interacción
  }

  const key = profile ? profileKey(profile) : ''
  useEffect(() => {
    setHistory(key ? loadHistory(key) : [])
  }, [key])
  const addHistory = (e: Omit<HistoryEntry, 'id' | 'at'>) => {
    const next = [{ ...e, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }, ...history]
    persistHistory(key, next)
    setHistory(next)
  }

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
  const start = (make: () => Puzzle, label: string, kind: HistoryKind) => {
    setBusy(true)
    setTimeout(() => {
      const puzzle = make()
      setPlaying((p) => ({ ...puzzle, n: (p?.n ?? 0) + 1, label, kind, edition: kind === 'monthly' || kind === 'world' }))
      setScreen('solve')
      setBusy(false)
    }, 30)
  }
  const newRandom = (size: number) => start(() => generatePuzzle(size), 'Aleatorio', 'random')
  const now = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const playMonthly = () => start(() => monthlyPuzzle(now.getFullYear(), now.getMonth() + 1), `Mensual · ${monthLabel}`, 'monthly')
  const playWorld = () => start(() => worldRacePuzzle(), `Carrera mundial · edición ${WORLD_RACE_EDITION}`, 'world')
  const playSaved = (item: SavedNonogram) => {
    const solution = stringToCells(item.cells)
    const { rows, cols } = gridClues(solution, item.size, item.size)
    setPlaying((p) => ({ size: item.size, solution, rows, cols, logic: item.logic, n: (p?.n ?? 0) + 1, label: item.name, kind: 'saved' }))
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
              storeToken(null)
              setToken(null)
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
              onHistory={() => setScreen('history')}
              solvedCount={history.length}
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
          {screen === 'history' && (
            <HistoryPanel
              name={profile.name}
              list={history}
              onClear={() => {
                persistHistory(key, [])
                setHistory([])
              }}
            />
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
                    onSolved={(ms) => addHistory({ label: playing.label, size: playing.size, kind: playing.kind, ms })}
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
            <a className="btn primary discord" href={loginUrl()}>Iniciar sesión con Discord</a>
            {loginError && <p className="err" role="alert">{loginError}</p>}
            <div className="or"><span>o entrá como invitado</span></div>
            <p className="muted">Escribí tu nombre de Discord para traer tu avatar, o elegí un nombre nuevo.</p>
            <div className="name-row">
              <Avatar name={draft || '?'} src={match?.avatar} size={52} />
              <input
                className="input"
                autoFocus
                maxLength={NAME_MAX}
                placeholder="Tu nombre"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setPwStep(false)
                  setPwError(null)
                }}
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
            {pwStep && (
              <>
                <p className="muted">Ese perfil tiene contraseña. Escribila para entrar sin Discord.</p>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Contraseña"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  aria-label="Contraseña del perfil"
                />
              </>
            )}
            {pwError && <p className="err" role="alert">{pwError}</p>}
            <button className="btn primary" type="submit" disabled={!validName(draft) || pwBusy || (pwStep && !pw)}>
              {pwBusy ? 'Comprobando…' : 'Entrar'}
            </button>
          </form>
        </main>
      )}
      {pwModal && token && (
        <PasswordModal
          mode={pwModal}
          token={token}
          onDone={() => setPwModal(null)}
          onCancel={pwModal === 'create' ? logout : () => setPwModal(null)}
          onSessionLost={() => {
            logout()
            setLoginError('Tu sesión venció. Iniciá sesión de nuevo.')
          }}
        />
      )}
      {busy && <div className="gen-busy" role="status">Generando nonograma…</div>}
      {settingsOpen && (
        <SettingsModal
          canChangePassword={!!token}
          onChangePassword={() => {
            setSettingsOpen(false)
            setPwModal('change')
          }}
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
