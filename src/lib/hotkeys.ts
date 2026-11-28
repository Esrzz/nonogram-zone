/**
 * Atajos: una tecla (con Ctrl/Shift/Alt opcionales) o un botón extra del mouse.
 * Se guardan como texto: "Ctrl+KeyZ", "Mouse3" (botón lateral "atrás"), "Mouse4" ("adelante"). Los botones 0–2 (izquierdo,
 * rueda, derecho) no se pueden asignar: ya se usan para pintar y mover.
 */
export const BINDING_RE = /^((Ctrl|Shift|Alt)\+){0,3}(Mouse[3-9]|(?!Mouse)[A-Za-z][A-Za-z0-9]{0,19}|[0-9])$/

export const MODIFIER_CODES = ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']

const mods = (e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) =>
  `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}`

/** Texto del atajo para un evento de teclado (null si es solo una tecla modificadora) */
export function keyBinding(e: { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): string | null {
  if (MODIFIER_CODES.includes(e.code) || !e.code) return null
  return mods(e) + e.code
}

/** Texto del atajo para un botón del mouse (null si es izquierdo, rueda o derecho) */
export function mouseBinding(e: { button: number; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): string | null {
  return e.button >= 3 && e.button <= 9 ? `${mods(e)}Mouse${e.button}` : null
}

export const isMouseBinding = (b: string) => /Mouse[3-9]$/.test(b)

export function bindingLabel(b: string): string {
  const parts = b.split('+')
  const main = parts.pop() ?? ''
  const name =
    main === 'Mouse3' ? 'Botón lateral (atrás)'
    : main === 'Mouse4' ? 'Botón lateral (adelante)'
    : /^Mouse\d$/.test(main) ? `Botón ${Number(main.slice(5)) + 1} del mouse`
    : main.startsWith('Key') ? main.slice(3)
    : main.startsWith('Digit') ? main.slice(5)
    : main
  return [...parts, name].join(' + ')
}
