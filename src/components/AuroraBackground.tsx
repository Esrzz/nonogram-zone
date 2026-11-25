import { useEffect, useRef } from 'react'

// Fondo de Gaming Zone (igual que en Monopolio del janeo): manchas de luz violeta que derivan solas, cortinas tipo
// aurora que se curvan hacia el mouse y una estela que lo sigue con retraso.

const BLOBS = [
  { x: 0.18, y: 0.22, r: 0.55, c: '109,40,217', a: 0.36, sx: 0.00018, sy: 0.00013, p: 0.0, depth: 0.1 },
  { x: 0.82, y: 0.18, r: 0.5, c: '139,92,246', a: 0.26, sx: 0.00014, sy: 0.0002, p: 1.7, depth: 0.14 },
  { x: 0.5, y: 0.82, r: 0.62, c: '76,29,149', a: 0.42, sx: 0.00012, sy: 0.00016, p: 3.1, depth: 0.08 },
  { x: 0.9, y: 0.78, r: 0.38, c: '217,70,239', a: 0.13, sx: 0.00022, sy: 0.00012, p: 4.4, depth: 0.18 },
  { x: 0.08, y: 0.86, r: 0.3, c: '34,211,238', a: 0.07, sx: 0.00017, sy: 0.00021, p: 5.2, depth: 0.2 },
]

const CURTAINS = [
  { y: 0.3, a: 0.07, f: 0.0042, s: 0.00042, p: 0.4, c: '139,92,246', op: 1, w: 1.0 },
  { y: 0.46, a: 0.09, f: 0.0031, s: 0.00033, p: 2.2, c: '167,139,250', op: 0.8, w: 1.25 },
  { y: 0.62, a: 0.06, f: 0.0051, s: 0.0005, p: 4.1, c: '217,70,239', op: 0.55, w: 0.9 },
  { y: 0.2, a: 0.05, f: 0.0027, s: 0.00028, p: 5.6, c: '34,211,238', op: 0.35, w: 0.8 },
]

// [ancho de línea, opacidad]: capas apiladas simulan un borde suave
const LAYERS: [number, number][] = [
  [150, 0.035],
  [96, 0.05],
  [52, 0.07],
  [20, 0.09],
]

const TRAIL_LEN = 28

export default function AuroraBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let raf = 0
    const mouse = { x: 0.55, y: 0.4, tx: 0.55, ty: 0.4 }
    const trail = Array.from({ length: TRAIL_LEN }, () => ({ x: 0, y: 0 }))

    const draw = (t: number) => {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#0a0517'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      mouse.x += (mouse.tx - mouse.x) * 0.05
      mouse.y += (mouse.ty - mouse.y) * 0.05
      const mx = mouse.x * w
      const my = mouse.y * h
      const big = Math.max(w, h)

      for (const b of BLOBS) {
        const bx = (b.x + Math.sin(t * b.sx + b.p) * 0.08 + (mouse.x - 0.5) * b.depth) * w
        const by = (b.y + Math.cos(t * b.sy + b.p) * 0.08 + (mouse.y - 0.5) * b.depth) * h
        const r = b.r * big
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r)
        g.addColorStop(0, `rgba(${b.c},${b.a})`)
        g.addColorStop(1, `rgba(${b.c},0)`)
        ctx.fillStyle = g
        ctx.fillRect(bx - r, by - r, r * 2, r * 2)
      }

      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (const c of CURTAINS) {
        const pts: number[] = []
        for (let x = -40; x <= w + 40; x += 30) {
          let y =
            h * c.y +
            Math.sin(x * c.f + t * c.s + c.p) * h * c.a +
            Math.sin(x * c.f * 2.3 - t * c.s * 1.4) * h * c.a * 0.35
          const d = (x - mx) / (w * 0.22)
          y += (my - y) * Math.exp(-d * d) * 0.24
          pts.push(x, y)
        }
        for (const [lw, al] of LAYERS) {
          ctx.beginPath()
          ctx.moveTo(pts[0], pts[1])
          for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
          ctx.lineWidth = lw * c.w
          ctx.strokeStyle = `rgba(${c.c},${al * c.op})`
          ctx.stroke()
        }
      }

      if (reduce) return

      trail[0].x += (mx - trail[0].x) * 0.3
      trail[0].y += (my - trail[0].y) * 0.3
      for (let i = 1; i < TRAIL_LEN; i++) {
        trail[i].x += (trail[i - 1].x - trail[i].x) * 0.34
        trail[i].y += (trail[i - 1].y - trail[i].y) * 0.34
      }
      for (let i = 1; i < TRAIL_LEN; i++) {
        const k = 1 - i / TRAIL_LEN
        ctx.beginPath()
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
        ctx.lineTo(trail[i].x, trail[i].y)
        ctx.lineWidth = 44 * k
        ctx.strokeStyle = `rgba(124,58,237,${0.1 * k})`
        ctx.stroke()
        ctx.lineWidth = 12 * k
        ctx.strokeStyle = `rgba(232,121,249,${0.22 * k})`
        ctx.stroke()
      }
      const hx = trail[0].x
      const hy = trail[0].y
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 150)
      g.addColorStop(0, 'rgba(167,139,250,0.2)')
      g.addColorStop(1, 'rgba(167,139,250,0)')
      ctx.fillStyle = g
      ctx.fillRect(hx - 150, hy - 150, 300, 300)
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      trail.forEach((p) => {
        p.x = w * mouse.x
        p.y = h * mouse.y
      })
      if (reduce) draw(0)
    }

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / w
      mouse.ty = e.clientY / h
    }

    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true })
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={ref} className="aurora" aria-hidden="true" />
}
