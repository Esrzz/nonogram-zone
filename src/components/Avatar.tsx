import { useState } from 'react'

interface Props {
  name: string
  src?: string | null
  size?: number
}

function hue(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

/** Avatar de Discord si existe; si no, inicial sobre degradé de color. */
export default function Avatar({ name, src, size = 48 }: Props) {
  const [failed, setFailed] = useState(false)
  const showImg = src && !failed
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, ['--h' as string]: hue(name) }}
    >
      {showImg ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        (name.trim()[0] ?? '?').toUpperCase()
      )}
    </span>
  )
}
