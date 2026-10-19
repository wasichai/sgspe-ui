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
- `/admin` registra solo los módulos de los starters instalados en `sgspe` y nunca `agentModule()`; los módulos propios son
  `idiomaHtmlModule` (`src/idiomaHtml.ts`, sigue `<html lang>`, que core no toca) y `mapaBaseModule` (`portal/mapa/mapaBase.tsx`,
  el mapa base de la organización tras el login, después de `gisModule`). Ninguno aporta pantallas.
- Una sección nueva se registra en `src/portal/pantallas.ts` con su pantalla; sin pantalla no se dibuja. Un inicio por rol
  se registra en `src/portal/inicios.ts` con los permisos que lo ofrecen.
- Colores, tipografía, radios y sombras solo con los tokens `sg-*` de `src/theme/tokens.css`; si `docs/ux/tokens.css`
  cambia, se copia de nuevo y se verifica con `cmp`.
- Pruebas primero, con Vitest, Testing Library y `mockFetch` de `@wasichai/testing`; usuarios ficticios `@sgspe.test`.
- Conventional Commits en español; `git add` con rutas explícitas.
- Los releases los arma release-please desde esos commits (`release-please.yml`): el tipo (`feat`, `fix`, `!`) decide la
  versión, y `version` de `package.json`, `CHANGELOG.md` y `.release-please-manifest.json` no se editan a mano.
- Una fecha con hora que el portal escribe es la de Lima (`ahoraEnLima`, `datos/fechas.ts`); un DATETIME de `DynamicForm`
  también, con `ZONA_DE_LIMA` (`timeZone` del formulario y `config.timeZone` del portal y de `/admin`).
- El motivo de un objeto `requiresReason` lo pide la pantalla del portal; `prepararDefinicion` apaga el «Motivo» de core para
  no pedirlo dos veces.
- Toda escritura del portal pasa por `src/portal/datos` (`useCrear`, `useActualizar`, `usePedir`): manda `If-Match` con la
  versión leída, se arma con la forma del GET y los permisos de quien llama (`atributosDeEscritura`), nunca con el modelo,
  y nunca lleva un campo derivado ni uno restringido; «Editar» se ofrece con `usePuedeEditar` (un rol con `u` no edita).
  Las transiciones, por `transiciones/` (motivo y `transition-checks`). Un `412` se ofrece con `AvisoDeConflicto` o
  `BotonRecargar` (`componentes/AvisoDeConflicto.tsx`): relee y quita el aviso solo cuando la relectura llegó.
- Un comando de `/api/sgspe/**` se manda con `useComando` (`datos/comandos.ts`): nunca con `usePedir` suelto si honra
  `Idempotency-Key`. La clave es de la acción y de la ruta: se repite al reintentar y la pantalla llama a `nuevaAccion` al
  abrir o cancelar un formulario. Un formulario que vive dentro de otro (la evidencia en la entrega) no es un `<form>`.
  La emisión de un documento no manda `Idempotency-Key`: es el contrato de wasichai-documents.
- Los avisos son de wasichai-notifications (`datos/avisos.ts`): sin tablas ni endpoints propios. Un aviso o una tarea lleva
  a su registro por `/r/:object/:recordId` (`datos/fichas.ts`).
- Toda pantalla de un registro se monta con `PorRuta` (`componentes/PorRuta.tsx`): se vuelve a montar al cambiar el
  parámetro de la ruta, para que el borrador de un registro no pase a otro.
- Una evidencia restringida se sube con un nombre neutro y el nombre de su archivo se reserva a quien la descarga; la
  descarga pide `DOWNLOAD_RESTRICTED`.
- La guarda de UI de una escritura con alcance de proyecto es `useEscribeEnProyecto` (`contexto/ProyectoLayout.tsx`): ADMIN
  la salta y los demás necesitan una asignación vigente. Las escrituras de `project_assignment` están exentas
  (security.md §9.2, ítem 5) y dependen solo de `can(...)`.
- La lectura la acota el servidor (alcance por proyecto, ADR-0029): el portal no filtra por proyecto lo que lee. Si la cuenta
  lee todos los proyectos lo dice solo `useLeeTodosLosProyectos` (`contexto/proyectos.ts`, `READ_ALL_PROJECTS` sobre
  `project`; ADMIN siempre), el único lugar que nombra la acción (`boundaries.test.ts`). Un `404` nunca distingue «no
  existe» de «no es de sus proyectos»: la ficha lo dice con `NoEsDeSusProyectos` y su `noExiste`
  (`componentes/Estados.tsx`).
- Un error de la API se muestra con `useMensajeDeError` o `useErroresDeCampo`, nunca con su `message`: el de una guarda
  es un código. Un código nuevo del backend suma su texto a `comun.codigos` en los dos idiomas.
- Un vínculo a otro registro se dibuja con `RegistroVinculado` (`componentes/RegistroVinculado.tsx`): un destino que responde 404
  (de otro proyecto, una QCS confidencial o borrado; `esIlegible`) se dice «Registro reservado», sin enlace ni datos, y
  `/r/:object/:recordId` hace lo mismo. El `400` de wasichai sobre una relación («no record with this id») se dice en su
  campo con `comun.codigosEnCampo.registroNoLegible` (`componentes/errores.ts`). `EnlaceDeFicha` (mismo archivo) lleva a la ficha de un
  registro ya leído. Una cifra o una lista de QCS con
  `confidentialHidden` lleva `NotaDeConfidenciales`, sin conteo. La huella SHA-256 de una evidencia, como su nombre, solo para
  quien la descarga.
- El dinero de BC-10 se suma con `datos/inversion.ts` (`sumaPorMoneda`, `totalDeItems`, `porcentaje`), en diezmilésimos exactos y
  por moneda: nunca entre monedas (ASM-063) ni en coma flotante, y un monto que no vino es «—», nunca cero. El total de un aporte
  que se aprobará es la suma de sus ítems, como la juzga el servidor; `total_amount` y `total_budget` son derivados.
- Una lista hija que ya no cambia (los ítems de un aporte fuera de `requested`) se dibuja con `RegistrosSimples` y `congelado`; un
  valor propuesto en un alta (la moneda, el año de Lima) va en `iniciales`, porque wasichai no aplica `defaultValue` (UPS-15).
- «Antes de aprobar» lee la consulta en seco con `inversion/lineamientos.ts`: una regla nueva de la aprobación de un aporte suma
  su código a una fila de `CODIGOS` o cae en «Otras reglas».
- Toda ruta del portal codifica con `encodeURIComponent` el id o el proyecto que lleva; `src/portal/enlacesCodificados.test.ts`
  lo vigila en cada fuente.
- `src/portal/textosSinCodigos.test.ts` vigila que ningún texto de interfaz lleve códigos de error ni identificadores de
  requisitos (RF, RN, UPS…): esos viven en la documentación, no ante la persona usuaria.
- Una pantalla de proyecto se registra en `proyectos/rutasEnProyecto.ts` con la `seccion` cuya guarda le corresponde.
- MapLibre y ECharts no se importan fuera de `mapa/MapaImpl.tsx` y `graficos/GraficoImpl.tsx`/`echarts.ts`, ni `GeometryField`
  fuera de `mapa/Dibujo.tsx`: las pantallas usan `Mapa`, `Dibujo` y `Grafico`, diferidos. Las pruebas de pantalla usan
  `src/test/mapaFalso.tsx`, `src/test/dibujoFalso.tsx` y `src/test/graficoFalso.tsx`.
- El rol de la jefatura es configuración del despliegue (`SGSPE_ROL_JEFATURA`), nunca un literal de `src/`. El mapa base llega
  por `GET /api/sgspe/map/settings` (`useMapaBase`): ningún fuente escribe una URL de teselas o de estilo, y sin respuesta el
  fondo es «Sin mapa base». `SGSPE_MAPA_BASE` solo abre la CSP de `yarn csp`.
- Las capas públicas del mapa van por el proxy WMS de SGSPE (`mapa/wms.ts`): el portal nombra cada capa por el estilo
  `sgspe-lyr-NN` del `GetCapabilities`, firma con el token solo las teselas del proxy del mismo origen (`firmaDeWms`) y, ante un
  `503`, vuelve al GeoJSON.
- `src/portal/mapa/paleta.json` es copia exacta de `model/styles/palette.json` de `sgspe` (prettier no la toca): `paleta.test.ts`
  compara su huella y, en la CI, sus bytes con el original; si la paleta cambia en `sgspe`, se copia de nuevo y se actualiza la
  huella.
- Las consultas de F6 viven en `territorio/consultas.ts` con la forma de las respuestas de 6.2a y 6.2b: una pantalla no pide un
  endpoint de `/api/sgspe/territory/**` por su cuenta.
- `yarn format && yarn lint && yarn typecheck && yarn test && yarn build && yarn e2e` antes de cada commit.
- Instalar con `yarn install`: el token de lectura de GitHub Packages vive en `~/.npmrc`, no en el repositorio, y la CI lo
  recibe de `setup-node` (`PACKAGES_TOKEN`). Ningún token en archivos del repositorio.
- Lo de F7 vive en `src/portal/ia/`. El contrato de `/api/sgspe/ai/**` está en `ia/contrato.ts`: una pantalla no pide esos
  endpoints por su cuenta. La IA se ofrece por `GET /api/sgspe/ai/status` (`useEstadoDeIa`, `disponibilidadDe`) y la aceptación
  por la transición `accept` de WF-K, nunca por roles. El asistente es el panel del portal (`ia/Asistente.tsx`) sobre
  `POST /api/sgspe/ai/assistant/questions`; `/api/agent/ask` no se llama desde el navegador.
- Toda salida de la IA se dibuja con `TextoDeIa` (los marcadores se re-identifican al mostrar con los permisos de quien mira,
  nunca al guardar) y la cita con `CitaDeIa` (solo para quien abre la fuente). Aceptar nunca manda un texto con marcadores
  (`quedanMarcadores`), y toda aceptación lleva motivo.
- Ningún fuente usa `dangerouslySetInnerHTML` ni asigna `innerHTML` (`boundaries.test.ts`): el Markdown se dibuja con
  `VistaMarkdown`, que arma como elementos de React la negrita, la cursiva y el código en línea; los enlaces y el HTML quedan
  como texto.
- Los tableros de F8 viven en `src/portal/tableros/` (contrato en `tableros/contratoF8.ts`) y los entregables en
  `src/portal/entregables/` (contrato en `entregables/contrato.ts`, reglas de los tipos en `entregables/tipos.ts`): una
  pantalla no pide `/api/sgspe/deliverables/**`, `/api/sgspe/deliverable-templates` ni `/api/sgspe/indicators/**` por su
  cuenta. Los tipos de entregable y sus secciones (con `assisted` y `guide`) los da el backend
  (`GET /api/sgspe/deliverable-types`, `useTiposDeEntregable`): el portal no copia ninguna lista de secciones.
- tiptap solo se importa en `entregables/EditorMarkdown.tsx` y `entregables/nodoMencion.ts` (`boundaries.test.ts`); el editor
  va con `injectCSS: false` (su CSS vive en `src/index.css`) y lo que no sobrevive la ida y vuelta se edita como Markdown. El
  editor se carga diferido (`lazy(() => import('./EditorMarkdown'))` en `EditorDeSeccion`, con un `Suspense`): una prueba que
  interactúa con él espera al chunk con `findBy*`. Una mención es `[[person|position|stakeholder:<uuid>]]`; usar una sugerencia
  de la IA convierte `[PERSONA:<id>]` con `deSugerencia` y nunca manda otro marcador. S50 pide confirmación antes de cambiar de
  sección o de salir con cambios sin guardar (`useBlocker`, que exige el data router de `PortalApp`; en las pruebas,
  `montar(…, { datos: true })`), y un refetch de la lista no remonta un editor con cambios (un `412` con «Recargar» conserva
  el texto).
- El estado del borrador se consulta cada 5 s solo mientras está pendiente (`useEstadoDelBorrador`), y una prueba de tiempo usa
  relojes falsos. Nada sin la marca BORRADOR se descarga antes de emitir: de una candidata solo se muestra su SHA-256. La CSP
  abre `frame-src` solo a `blob:` para `PdfDialog`. La prueba de CSP de `e2e/f8.spec.ts` tolera exactamente una violación
  conocida (el estilo en línea de `react-remove-scroll` del Dialog de Radix mientras hay un diálogo abierto,
  wasichai/wasichai-ui#58); cualquier otra la hace fallar.
- S50 vive en `/reports/deliverables/:deliverableId` y, abierto desde los Reportes de un proyecto, en
  `/projects/:projectId/reports/deliverables/:deliverableId` (`rutaDeEntregable`, `entregables/tipos.ts`): «Volver» no sale del
  proyecto. El monitoreo y el catálogo de indicadores se enlazan desde S51 y desde «Mi día», a quien lee `indicator` (los dos)
  o `indicator_measurement` (el monitoreo).
