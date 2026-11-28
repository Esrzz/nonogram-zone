import { describe, expect, it } from 'vitest'
import { BINDING_RE, bindingLabel, keyBinding, mouseBinding } from './hotkeys'

const none = { ctrlKey: false, shiftKey: false, altKey: false }
describe('hotkeys', () => {
  it('arma y valida atajos', () => {
    expect(keyBinding({ code: 'KeyZ', ...none, ctrlKey: true })).toBe('Ctrl+KeyZ')
    expect(keyBinding({ code: 'ShiftLeft', ...none, shiftKey: true })).toBeNull()
    expect(mouseBinding({ button: 3, ...none })).toBe('Mouse3')
    expect(mouseBinding({ button: 0, ...none })).toBeNull()
    expect(mouseBinding({ button: 1, ...none })).toBeNull()
    for (const b of ['Mouse3', 'Ctrl+KeyZ', 'Backspace', 'Shift+Alt+F5']) expect(BINDING_RE.test(b)).toBe(true)
    for (const b of ['', 'Mouse0', 'x y', '<script>']) expect(BINDING_RE.test(b)).toBe(false)
  })
  it('etiquetas legibles', () => {
    expect(bindingLabel('Mouse3')).toBe('Botón lateral (atrás)')
    expect(bindingLabel('Ctrl+KeyZ')).toBe('Ctrl + Z')
  })
})
