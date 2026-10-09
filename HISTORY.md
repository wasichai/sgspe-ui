# Historia de cambios

La entrada más reciente va primero. El diseño y los ADR están en el repositorio `sgspe`.

## 2026-10-09 — Capacidades de tenant desde `/me/permissions` (UPS-06)

- El portal lee `capabilities` de `GET /api/auth/me/permissions` (WAS-ADR-0053) en lugar de deducirlas: Administración se
  ofrece al admin y a quien tenga `MANAGE_METADATA` o `MANAGE_ORGANIZATION`, y `GET /api/users` y `GET /api/roles` no se
  piden si la cuenta no tiene `MANAGE_ORGANIZATION`. core 0.5.1 no tipa la clave; se lee en `src/portal/datos/capacidades.ts`.
  Una respuesta sin la clave (un backend anterior) se trata como «no se sabe»: se intenta y el 403 sigue siendo la red.
- UPS-16 no necesitó cambios: ninguna pantalla lee una autorrelación filtrando la lista por el campo. `actor_relationship`
  une dos objetos distintos (`from_*`, `to_*`) y `parent_locality` se lee como atributo del propio registro.

## 2026-10-09 — `@wasichai/*` 0.5.1

- Los ocho paquetes pasan de 0.5.0 a 0.5.1 (`maplibre-gl` sigue en 6.10.0). Solo trae correcciones: `DATETIME` conserva
  segundos e instante, los fallos de guardar, borrar e ingresar se anuncian, el registro y la lista se manejan con el
  teclado, una página que falla muestra un error y core escribe `<html lang>`.
- core 0.5.1 escribe `<html lang>` con el código de i18n (`es`) y pisaba el `es-PE` del portal; `idiomaHtmlModule` entra
  también en el registro del portal para dejarlo en `es-PE` (WCAG 3.1.1).
- UPS-08, UPS-13 y UPS-19 siguen abiertas: 0.5.1 no trae el motivo en la edición, el mapa base configurable ni los temas
  de «Según el sistema».

## 2026-10-09 — Fase 2: portal de proyectos, territorio, grupos de interés y relacionamiento

- Dependencias fijadas de F2: `@wasichai/gis` y `@wasichai/workflow` 0.5.0, `maplibre-gl` 6.10.0, `echarts` 6.1.0,
  `react-hook-form` 7.89.0, `zod` 4.6.5 y Playwright 1.63.0. `/admin` registra gis y workflow; `AdminApp` y `PortalApp`
  bajan en chunks propios (el pendiente de F1). MapLibre y ECharts no entran en la entrada: `partirEnChunks` excluye los
  ids con `?` y Playwright lo comprueba (P33).
- Capa de datos con `If-Match`, motivo RFC 8187, `Idempotency-Key`, multipart y correlación; las escrituras salen de la
  forma del GET y de los permisos de quien llama, sin derivados ni campos restringidos, y releen el registro. Los códigos
  de error del backend (ruling P15) se dicen con su texto, cada `403` con el suyo.
- Hilo de contexto: selector de proyecto, barra de contexto con chip de territorio, rastro y Project 360.
- Pantallas S06 a S26 en lo que dicen de F2, los tableros `stakeholders` y `engagement` con ECharts, el detalle de
  KPI-STK-04, KPI-STK-05 y KPI-STK-07 y la exportación del registro de grupos de interés.
- `SGSPE_MAPA_BASE` del portal y `sgspe.map.base-style-url` del backend llevan el mismo valor (notas de despliegue del
  README).
- Primeras pruebas extremo a extremo con Playwright (ASM-066).
- Decisiones de la ejecución: `RUTAS_EN_PROYECTO` lleva `seccion` solo para las pantallas de otra sección (P36); `EDIT_ANY`
  no exime de la asignación, y solo ADMIN la salta en la opción A (P38); la fila fuera de zona de una importación se
  resalta con su mensaje y lleva `APPLY` por defecto (P39); las lecturas con tope (`useTodosConTope`, `leerConTope`) avisan
  del recorte, y el calendario y las interacciones leen en orden descendente; en S07, quien crea el borrador y no es ADMIN
  se asigna a sí mismo con su rol antes de cualquier otra escritura, porque `ProjectScopeGuard` exige la asignación también
  en el borrador y esa escritura está exenta (P40).
- Piezas compartidas que dejó la ejecución: `LimiteDeError` (mapa y gráficos), `LecturaConEstados` y `FalloDeLectura`,
  `ThConExplicacion` y celdas con `describedPor` para los datos restringidos en tablas, y `hoyEnLima`, `diaEnLima` y
  `diasEntre` en `datos/fechas.ts`.
- Revisión final de la rama: `Consulta` conserva lo cargado si una relectura falla y dice un `403` como «No disponible»;
  `AvisoDeConflicto`, `BotonRecargar` y `useReleer` son la salida común de un `412` (también en `FormularioDeRegistro` y
  S07); `useEscribeEnProyecto` deja escribir a ADMIN sin asignación y el equipo de S11 no la exige; `Historia` en
  `componentes/`; `useUbicacionDelTelefono` para S26 y el modo rápido; `importaA`; Reportes y las pestañas de Project 360
  según permisos; zod sin JIT (`src/zodSinJit.ts`); `instanteDeLima`, `diaPe` y `fechaYHoraPe` para las fechas. En la
  re-revisión: tras «Recargar», `FormularioDeRegistro` manda solo lo cambiado (`cambiosRespectoDe`) y S07 hace `reset` con
  `keepDirtyValues`, así un guardado no pisa el cambio de otra persona; las transiciones de un registro de proyecto piden
  `useEscribeEnProyecto`.
- Defectos del plan corregidos al ejecutarlo: clave de idempotencia repetida en las evaluaciones, autoguardado del acta en
  bucle tras un error, `NEUTRAL` de la barra de posturas con una sola serie, umbral 3 supuesto en la matriz, formulario de
  asignación anidado en el asistente y conversión numérica por tecla en los parámetros.
- Pruebas: 804 unitarias en 47 archivos (670 más que las 134 de F1) y 8 extremo a extremo.
- Pendiente (no bloquea F2):
  - Del alcance: búsqueda ⌘K (S03), inicios por rol (ASM-078), acción masiva «Reasignar responsable», mapa de vista previa
    de la importación (el contrato no trae geometrías), directorio de usuarios y roles para `PROJECT_ADMIN`.
  - El `POST` genérico ignora `Idempotency-Key` hasta UPS-18: un reintento tras una caída de red puede duplicar una
    interacción o una visita.
  - Una cuenta sin asignaciones vigentes que exporta con «mis proyectos» recibe un XLSX vacío sin mensaje (contrato de 2.2).
  - Editor de acta: si el guardado al salir falla y la persona no vuelve a esa acta, no se le avisa; «Recuperar mi texto»
    tras un `412` no compara con la versión ajena.
  - Quitar la ubicación ya guardada de un proyecto no tiene contrato (`location: null`).
  - «Nueva versión» de un área se ofrece también desde una versión reemplazada (viene del brief; confirmar con diseño).
  - Los valores ENUM se muestran como se guardan (ASM-025) y el rol del líder de visita sale crudo.
  - `MatrizPage` espera al proyecto aunque solo lo use como respaldo de los umbrales.
  - Las pruebas con tiempo usan reloj falso: procesos ajenos en la máquina de desarrollo las volvieron lentas.

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
