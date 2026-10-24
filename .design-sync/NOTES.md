# Notas de design-sync

- Forma: `package` (no hay Storybook ni `*.stories.*`; verificado el 2026-10-20).
- Instalar requiere el token de lectura de GitHub Packages para `@wasichai/*` (`.npmrc` apunta a
  `npm.pkg.github.com`): sin él, `yarn install` responde 401. En una sesión en la nube, el token va
  como secreto del entorno (`NODE_AUTH_TOKEN`), nunca en el repositorio.
- `engines.node` pide Node >= 26; el contenedor por defecto trae Node 22.
- Sincronizado el 2026-10-20 con el proyecto «SGSPE Design System» (`projectId` en `config.json`): 334
  archivos, anclados con `_ds_sync.json`. Después de esa subida cambió el kit (`VistaSgspe` con `idioma`
  y el CSS del kit con `@source` de `prototipos/`), así que la próxima corrida de `resync.mjs` subirá esa
  diferencia. Los cambios son aditivos: las 61 previews no cambian.
- Los prototipos del rediseño (`prototipos/`) usan el mismo kit y no se suben a Claude Design: sus
  capturas viven en `sgspe/docs/ux/redesign/04-prototipos/`.
- Sin token (2026-10-20): Node 26.12.0 de nodejs.org (SHA-256 verificado) en `~/.local/node26`;
  `wasichai/wasichai-ui` clonado en el tag `v1.0.0` (commit `609d1b7`), construido con
  `yarn install --frozen-lockfile --ignore-scripts && yarn build`, y cada paquete empacado con
  `yarn pack`. `sgspe-ui` se instaló con sus `@wasichai/*` apuntados a esos `.tgz` por `file:` y
  `resolutions`, y luego se restauraron `package.json` y `yarn.lock` (nada de eso se commitea).
  Resultado: typecheck y build limpios; las pruebas pasan salvo `dependencias.test.ts`, que solo
  falla mientras dura la reescritura temporal de `package.json`.

## Re-sincronización del 2026-10-23 (rediseño)

- Kit: 71 componentes (61 + 10). Nuevos: `Seccion`, `EstadoSinAcceso`, `CampoFecha`, `CalendarioDeFecha`,
  `TablaPriorizada`, `ListaPriorizada`, `SelectorDeVista`, `SelectorDePagina`, `BarraDeFiltros` y `CamposPlegables`, cada uno
  con su doc y su preview. Cambiaron de API y de preview o doc: `PanelDeDecision` (`camino`, «Ver el camino» plegado),
  `KpiCard` (`anidada`, `cifra`, `detalle`), `EncabezadoDePagina` (`antetituloEnSans`, `etiquetaDeAcciones`,
  `pieDeAcciones`; la preview «Ficha» es ahora la anatomía de `CabeceraDeFicha`, y ya no anida un `MasAcciones` dentro de
  `mas`), `MasAcciones` (`nombre`) y `Campo` (`id`). `dtsPropsFor` de `PanelDeDecision` y `KpiCard` al día.
- Fuera del kit: `CabeceraDeFicha` (pide las transiciones a la API con `useAvailableTransitions`; su aspecto lo da la
  preview «Ficha» de `EncabezadoDePagina`), `CaminoDelFlujo` suelto (se ve dentro de `PanelDeDecision`), `VistaPrevia`,
  `Migas` y `RegistrosSimples` (leen registros).
- `overrides`: `EstadoSinAcceso` y `BarraDeFiltros` en `column` (el primero dio `GRID_OVERFLOW`); `TablaPriorizada` en
  `single` a 1320x420, para que se vean las columnas secundarias (desde `xl`).
- Las previews interactivas (`CampoFecha`, `SelectorDeVista`, `BarraDeFiltros`, `TablaPriorizada`) llevan su estado con
  `useState` en un envoltorio de la preview; eso cambia `_vendor/react.js` del bundle.
- `tokens.css` sumó `--sg-surface-raised` y `--sg-border-control` (y el tema `sgspe-noche`): son variables, sin utilidad
  `sg-*` propia; viajan en `_ds_bundle.css`. `kit/flujos.json` no cambió (los workflows de `sgspe` siguen iguales).
- Ancla: el `_ds_sync.json` del bundle de la primera subida (`/home/user/sgspe-ui/ds-bundle/`), pasado a `resync.mjs` con
  `--remote`. Diferencia: 3 cambiados, 10 nuevos, 0 borrados; 70 archivos que escribir (50 nuevos y 20 modificados) y
  ninguno que borrar. Render check: 71 previews, 0 malas, 0 delgadas, 0 idénticas; las 13 capturadas, calificadas en
  `.cache/review/`. El CSS del portal no cambió (`index-CTzbXUHi.css`, mismo SHA-256 antes y después).
- La caché de calificaciones vive en el árbol principal (`.design-sync/.cache/`); un worktree la copia antes de correr
  `resync.mjs`, o vuelve a capturar y calificar todo.

## Cómo se arma (primera sincronización, 2026-10-20)

- `sgspe-ui` es una app, no una biblioteca: la entrada es `.design-sync/kit/` (paquete `sgspe-kit`), que reexporta los
  primitivos de `@wasichai/ui` y los componentes presentacionales de `src/portal/componentes`, más `VistaSgspe` (el
  proveedor de las previews y de los diseños). `buildCmd`: `node .design-sync/kit/build.mjs` (tipos con tsc y CSS con
  vite). Después: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle`.
- El CSS del kit sale de `src/index.css` reescrito para `kit/dist/` (sin `@source not '../.design-sync'` y con las
  previews). `src/index.css` excluye `.design-sync/` para que las previews no cambien el CSS del portal (el hash de
  `dist/assets/index-*.css` quedó igual). Si cambian las rutas relativas de `src/index.css`, `build.mjs` falla o hay que
  ajustar sus reemplazos.
- `kit/flujos.json` son los 19 workflows de `sgspe/model/workflows` sin roles (`node .design-sync/kit/flujos.mjs
  ../sgspe/model/workflows`), precargados en la caché: sin ellos `EstadoChip` muestra el código técnico.
- `VistaSgspe tema="dark"` pone `data-theme` en `<html>` con un efecto pasivo (core lo escribe antes en uno de layout); no
  guarda la preferencia, que pasaría a todas las tarjetas del mismo origen.
- `VistaSgspe` no abre un segundo router si ya hay uno (la tarjeta de `VistaSgspe` se monta dentro del proveedor).
- `Pasos` y `FormularioPorPasos` solo muestran la lista de pasos desde `lg` (1024 px): sus tarjetas van con viewport ancho.
- Los grupos salen del `category` de `.design-sync/docs/*.md`, sin tildes (el slug de «Página» era `p-gina`).
- El render check y la captura usan `DS_CHROMIUM_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
  y `NODE_PATH=$PWD/node_modules` (playwright del repositorio). `yarn e2e` pide el build 1243: en este contenedor se
  enlazó a 1194.
- Subida: en una sesión de claude.ai/code DesignSync pide `/design-consent` (con él, todo el flujo corre en la sesión).
  Primera subida el 2026-10-20 al proyecto «SGSPE Design System» (`3e0d73eb-…`, fijado en `config.json`): 334 archivos,
  ruta incremental en un solo lote porque todo ya estaba calificado; `_ds_sync.json` al final.

## Re-sync risks

- `@wasichai/*` se construyó desde `wasichai-ui` en `v1.0.0`, no desde lo publicado: si difieren, el bundle también.
- `kit/flujos.json` es una copia: se rehace cuando cambie un workflow en `sgspe`.
- Una preview que reproduce un componente que pide datos (`CabeceraDeFicha`) se arma con sus piezas presentacionales: si
  la regla de la cabecera cambia en el portal, la preview «Ficha» de `EncabezadoDePagina` cambia a mano.
- Las previews reproducen el uso real del portal (p. ej. `DialogTitle className="text-sg-h3 font-semibold"`); si el
  portal cambia ese idioma, cambian aquí a mano.
- `Alert` de `@wasichai/ui` es texto en color, sin caja: es su aspecto real, no un fallo del CSS.
