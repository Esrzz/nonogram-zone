# Nonogram Zone

Nonogramas diarios, semanales y mensuales para la comunidad de Gaming Zone.
Misma estética que [Gaming Zone](https://github.com/Esrzz/gaming-zone) y Monopolio del Janeo (aurora violeta + estela del mouse).

## Estado
- Login simple: el nombre se cruza con los perfiles de Discord del Worker de Gaming Zone (`/api/members`); si no responde se usa `src/data/avatars.json`.
- Menú al elegir perfil: **Crear nonogramas**, **Resolver nonogramas** (aleatorio de 5×5 a 25×25, siempre de solución única y resoluble por lógica; también los guardados), **Mensual 50×50** (uno por mes, igual para todos) y **Carrera mundial 150×150** (edición 1). Los tableros grandes se recorren con zoom (hasta ×16).
- Perfil: **Mi historial** (botón en el menú) con los nonogramas resueltos (sin usar "Mostrar solución"), tiempo y mejor tiempo por tamaño; se guarda en el navegador por perfil (`nz-history:<perfil>`).
- Pistas: tocá un número para tacharlo; en Ajustes › Jugabilidad, "Tachado automático" tacha una fila/columna cuando lo pintado coincide con sus pistas (aunque no sea la solución).
- Trazo bloqueado (Ajustes › Jugabilidad › "Bloquear trazo", activado por defecto): al resolver, lo que pintás queda en la fila o columna de la primera celda, sin diagonales. Al crear el trazo es libre.
- "Autocompletar cruces" (Ajustes › Jugabilidad): al tachar todas las pistas de una fila/columna, o tocar una pista de una línea que ya coincide, se marcan con × sus celdas vacías; con el tachado automático también se completan solas.
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

### Contraseña de perfil

La primera vez que alguien entra con Discord, la página le pide crear una contraseña (obligatoria; mínimo 6 caracteres). Después, quien entre solo con el nombre de ese perfil tiene que ponerla; los nombres que nunca entraron con Discord siguen entrando libres. Se puede cambiar en Ajustes › Otros.

La contraseña vive en el Worker de Gaming Zone (`worker/src/passwords.js`, rutas `/nz/pw/*`): solo se guarda un hash PBKDF2 con sal en el KV (`pw:<id>`), con límite de 5 intentos fallidos cada 15 minutos por perfil. No hace falta ningún secreto nuevo, solo `wrangler deploy`.

## Semillas
Al crear un nonograma se muestra su **semilla** (`NZ1-<tamaño>-…`) con botón Copiar. En "Resolver nonogramas" hay un campo **Cargar semilla** para jugar la de otra persona.

## Multijugador (salas con código)
Desde el menú inicial: **Multijugador** → crear sala (código de 5 letras) o unirse con código. El host elige modo (por ahora **Cooperativo**), tamaño (hasta 50×50) y máximo de jugadores; cada jugador elige su color en el lobby. El chat queda a la derecha. Hace falta sesión iniciada.

Las salas corren en un Worker aparte con Durable Objects (`server/`):
```
cd server && npm install && npx wrangler deploy
```
- Variable `AUTH_API` (wrangler.jsonc): URL del Worker de Gaming Zone que valida sesiones (`/auth/me`).
- En la página, `VITE_ROOMS_URL` apunta al Worker de salas (por defecto `https://nonogram-rooms.gamingzone.workers.dev`).
- Prueba local: `npx wrangler dev --local` dentro de `server/`.
