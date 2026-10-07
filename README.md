# sgspe-ui

Interfaz web de **SGSPE** (Sistema de Gestión Social para Proyectos Extractivos) sobre **wasichai-ui** (`@wasichai/*`
0.5.0), para el backend [`sgspe`](https://github.com/wasichai/sgspe), donde viven el diseño y la documentación. Es una
sola app Vite + React con dos partes que comparten el login (el mismo token en `localStorage['sgspe.token']`), el tema y
el idioma:

| Ruta | Para quién | Qué es |
|---|---|---|
| `/` | el equipo social | el **portal**: las 13 secciones de `docs/ux` de `sgspe`, cada una con su fase; en F1, la bienvenida |
| `/admin` | quien administra | el `WasichaiApp` de wasichai-ui con views, forms y pages |

| | |
|---|---|
| Puerto | 5182 (`yarn dev` y `yarn preview`) |
| API | proxy de `/api` a `http://localhost:8094` (`WASICHAI_API_URL` lo cambia) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (semilla de `sgspe`) |

## Portal (`src/portal`)

- **Sesión:** la de core (`useAuth`), la misma de `/admin`. `RequireSession` lleva a `/login?next=…` sin sesión;
  `safeNext` acepta solo rutas internas (rechaza `//`, `/\` y los caracteres de control). Un 401 vuelve al login.
- **Diseño:** sigue `docs/ux/` de `sgspe` (arquitectura de UX, design system, tokens y fichas de pantalla), que gana sobre
  `docs/architecture.md` §9.2 donde difieren.
- **Navegación:** `src/portal/shell/navTree.ts` declara las 13 secciones de `docs/ux/ux-architecture.md` §6.2, en su orden,
  con su ruta, su ícono y su fase. Una sección se dibuja solo si tiene pantalla (`src/portal/pantallas.ts`) y la cuenta
  tiene los permisos que pide (`GET /api/auth/me/permissions`); Administración, solo para quien administra. El asistente
  no es una sección: es el botón «Preguntar» de la barra superior, deshabilitado hasta F7.
- **Contexto:** `src/portal/shell/context.ts` lee de la URL el alcance (global o `/projects/:projectId`) y el chip de
  territorio (`?territory=`); el selector de proyecto y la `ContextBar` lo usan desde F2.
- **Inicio:** en F1, la bienvenida con cuenta, organización, roles y mapa de módulos por fase, sin indicadores. El inicio
  por rol se registra en `src/portal/inicios.ts` con los permisos que lo ofrecen, nunca con nombres de rol.
- **Idioma:** español por defecto e inglés (`src/portal/textos/`), con números y fechas es-PE. La elección se comparte con
  `/admin`: se guarda en `sgspe.lang` y en las preferencias del usuario (`useSetLocale` de core), y `<html lang>` la sigue
  en las dos apps (`es-PE` para el español).
- **Temas:** «Pino y piedra» en claro y oscuro. `src/theme/tokens.css` es copia exacta de `docs/ux/tokens.css` (se compara
  con `cmp`, prettier no la toca) y `src/theme/wasichai.css` lee de ella los tokens de `@wasichai/ui`; IBM Plex Sans y Mono
  vienen de `@fontsource/*` y se sirven desde el mismo origen. Dentro de `cn()`, el cuerpo se escribe `text-sm`, no
  `text-sg-body`. El script de arranque de `index.html` es el único script en línea; `csp.ts` arma la CSP con su hash,
  Vite la manda en modo de solo informe y `yarn csp` la imprime para el proxy de producción.
- **Fronteras:** `src/boundaries.test.ts` falla ante un nombre de rol en el código o una importación interna de `@wasichai/*`.

## Requisitos

- Node 26 y Yarn 1.
- Lectura de GitHub Packages: el scope está en el `.npmrc` del proyecto y el token en `~/.npmrc`, fuera del repositorio
  (`//npm.pkg.github.com/:_authToken=…`, con `read:packages`); con eso basta `yarn install`. El `.npmrc` del proyecto no
  lee ninguna variable de entorno, a propósito: Yarn 1 falla si falta la variable que nombra. La CI no lo necesita:
  `setup-node` escribe su propio `.npmrc` con `${NODE_AUTH_TOKEN}`, el secreto `PACKAGES_TOKEN`.

## Comandos

```bash
yarn dev             # http://localhost:5182, con sgspe corriendo en :8094
yarn test            # vitest
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
yarn -s csp          # la Content-Security-Policy para el proxy
```

## Notas

- En `yarn dev`, el script de recarga en caliente que Vite inyecta (react-refresh) y sus etiquetas `<style>` aparecen en la
  consola como infracciones de la CSP en modo de solo informe. Es ruido del desarrollo: la compilación de producción no
  tiene ninguna (comprobado con `vite preview`).

- `@wasichai/*` va en 0.5.0, igual en todos los paquetes, y se actualiza junto con wasichai del backend (ADR-0010 de
  `sgspe`); Dependabot los agrupa.
- La CI instala `@wasichai/*` con el secreto `PACKAGES_TOKEN` (un PAT con `read:packages`), en Actions y en Dependabot.
