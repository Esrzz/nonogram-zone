# Nonogram Zone

Nonogramas diarios, semanales y mensuales para la comunidad de Gaming Zone.
Misma estética que [Gaming Zone](https://github.com/Esrzz/gaming-zone) y Monopolio del Janeo (aurora violeta + estela del mouse).

## Estado
- Login simple: el nombre se cruza con los perfiles de Discord del Worker de Gaming Zone (`/api/members`); si no responde se usa `src/data/avatars.json`.
- Menú al elegir perfil: **Crear nonogramas**, **Resolver nonogramas** (aleatorio de 5×5 a 25×25, siempre de solución única y resoluble por lógica; también los guardados), **Mensual 50×50** (uno por mes, igual para todos) y **Carrera mundial 150×150** (edición 1). Los tableros grandes se recorren con zoom (hasta ×16).
- Pistas: tocá un número para tacharlo; en Ajustes › Jugabilidad, "Tachado automático" tacha una fila/columna cuando lo pintado coincide con sus pistas (aunque no sea la solución).
- Los nonogramas creados se guardan en el perfil (por ahora en el navegador, `src/lib/saved.ts`; luego irán con la cuenta de Google).
- Colores: Modo GZ (violeta) y Modo oscuro (negro y blanco), en Ajustes › Jugabilidad.
- Tablero de creación: se pinta la imagen (clic = rellenar, clic derecho = X, arrastrar = pintar) y las pistas se calculan en vivo.
- Barra lateral con el % pintado y el rango recomendado (45–65%).
- Botón "Verificar solución": solver por líneas + búsqueda (`src/lib/nonogram.ts`); dice si es única, múltiple o sin solución y si se resuelve solo por lógica.
- Ajustes (⚙): video (pantalla completa), audio (volúmenes y canciones en `public/audio/Music`), jugabilidad (tamaño de interfaz, instrucciones de ambos lados, atajos sin definir).
- `npm test` corre los tests del solver; `npx vite-node scripts/density.ts` mide qué % pintado da puzzles de solución única.

## Desarrollo
```
npm install
npm run dev
npm run build
```
Para apuntar a otro Worker: `VITE_API_URL=https://... npm run dev`.

## Inicio de sesión con Discord

Usa el mismo inicio de sesión de Gaming Zone (el Worker `gaming-zone-api`). El botón manda a `/auth/login?return=<esta página>`; Discord vuelve al Worker y este te devuelve acá con una sesión firmada (se guarda en `localStorage`, clave `nz-session`). Sin sesión se puede entrar como invitado con un nombre.

Para que el Worker acepte esta página hay que aplicar `docs/worker-multi-sitio.patch` en el repo de Gaming Zone (`git apply`, desde la raíz) y:
1. En `worker/wrangler.jsonc` → `vars`: `"EXTRA_SITES": "https://TU-NONOGRAM-ZONE"` (varios separados por coma; para probar en local sumá `http://localhost:5173`).
2. En el portal de Discord no hace falta nada nuevo: la URL de retorno sigue siendo la del Worker (`/auth/callback`).
3. `npx wrangler deploy` en `worker`.

El parche también hace que el Worker responda CORS a esas páginas (hoy `ALLOWED_ORIGIN` permite una sola).
