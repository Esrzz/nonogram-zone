import { getSettings, subscribeSettings } from './settingsStore'

/**
 * Tamaño de la interfaz (Configuración › Jugabilidad): funciona como el zoom del navegador.
 * Se aplica `zoom` a toda la página y se publican `--vw` y `--vh` (1% del ancho/alto REAL de la ventana,
 * ya "des-zoomeados") que el CSS usa en lugar de `vw`/`vh`, para que el tablero siga ocupando la pantalla.
 */
function apply() {
  const z = getSettings().gameplay.uiScale / 100
  const root = document.documentElement
  if (z === 1) root.style.removeProperty('zoom')
  else root.style.setProperty('zoom', String(z))
  root.style.setProperty('--vw', `${window.innerWidth / z / 100}px`)
  root.style.setProperty('--vh', `${window.innerHeight / z / 100}px`)
}

export function initUiScale() {
  apply()
  subscribeSettings(apply)
  window.addEventListener('resize', apply)
}
