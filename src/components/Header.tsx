import Avatar from './Avatar'

interface Props {
  name: string
  avatar: string | null
  onLogout: () => void
}

export default function Header({ name, avatar, onLogout }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span>Nonogram Zone</span>
      </div>
      <div className="topbar-right">
        <button className="link" onClick={onLogout}>
          Cambiar perfil
        </button>
        <div className="topbar-user">
          <Avatar name={name} src={avatar} size={32} />
          <strong>{name}</strong>
        </div>
      </div>
    </header>
  )
}
