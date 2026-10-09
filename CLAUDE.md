# CLAUDE.md

Guía para agentes en `sgspe-ui`. El diseño vive en el repositorio `sgspe` (`../sgspe/docs/`): la interfaz es `docs/ux/`
(arquitectura de UX, design system, tokens, pantallas y flujos; gana sobre `docs/architecture.md` §9 donde difieren) y
ADR-0024; la seguridad, `docs/security.md` §3.2 y §5.10.

## Reglas

- Textos de interfaz en español (es-PE) e inglés. Cada módulo trae su archivo `src/portal/textos/<módulo>.ts` con
  `ES_<MÓDULO>` y `EN_<MÓDULO>: typeof ES_<MÓDULO>`, y `es.ts`/`en.ts` lo agregan bajo su clave (`I18n.test.tsx` compara las
  claves).
- Idioma del código: los identificadores del portal van en español, como en caja-ui (`clave`, `fases`, `estadoDe`,
  `GuardaDeSeccion`, `crearI18n`), y los comentarios también. Van en inglés los nombres técnicos y de rutas: las rutas del
  portal (`/projects`, `/territory`), los objetos del modelo y la API (ADR-0009, que cubre el modelo, los paquetes y las
  rutas de la API, no los identificadores de TypeScript). Lo copiado de otro repositorio (`ThemeMenu.tsx`, `src/test/setup.ts`)
  conserva su idioma original.
- Ningún nombre de rol en `src/` fuera de las pruebas: se decide con `useAuth().isAdmin` y los permisos de
  `/api/auth/me/permissions` (`src/boundaries.test.ts`). `@wasichai/*` se importa solo por la raíz de cada paquete.
- `/admin` registra solo los módulos de los starters instalados en `sgspe` y nunca `agentModule()`; el único módulo propio
  es `idiomaHtmlModule` (`src/idiomaHtml.ts`), que no aporta pantallas: solo sigue `<html lang>`, que core no toca.
- Una sección nueva se registra en `src/portal/pantallas.ts` con su pantalla; sin pantalla no se dibuja. Un inicio por rol
  se registra en `src/portal/inicios.ts` con los permisos que lo ofrecen.
- Colores, tipografía, radios y sombras solo con los tokens `sg-*` de `src/theme/tokens.css`; si `docs/ux/tokens.css`
  cambia, se copia de nuevo y se verifica con `cmp`.
- Pruebas primero, con Vitest, Testing Library y `mockFetch` de `@wasichai/testing`; usuarios ficticios `@sgspe.test`.
- Conventional Commits en español; `git add` con rutas explícitas.
- Toda escritura del portal pasa por `src/portal/datos` (`useCrear`, `useActualizar`, `usePedir`): manda `If-Match` con la
  versión leída, se arma con la forma del GET y los permisos de quien llama (`atributosDeEscritura`), nunca con el modelo,
  y nunca lleva un campo derivado ni uno restringido; «Editar» se ofrece con `usePuedeEditar` (un rol con `u` no edita).
  Las transiciones, por `transiciones/` (motivo y `transition-checks`).
- Un error de la API se muestra con `useMensajeDeError` o `useErroresDeCampo`, nunca con su `message`: el de una guarda
  es un código. Un código nuevo del backend suma su texto a `comun.codigos` en los dos idiomas.
- Una pantalla de proyecto se registra en `proyectos/rutasEnProyecto.ts` con la `seccion` cuya guarda le corresponde.
- MapLibre y ECharts no se importan fuera de `mapa/MapaImpl.tsx` y `graficos/GraficoImpl.tsx`/`echarts.ts`: las pantallas
  usan `Mapa` y `Grafico`, diferidos. Las pruebas de pantalla usan `src/test/mapaFalso.tsx` y `src/test/graficoFalso.tsx`.
- El rol de la jefatura y el mapa base son configuración del despliegue (`SGSPE_ROL_JEFATURA`, `SGSPE_MAPA_BASE`), nunca
  literales de `src/`.
- `yarn format && yarn lint && yarn typecheck && yarn test && yarn build && yarn e2e` antes de cada commit.
- Instalar con `yarn install`: el token de lectura de GitHub Packages vive en `~/.npmrc`, no en el repositorio, y la CI lo
  recibe de `setup-node` (`PACKAGES_TOKEN`). Ningún token en archivos del repositorio.
