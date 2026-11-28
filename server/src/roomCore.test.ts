import { describe, expect, it } from 'vitest'
import { RoomCore } from './roomCore'
import type { Out } from './roomCore'
import { gridClues } from '../../src/lib/nonogram'

const sol5 = '1010000100111111000110001' // 5×5
const mk = () => {
  const r = RoomCore.create('ABCDE', { id: 'a', name: 'Ana' })
  r.join('a', 'Ana')
  r.join('b', 'Beto')
  return r
}
const cells = (outs: Out[]) => outs.filter((o) => o.msg.t === 'cells').flatMap((o) => (o.msg as { c: number[][] }).c)
const start = (r: RoomCore, size = 5, sol = sol5) => {
  r.handle('a', { t: 'config', config: { size } })
  return r.handle('a', { t: 'start', solution: sol })
}

describe('RoomCore', () => {
  it('asigna colores distintos y respeta el máximo de jugadores', () => {
    const r = mk()
    expect(r.d.players.map((p) => p.color)).toEqual([0, 1])
    const c = r.join('c', 'Cami')
    expect(c.ok).toBe(false)
    expect(c.out[0].msg).toMatchObject({ t: 'error', code: 'full' })
    r.handle('a', { t: 'config', config: { maxPlayers: 3 } })
    expect(r.join('c', 'Cami').ok).toBe(true)
  })

  it('el color no se puede repetir ni salir de la paleta', () => {
    const r = mk()
    r.handle('b', { t: 'color', color: 0 })
    expect(r.d.players[1].color).toBe(1)
    r.handle('b', { t: 'color', color: 5 })
    expect(r.d.players[1].color).toBe(5)
    r.handle('b', { t: 'color', color: 99 })
    expect(r.d.players[1].color).toBe(5)
  })

  it('solo el anfitrión configura, con tamaños válidos hasta 50', () => {
    const r = mk()
    r.handle('b', { t: 'config', config: { size: 20 } })
    expect(r.d.config.size).toBe(10)
    r.handle('a', { t: 'config', config: { size: 50 } })
    expect(r.d.config.size).toBe(50)
    r.handle('a', { t: 'config', config: { size: 60 } })
    r.handle('a', { t: 'config', config: { size: 13 } })
    expect(r.d.config.size).toBe(50)
    r.handle('a', { t: 'config', config: { maxPlayers: 9 } })
    expect(r.d.config.maxPlayers).toBe(4)
    r.handle('a', { t: 'config', config: { maxPlayers: 1 } })
    expect(r.d.config.maxPlayers).toBe(2)
  })

  it('empezar valida la solución y manda las pistas, no la solución', () => {
    const r = mk()
    r.handle('a', { t: 'config', config: { size: 5 } })
    expect(r.handle('b', { t: 'start', solution: sol5 })).toEqual([])
    expect(r.handle('a', { t: 'start', solution: '101' })[0].msg).toMatchObject({ t: 'error', code: 'bad' })
    start(r)
    expect(r.d.phase).toBe('playing')
    const snap = JSON.stringify(r.snapshot())
    expect(snap).not.toContain(sol5)
    expect(r.snapshot().game!.rows).toEqual(gridClues(Array.from(sol5, Number), 5, 5).rows)
    expect(r.join('z', 'Nuevo').ok).toBe(false) // ya empezó
  })

  it('pintar: cada celda queda con el color de quien la pintó y se detecta el final', () => {
    const r = mk()
    start(r)
    const ones = Array.from(sol5, Number).flatMap((v, i) => (v === 1 ? [i] : []))
    const half = Math.ceil(ones.length / 2)
    const o1 = r.handle('a', { t: 'paint', c: ones.slice(0, half).map((i) => [i, 1] as [number, number]) })
    expect(cells(o1).every((c) => c[2] === 1)).toBe(true)
    expect(r.d.phase).toBe('playing')
    const o2 = r.handle('b', { t: 'paint', c: ones.slice(half).map((i) => [i, 1] as [number, number]) })
    expect(cells(o2).every((c) => c[2] === 2)).toBe(true)
    expect(r.d.phase).toBe('done')
    expect(o2.some((o) => o.msg.t === 'done')).toBe(true)
  })

  it('ignora celdas inválidas, repetidas y las cruces no cuentan para terminar', () => {
    const r = mk()
    start(r)
    expect(r.handle('a', { t: 'paint', c: [[-1, 1], [999, 1], [0, 7], [1.5, 1]] as [number, number][] })).toEqual([])
    expect(cells(r.handle('a', { t: 'paint', c: [[0, 2]] }))).toEqual([[0, 2, 1]])
    expect(r.handle('a', { t: 'paint', c: [[0, 2]] })).toEqual([]) // sin cambios
    expect(r.d.phase).toBe('playing')
  })

  it('no se puede borrar ni pisar lo pintado por otro jugador; sí lo propio', () => {
    const r = mk()
    start(r)
    r.handle('a', { t: 'paint', c: [[3, 1]] })
    const bad = r.handle('b', { t: 'paint', c: [[3, 0]] })
    expect(bad).toEqual([{ to: 'b', msg: { t: 'cells', c: [[3, 1, 1]] } }]) // se le devuelve el valor real
    expect(r.handle('b', { t: 'paint', c: [[3, 2]] })).toHaveLength(1)
    expect(r.d.game!.cells[3]).toBe(1)
    expect(cells(r.handle('a', { t: 'paint', c: [[3, 0]] }))).toEqual([[3, 0, 0]])
  })

  it('chat: recorta, limita la frecuencia y guarda solo los últimos', () => {
    const r = mk()
    expect(r.handle('a', { t: 'chat', text: '   ' }, 1000)).toEqual([])
    expect(r.handle('a', { t: 'chat', text: 'hola' }, 1000)).toHaveLength(1)
    expect(r.handle('a', { t: 'chat', text: 'otra' }, 1100)).toEqual([]) // muy seguido
    const long = r.handle('a', { t: 'chat', text: 'x'.repeat(1000) }, 5000)
    expect((long[0].msg as { msg: { text: string } }).msg.text).toHaveLength(300)
    for (let i = 0; i < 150; i++) r.handle('b', { t: 'chat', text: `m${i}` }, 10_000 + i * 1000)
    expect(r.d.chat.length).toBe(100)
  })

  it('si se va el anfitrión pasa al siguiente; en el lobby quien se va sale; en partida puede volver', () => {
    const r = mk()
    r.leave('a')
    expect(r.d.hostId).toBe('b')
    expect(r.d.players.map((p) => p.id)).toEqual(['b'])
    r.join('a', 'Ana')
    start(r.d.hostId === 'b' ? (r as RoomCore) : r) // b es el anfitrión
    r.handle('b', { t: 'config', config: { size: 5 } })
    const r2 = mk()
    start(r2)
    r2.leave('b')
    expect(r2.d.players.find((p) => p.id === 'b')?.connected).toBe(false)
    expect(r2.join('b', 'Beto').ok).toBe(true)
    expect(r2.connectedCount).toBe(2)
  })

  it('volver al lobby limpia la partida; la sala se guarda y se restaura', () => {
    const r = mk()
    start(r)
    r.handle('a', { t: 'back' })
    expect(r.d.phase).toBe('lobby')
    expect(r.d.game).toBeNull()
    const copy = new RoomCore(JSON.parse(JSON.stringify(r.toJSON())))
    expect(copy.snapshot(1)).toEqual(r.snapshot(1))
  })
})
