import { useState } from 'react'
import AuroraBackground from './components/AuroraBackground'
import Avatar from './components/Avatar'
import Header from './components/Header'
import NonogramBoard from './components/NonogramBoard'
import { useMembers } from './lib/members'
import { findAvatar, NAME_MAX, suggest, validName } from './lib/profile'

interface Profile {
  id: string | null
  name: string
  avatar: string | null
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [draft, setDraft] = useState('')
  const { members } = useMembers()

  const match = findAvatar(draft, members)
  const hints = match ? [] : suggest(draft, members)

  const confirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validName(draft)) return
    const m = findAvatar(draft, members)
    setProfile({ id: m?.id ?? null, name: m?.name ?? draft.trim(), avatar: m?.avatar ?? null })
  }

  return (
    <>
      <AuroraBackground />
      {profile ? (
        <>
          <Header
            name={profile.name}
            avatar={profile.avatar}
            onLogout={() => {
              setProfile(null)
              setDraft('')
            }}
          />
          <main className="stage play">
            <NonogramBoard size={10} />
          </main>
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
    </>
  )
}
