import Avatar from './Avatar'

interface Props {
  name: string
  avatar: string | null
  onLogout: () => void
  onSettings: () => void
  /** Volver al menú (crear / resolver) */
  onMenu?: () => void
}

export default function Header({ name, avatar, onLogout, onSettings, onMenu }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span>Nonogram Zone</span>
      </div>
      <div className="topbar-right">
        {onMenu && (
          <button className="link" onClick={onMenu}>
            Menú
          </button>
        )}
        <button className="link" onClick={onLogout}>
          Cambiar perfil
        </button>
        <button className="topbar-settings" onClick={onSettings} aria-label="Configuraciones">
          ⚙
        </button>
        <div className="topbar-user">
          <Avatar name={name} src={avatar} size={32} />
          <strong>{name}</strong>
        </div>
      </div>
    </header>
  )
}
