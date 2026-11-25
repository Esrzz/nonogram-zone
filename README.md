# Nonogram Zone

Nonogramas diarios, semanales y mensuales para la comunidad de Gaming Zone.
Misma estética que [Gaming Zone](https://github.com/Esrzz/gaming-zone) y Monopolio del Janeo (aurora violeta + estela del mouse).

## Estado
- Login simple: el nombre se cruza con los perfiles de Discord del Worker de Gaming Zone (`/api/members`); si no responde se usa `src/data/avatars.json`.
- Tablero vacío para ajustar estilos (clic = rellenar, clic derecho = X, arrastrar = pintar).

## Desarrollo
```
npm install
npm run dev
npm run build
```
Para apuntar a otro Worker: `VITE_API_URL=https://... npm run dev`.
