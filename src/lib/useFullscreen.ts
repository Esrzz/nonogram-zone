import { useCallback, useEffect, useState } from 'react'

/** Pantalla completa del navegador. `supported` es false donde no existe la API (por ejemplo, iPhone). */
export function useFullscreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement)
  const supported = typeof document.documentElement.requestFullscreen === 'function'

  useEffect(() => {
    const h = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      /* el navegador la rechazó (hay que pedirla desde un clic) */
    }
  }, [])

  return { on, supported, toggle }
}
