# sgspe-ui

Interfaz web de **SGSPE** (Sistema de Gestión Social para Proyectos Extractivos) sobre **wasichai-ui** (`@wasichai/*`
0.5.1), para el backend [`sgspe`](https://github.com/wasichai/sgspe), donde viven el diseño y la documentación. Es una
sola app Vite + React con dos partes que comparten el login (el mismo token en `localStorage['sgspe.token']`), el tema y
el idioma:

| Ruta     | Para quién       | Qué es                                                                                                                                   |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/`      | el equipo social | el **portal**: las 13 secciones de `docs/ux` de `sgspe`, cada una con su fase; en F4 suma QCS, Riesgos y alerta temprana a lo de F2 y F3 |
| `/admin` | quien administra | el `WasichaiApp` de wasichai-ui con views, forms y pages                                                                                 |

|                     |                                                                          |
| ------------------- | ------------------------------------------------------------------------ |
| Puerto              | 5182 (`yarn dev` y `yarn preview`)                                       |
| API                 | proxy de `/api` a `http://localhost:8094` (`WASICHAI_API_URL` lo cambia) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (semilla de `sgspe`)                    |

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
  territorio (`?territory=`). El selector de proyecto de la barra superior monta la misma página con el otro alcance
  (`contexto/rutas.ts`, ASM-076); `ProyectoLayout` agrega la barra de contexto, el rastro (en el historial, no en la URL)
  y la sub-navegación de Project 360.
- **Inicio:** en F1, la bienvenida con cuenta, organización, roles y mapa de módulos por fase, sin indicadores. El inicio
  por rol se registra en `src/portal/inicios.ts` con los permisos que lo ofrecen, nunca con nombres de rol.
- **Pantallas de F2:** cada sección registra en `pantallas.ts` su raíz, montada en `<ruta>/*`; las pantallas de un
  proyecto se agregan a `proyectos/rutasEnProyecto.ts` con la guarda de su sección. Proyectos (S06 a S11), Territorio
  (S12 a S15), Grupos de interés (S16 a S20 y el tablero `stakeholders`), Relacionamiento (S21 a S26 y el tablero
  `engagement`) y Reportes (exportación del registro de grupos de interés).
- **Pantallas de F3:** compromisos y sus entregas (S27 a S33), evidencias y documentos emitidos, tareas y aprobaciones, la
  bandeja de avisos (wasichai-notifications), la matriz de compromisos en Reportes y los acuerdos en la ficha de
  interacción. Un comando del backend se manda con `useComando` (una `Idempotency-Key` por acción y por ruta); la emisión de
  un documento no la manda, como pide wasichai-documents. Una evidencia restringida se sube con un nombre neutro y su
  descarga pide `DOWNLOAD_RESTRICTED`. Cada pantalla de un registro se vuelve a montar al cambiar su ruta (`PorRuta`).
- **Pantallas de F4:** quejas, consultas y solicitudes (S34 a S37, S57 y el reporte unificado; reclasificar, aceptar una
  solicitud y derivar una pregunta de S23 van por `useComando`), riesgos y alerta temprana (S38 a S41, S58 a S62 e
  incidentes; la revisión de un riesgo por su comando), los avisos de riesgos y alertas, la queja grave en S48, las dos
  exportaciones de F4 en Reportes y los parámetros de F4 en S11. Una QCS confidencial que la cuenta no lee responde 404:
  su vínculo dice «Registro reservado» (`RegistroVinculado`) y una cifra que no la cuenta lo dice sin conteo
  (`NotaDeConfidenciales`). La huella SHA-256 de una evidencia se reserva, como su nombre, a quien la descarga, y toda ruta
  del portal codifica sus ids (`enlacesCodificados.test.ts`, sgspe#14).
- **Datos:** `src/portal/datos` usa el token de core y agrega `If-Match`, `X-Change-Reason`, `Idempotency-Key`, multipart y
  descargas; un error trae el `X-Correlation-Id`. Una escritura sale de la forma del GET y de los permisos de quien
  llama, nunca del modelo: un `PUT` manda las claves leídas que la cuenta puede escribir, nunca un campo restringido
  (ausente del GET) ni un derivado (`datos/derivados.ts`; el backend conserva los omitidos), y un rol con `u` no edita
  campos (`usePuedeEditar`). Después de un `PUT` el registro se relee: su respuesta trae los derivados en `null`.
- **Errores:** una guarda o un comando del backend responde con su código en `errors[0].message` (ruling P15);
  `componentes/errores.ts` lo dice con el texto de `comun.codigos` (o el de la pantalla, o el `detail` si el código es
  nuevo), también junto al campo de un formulario. Nunca se muestra el código crudo.
- **Mapa y gráficos:** MapLibre 6.10.0 (`src/portal/mapa`) y ECharts 6 (`src/portal/graficos`) bajan con el primer mapa o
  gráfico; los dos pintan con los tokens del tema.
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
- Configuración del despliegue, leída por `vite.config.ts` al compilar: `SGSPE_ROL_JEFATURA` (el rol cuyas asignaciones
  activas son la jefatura del proyecto, ASM-080; por defecto `PROJECT_MANAGER`) y `SGSPE_MAPA_BASE` (la URL de un estilo
  MapLibre para el mapa base; vacío es el fondo apagado sin teselas externas). `yarn csp` incluye el origen del mapa
  base.
- Notas de despliegue: `SGSPE_MAPA_BASE` lleva el mismo valor que `sgspe.map.base-style-url` del `application.yml` del
  backend en ese despliegue (gis.md §6.4). El mapa base no pasa por el backend en F2, así que nada los sincroniza: quien
  despliega cambia los dos a la vez, y el proxy de producción permite ese origen en su CSP. La CSP abre solo el origen
  del estilo: si sus teselas, glifos o sprites vienen de otro origen, la CSP los bloquea y hay que sumarlo a mano.
- zod corre sin JIT (`src/zodSinJit.ts`, que `main.tsx` importa antes que todo): así no prueba `Function('')`, que la
  CSP sin `unsafe-eval` reportaría en cada pantalla (`e2e/csp.spec.ts`).

## Comandos

```bash
yarn dev             # http://localhost:5182, con sgspe corriendo en :8094
yarn test            # vitest
yarn typecheck
yarn lint            # prettier --check (yarn format lo corrige)
yarn build           # dist/, luego yarn preview
yarn e2e             # Playwright sobre vite preview (npx playwright install chromium la primera vez)
yarn -s csp          # la Content-Security-Policy para el proxy
```

## Notas

- En `yarn dev`, el script de recarga en caliente que Vite inyecta (react-refresh) y sus etiquetas `<style>` aparecen en la
  consola como infracciones de la CSP en modo de solo informe. Es ruido del desarrollo: la compilación de producción no
  tiene ninguna (comprobado con `vite preview`).

- `@wasichai/*` va en 0.5.1, igual en todos los paquetes, y se actualiza junto con wasichai del backend (ADR-0010 de
  `sgspe`); Dependabot los agrupa.
- La CI instala `@wasichai/*` con el secreto `PACKAGES_TOKEN` (un PAT con `read:packages`), en Actions y en Dependabot.
