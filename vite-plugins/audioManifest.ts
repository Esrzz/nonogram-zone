import { createReadStream, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, basename, normalize, sep } from 'node:path'
import type { Plugin } from 'vite'

const EXTS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.webm'])

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
}

const url = (...parts: string[]) => '/audio/' + parts.map(encodeURIComponent).join('/')

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => EXTS.has(extname(f).toLowerCase()) && statSync(join(dir, f)).isFile())
    .sort((a, b) => a.localeCompare(b))
}

/** Nombre legible a partir del archivo: sin extensión ni sufijos de generación. */
function labelOf(file: string): string {
  return basename(file, extname(file)).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildManifest(root: string) {
  const audio = join(root, 'public', 'audio')
  const music = files(join(audio, 'Music')).map((f) => ({ file: url('Music', f), label: labelOf(f) }))
  const sfx: Record<string, string[]> = {}
  const sfxDir = join(audio, 'Efectos')
  if (existsSync(sfxDir)) {
    for (const name of readdirSync(sfxDir)) {
      if (!statSync(join(sfxDir, name)).isDirectory()) continue
      sfx[name] = files(join(sfxDir, name)).map((f) => url('Efectos', name, f))
    }
  }
  return { music, sfx }
}

/**
 * Genera `/audio/manifest.json` leyendo `public/audio/Music` (canciones de fondo) y
 * `public/audio/Efectos/<nombre>` (variantes de cada efecto). Agregar archivos alcanza:
 * aparecen solos en la configuración, sin tocar código.
 */
export default function audioManifest(): Plugin {
  let root = process.cwd()
  return {
    name: 'gz-audio-manifest',
    configResolved(c) {
      root = c.root
    },
    configureServer(server) {
      server.middlewares.use('/audio/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(buildManifest(root)))
      })
      // El servidor de Vite no decodifica "%23" (los archivos con "#" en el nombre darían 404):
      // los audios se sirven acá, con soporte de Range para que el navegador pueda buscar.
      const audioDir = join(root, 'public', 'audio')
      server.middlewares.use('/audio', (req, res, next) => {
        let rel: string
        try {
          rel = decodeURIComponent((req.url ?? '').split('?')[0])
        } catch {
          return next()
        }
        const file = normalize(join(audioDir, rel))
        const type = MIME[extname(file).toLowerCase()]
        if (!file.startsWith(audioDir + sep) || !type || !existsSync(file) || !statSync(file).isFile()) return next()
        const size = statSync(file).size
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
        res.setHeader('Content-Type', type)
        res.setHeader('Accept-Ranges', 'bytes')
        if (m) {
          const start = m[1] ? Number(m[1]) : 0
          const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Content-Length', end - start + 1)
          createReadStream(file, { start, end }).pipe(res)
        } else {
          res.setHeader('Content-Length', size)
          createReadStream(file).pipe(res)
        }
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'audio/manifest.json', source: JSON.stringify(buildManifest(root)) })
    },
  }
}
