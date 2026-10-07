# Historia de cambios

La entrada más reciente va primero. El diseño y los ADR están en el repositorio `sgspe`.

## 2026-10-07 — Cierre de la revisión final de la Fase 1

- El idioma se comparte de verdad con `/admin`: `LanguageMenu` usa `useSetLocale` de core, que además de `sgspe.lang` guarda
  la elección en las preferencias del usuario; antes, `LocaleSync` la revertía en la siguiente carga.
- `<html lang>` sigue al idioma también en `/admin` (`idiomaHtmlModule`, un módulo que solo aporta un proveedor) y el español
  es `es-PE`, en `index.html` y al cambiar de idioma; el código de i18n sigue siendo `es`.
- Un `next=/admin…` después del login sale a la consola con una navegación completa; `/administracion` sigue en el portal.
- Una sección del árbol sin pantalla dice «Esta sección llega en Fx» (la primera de sus fases); una ruta desconocida sigue
  siendo la página no encontrada.
- El login tiene `<main>` y el selector de idioma; los botones de tema y de salida miden 32 px; «Inténtelo de nuevo» trata
  de usted; `scopeFromPath` tolera un `%` mal formado.
- Documentación: la instalación es `yarn install` con el token en `~/.npmrc` (la CI lo recibe de `setup-node`), y la regla de
  idioma del código dice lo que el código hace (identificadores del portal en español; técnicos y rutas, en inglés).
- Si el servidor rechaza guardar el idioma, `LanguageMenu` lo dice (`title`, color de error y aviso para lectores de pantalla)
  en lugar de dejar el rechazo sin atender; core ya devolvió el idioma anterior.
- Pruebas: 134 en 11 archivos (25 más que las 109 de la fase).
- Pendiente: dividir el bundle por app con carga diferida de `AdminApp` y `PortalApp` (un chunk de unos 850 kB; F2, antes de
  MapLibre y ECharts), el alcance del token de la CI y el secreto de Dependabot (decisiones del usuario).

## 2026-10-07 — Fase 1: fundación

- Andamiaje copiado de caja-ui: Vite 8 en el puerto 5182 con proxy de `/api` al 8094, Tailwind con `@wasichai/ui`,
  TypeScript, prettier, commitlint y husky.
- `/admin` con `WasichaiApp` (views, forms y pages) y `storagePrefix: 'sgspe'`.
- Portal con login compartido (`sgspe.token`), `RequireSession` y `safeNext` estricto.
- Tema «Pino y piedra» (`docs/ux/tokens.css`) en claro y oscuro sobre `@wasichai/ui`, IBM Plex desde el mismo origen y
  el script de arranque autorizado por hash en la CSP (`csp.ts`, modo de solo informe en Vite).
- Shell y navegación de `docs/ux`: las 13 secciones con sus rutas y su fase; en F1 se dibujan Dashboard y, para quien
  administra, Administración; «Preguntar» deshabilitado hasta F7; el contexto de la URL en `context.ts`.
- Español por defecto e inglés, con números y fechas es-PE.
- Inicio de F1: cuenta, organización, roles y mapa de módulos por fase; el inicio por rol, por permisos, en `inicios.ts`.
- Ícono de la pestaña: la montaña de SGSPE en el color pino, `public/favicon.svg`, enlazado desde `index.html` (cabe en
  `img-src 'self'` y no cambia el hash del script de arranque).
- `viteConfig.test.ts` fija `WASICHAI_API_URL` por su cuenta y ya no depende del shell.
- CI con `PACKAGES_TOKEN`, Dependabot y `boundaries.test`.

### Verificación (prueba de humo del 2026-10-07)

- Entorno: túnel y PostGIS arriba; `bootRun` en unos 11 s. Aprovisionamiento idempotente: `apply.py` con 0 creados, 0
  actualizados y 0 omitidos; `apply_roles.py` con 15 omitidos; `--workflows` todo en 0.
- `X-Correlation-Id`: sin cabecera se genera un UUID, `humo-1` se conserva y un valor hostil se reemplaza por un UUID.
- CSP: en modo de solo informe en desarrollo, con el hash del script de arranque; la compilación de producción
  (`vite preview`) no deja infracciones en la consola.
- Playwright como administrador: el login usa «Pino y piedra» (fondo rgb 245, 246, 243) con IBM Plex cargada y ninguna
  petición a otro host; el Dashboard muestra la organización «Demo», el rol ADMIN, la tabla «Módulos por fase» de 13 filas,
  la navegación con Dashboard y Administración y «Preguntar» deshabilitado; `/admin/admin/roles` abre sin volver a iniciar
  sesión y lista las 15 etiquetas en español más ADMIN.
- Playwright como `AUDITOR`: la navegación solo tiene Dashboard y Administración dice «Solo para administración»;
  `/admin/admin/audit` carga sin error de permisos pero muestra «Sin resultados», porque el alta de usuarios y de roles no
  se audita (UPS-02, wasichai#49). Por la API: auditoría 200, usuarios 403, roles 403.
- Comportamientos de wasichai 0.3.2 fijados por pruebas: un token emitido antes de deshabilitar al usuario sigue valiendo
  hasta que vence (UPS-09, wasichai#55); el 401 sin token trae el cuerpo vacío; un atributo desconocido al crear se ignora
  sin error; las entradas de permisos de campo no se pueden borrar (un PUT con lista vacía no hace nada y no hay DELETE),
  así que `apply_roles.py` las neutraliza con lectura y escritura en verdadero.
- Suites de la prueba de humo: `yarn lint` y `yarn typecheck` limpios, 11 archivos con 107 pruebas en verde y `yarn build`
  correcto. Con el cierre (ícono y `viteConfig.test.ts`) son 109 pruebas.
