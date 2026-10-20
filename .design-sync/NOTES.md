# Notas de design-sync

- Forma: `package` (no hay Storybook ni `*.stories.*`; verificado el 2026-10-20).
- Instalar requiere el token de lectura de GitHub Packages para `@wasichai/*` (`.npmrc` apunta a
  `npm.pkg.github.com`): sin él, `yarn install` responde 401. En una sesión en la nube, el token va
  como secreto del entorno (`NODE_AUTH_TOKEN`), nunca en el repositorio.
- `engines.node` pide Node >= 26; el contenedor por defecto trae Node 22.
- Primera sincronización pendiente: aún no hay proyecto de Claude Design (sin `projectId`). Después
  de sincronizar, sigue el rediseño integral de UX/UI con entregables en `sgspe/docs/ux/redesign/`.
- Sin token (2026-10-20): Node 26.12.0 de nodejs.org (SHA-256 verificado) en `~/.local/node26`;
  `wasichai/wasichai-ui` clonado en el tag `v1.0.0` (commit `609d1b7`), construido con
  `yarn install --frozen-lockfile --ignore-scripts && yarn build`, y cada paquete empacado con
  `yarn pack`. `sgspe-ui` se instaló con sus `@wasichai/*` apuntados a esos `.tgz` por `file:` y
  `resolutions`, y luego se restauraron `package.json` y `yarn.lock` (nada de eso se commitea).
  Resultado: typecheck y build limpios; las pruebas pasan salvo `dependencias.test.ts`, que solo
  falla mientras dura la reescritura temporal de `package.json`.

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
- Subida: DesignSync no tiene autorización en una sesión de claude.ai/code («/design-login cannot run in this
  non-interactive session»). La subida queda para una sesión autorizada; nada se subió aún y no hay `projectId`.

## Re-sync risks

- `@wasichai/*` se construyó desde `wasichai-ui` en `v1.0.0`, no desde lo publicado: si difieren, el bundle también.
- `kit/flujos.json` es una copia: se rehace cuando cambie un workflow en `sgspe`.
- Las previews reproducen el uso real del portal (p. ej. `DialogTitle className="text-sg-h3 font-semibold"`); si el
  portal cambia ese idioma, cambian aquí a mano.
- `Alert` de `@wasichai/ui` es texto en color, sin caja: es su aspecto real, no un fallo del CSS.
