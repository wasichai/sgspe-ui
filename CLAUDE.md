# CLAUDE.md

Guía para agentes en `sgspe-ui`. El diseño vive en el repositorio `sgspe` (`../sgspe/docs/`): la interfaz es `docs/ux/`
(arquitectura de UX, design system, tokens, pantallas y flujos; gana sobre `docs/architecture.md` §9 donde difieren) y
ADR-0024; la seguridad, `docs/security.md` §3.2 y §5.10.

## Reglas

- Textos de interfaz en español (es-PE) e inglés, en `src/portal/textos/es.ts` y `en.ts` con las mismas claves; código y
  rutas propias en inglés (ADR-0009).
- Ningún nombre de rol en `src/` fuera de las pruebas: se decide con `useAuth().isAdmin` y los permisos de
  `/api/auth/me/permissions` (`src/boundaries.test.ts`). `@wasichai/*` se importa solo por la raíz de cada paquete.
- `/admin` registra solo los módulos de los starters instalados en `sgspe` y nunca `agentModule()`.
- Una sección nueva se registra en `src/portal/pantallas.ts` con su pantalla; sin pantalla no se dibuja. Un inicio por rol
  se registra en `src/portal/inicios.ts` con los permisos que lo ofrecen.
- Colores, tipografía, radios y sombras solo con los tokens `sg-*` de `src/theme/tokens.css`; si `docs/ux/tokens.css`
  cambia, se copia de nuevo y se verifica con `cmp`.
- Pruebas primero, con Vitest, Testing Library y `mockFetch` de `@wasichai/testing`; usuarios ficticios `@sgspe.test`.
- Conventional Commits en español; `git add` con rutas explícitas.
- `yarn format && yarn lint && yarn typecheck && yarn test && yarn build` antes de cada commit.
- Instalar con `NODE_AUTH_TOKEN=$(gh auth token) yarn install`; ningún token en archivos del repositorio.
