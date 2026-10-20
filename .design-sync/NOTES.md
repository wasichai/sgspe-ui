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
