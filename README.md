# Nonogram Zone

Nonogramas diarios, semanales y mensuales para la comunidad de Gaming Zone.
Misma estética que [Gaming Zone](https://github.com/Esrzz/gaming-zone) y Monopolio del Janeo (aurora violeta + estela del mouse).

## Estado
- Login simple: el nombre se cruza con los perfiles de Discord del Worker de Gaming Zone (`/api/members`); si no responde se usa `src/data/avatars.json`.
- Menú al elegir perfil: **Crear nonogramas** o **Resolver nonogramas** (aleatorio 5×5 / 10×10 / 15×15, siempre de solución única; también se pueden resolver los guardados).
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
