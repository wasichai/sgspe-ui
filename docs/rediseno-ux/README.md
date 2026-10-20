# Rediseño de UX del portal: orientación y jerarquía (2026-10-20)

Segunda pasada de UX sobre `sgspe-ui`, después de la revisión del 2026-10-19 (etapas 0 a 8, PR #51 a #73, plan en
`sgspe/docs/ux-revision/plan.md`). Esa revisión ya había puesto las piezas comunes: encabezado de página, migas, rastro,
panel de decisión, camino del flujo, pestañas con conteo, trazabilidad en tres grupos, «Mi día», `BotonCrear`, listas
paginadas en el servidor y la barra fija del teléfono. Esta pasada no las rehace. Audita el portal **tal como quedó**,
corrige lo que todavía desorienta o compite por la atención y deja medido el antes y el después.

El diseño canónico sigue siendo `sgspe/docs/ux/` (gana sobre este documento). Lo que aquí se propone y cambia una decisión
de ese diseño queda en «Decisiones pendientes»: no se aplicó.

## 1. Cómo se hizo

- **Lectura del código:** el shell, `navTree`, el contexto, `pantallas.ts`, el inicio, las fichas, `BotonesDeTransicion`,
  la búsqueda, `docs/ux/ux-architecture.md` y el plan de la revisión anterior.
- **Backend real** (`sgspe` en `localhost:8094`, con pocos datos de humo: 2 proyectos, 2 compromisos, 1 queja, 1
  interacción): Playwright recorrió 19 rutas a 1440 y 390 px con la cuenta de administración de desarrollo, antes y
  después. Con esa misma cuenta se tomaron las métricas de la §6, con `main` (56a6c80) servido en un puerto y la rama en
  otro.
- **API simulada de las e2e** (`e2e/api.ts`, la cuenta «Gerencia social de prueba», sin administración): antes y después
  del inicio y de tres fichas, para ver una cuenta sin privilegios con datos estables.
- **Límites:**
  - El backend local no tiene el objeto `deliverable` (los entregables responden 404) ni el WMS (503). No hubo
    pruebas con personas.
  - Las listas (QCS, tareas, interacciones, riesgos) las estaba cambiando a la vez otra sesión (rama
    `ux/listas-por-rango-y-atencion`): esta pasada no tocó esos archivos (§7).

Las capturas están en [`capturas/`](capturas) (JPEG, calidad 60): `antes/` y `despues/`; las que empiezan por `simulada-`
son de la API simulada. Las métricas crudas están en [`metricas.json`](metricas.json).

## 2. Usuarios y tareas que guiaron las decisiones

De `ux-architecture.md` §5: relacionista (registrar interacciones, acusar quejas), gestores de compromisos, QCS, riesgos e
inversión (llevar cada registro por su flujo), aprobación (decidir), jefatura y gerencia (qué amenaza el proyecto),
ejecutivo (revisión de 5 minutos), analista SIG (territorio) y auditoría (quién cambió qué). Las tareas más frecuentes y
críticas son abrir el registro que vence, hacer el siguiente paso de su flujo y volver a la lista. Por eso esta pasada se
centró en la ficha y en el camino lista → ficha → acción → lista.

## 3. Auditoría

Gravedad: **crítica** impide completar la tarea; **alta** lleva a errores o a pedir ayuda; **media** frena o confunde;
**baja** es ruido. «Observado» es lo que se vio en el portal o se leyó en el código; «Hipótesis» necesita validación con
personas.

### 3.1 Resueltos en esta pasada

| # | Pantalla o flujo | Problema observado | Evidencia | Consecuencia | Gravedad | Cambio | Riesgo | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|
| A1 | Toda sección | Una ruta que la sección no declara deja la página en blanco | `/commitments/<id>`: 0 títulos, 0 enlaces (`antes/compromiso-ficha-escritorio.jpg`); ningún `*Rutas.tsx` tenía `path="*"` | Quien sigue un enlace incompleto no sabe qué pasó ni cómo seguir | Alta | `NoEncontrada` en cada sección y en el proyecto: título, por qué puede pasar, «Ir a ‹sección›» e «Ir al inicio» | Ninguno: solo se dibuja donde antes no había nada | `NoEncontrada.test.tsx`, e2e `orientacion.spec.ts` |
| A2 | Ficha de queja, consulta, solicitud, aporte, visita, incidente y área | Las migas dicen el segmento técnico («grievances») y ninguna pestaña del proyecto queda marcada | `antes/queja-ficha-escritorio.jpg`; `ProyectoLayout` pasaba el segmento crudo a las migas | Se pierde el «dónde estoy» y el camino de vuelta a la lista | Alta | La pestaña de la ficha se deduce de su segmento (`PESTANA_DE_SEGMENTO`) | Ninguno | `contexto.test.tsx` (tres fichas), e2e `orientacion.spec.ts` |
| A3 | Encabezado de toda ficha | Todas las transiciones con el mismo peso junto a las acciones de la ficha, con la primaria en medio. Una bloqueada solo dice por qué en `title` | Queja: 6 botones (Editar, Reclasificar, Crear compromiso, Acusar recibo, Rechazar deshabilitado, Registrar desistimiento) | Cuesta ver qué hacer a continuación, y un botón gris no dice por qué | Alta | `BotonesDeTransicion agrupadas`: la primaria es la «Siguiente acción» del panel; el resto va en «Más acciones», con la razón del bloqueo a la vista y las destructivas al final | Lo poco frecuente pasa a estar a un clic más (§7) | `agrupadas.test.tsx` y las pruebas de cada ficha |
| A4 | Ficha en el teléfono | La barra fija apila las 6 acciones | 169 px, el 20 % de la pantalla (`antes/queja-ficha-telefono.jpg`) | Tapa la lectura de la ficha | Alta | La barra lleva solo la primaria y «Más acciones» (49 px, 6 %); las secundarias quedan bajo el título | Ninguno | e2e `responsivo.spec.ts` |
| A5 | Barra superior | 10 controles; el idioma y el tema, sueltos | `ux-architecture.md` §7.1 ya los pone en el menú del perfil | La barra compite con lo de todos los días | Media | Idioma, tema y salida al menú del perfil; el lema solo en pantallas muy anchas | Un clic más para cambiar idioma o tema, algo ocasional | `I18n.test.tsx`, `ThemeMenu.test.tsx` |
| A6 | Búsqueda en el teléfono | El botón «Buscar» no tiene nombre accesible | El texto está en un `<span class="hidden md:inline">` | El lector de pantalla anuncia un botón sin nombre | Media | `aria-label` siempre | Ninguno | `BusquedaGlobal.test.tsx` |
| A7 | Búsqueda global | Los resultados no dicen su proyecto ni su estado. Sin resultados no hay guía. La consulta se pierde al cerrar. Dentro de un proyecto no lo prioriza (pedido en §7.3) | `BusquedaGlobal.tsx` | Hay que abrir resultados para reconocerlos y repetir la búsqueda | Media | Proyecto y estado bajo cada resultado; ayuda sin resultados; la consulta queda en `sessionStorage`; «En este proyecto / En todos sus proyectos» | Ninguno: lee lo que la API ya devuelve y el servidor sigue acotando la lectura | `BusquedaGlobal.test.tsx` |
| A8 | Inicio ejecutivo | Fechas, ámbito, «Actualizar» y proyectos antes de «Lo que necesita atención hoy». El trabajo propio no aparece | 5 controles antes; atención a 317 px | El inicio empieza pidiendo decisiones | Media | Filtros plegados en una línea que resume lo aplicado (abiertos si la URL trae alguno). «Su trabajo pendiente» primero, solo si hay algo | Quien cambia de periodo hace un clic más | `RevisionEjecutivaPage.test.tsx` |
| A9 | Tarjetas de porcentaje | Se lee «0» y debajo «0 / 1 · %» | `antes/qcs-escritorio.jpg` («QCS absueltas») | La cifra no se entiende | Media | «0 %» y debajo «0 de 1» | Ninguno | `componentes.test.tsx` |
| A10 | Una lista cuyo objeto el servidor no tiene | En rojo: «El registro no existe o no es de sus proyectos», con un «Reintentar» que no sirve | `antes/reportes-escritorio.jpg` | Parece un error de la persona o de permisos | Media | «Esta información no está disponible en su organización», sin alarma | Un 404 real de una lista se dice igual (es el mismo caso) | `LecturaConEstados.test.tsx` |
| A11 | Reportes, entregables | «Nuevo entregable» deshabilitado y dos líneas que mandan al selector | `antes/reportes-escritorio.jpg` | Crear depende de un control que no se ve | Media | `BotonCrear` también abre un diálogo: pide el proyecto o va directo al único | Ninguno | `EntregablesDeReportes.test.tsx` |
| A12 | Territorio | 6 botones del mismo peso con la primaria en medio. El menú de otras pantallas es un «⋯» sin texto | `antes/territorio-escritorio.jpg` | No se distingue lo principal; el ícono no dice qué hay detrás | Media | Encabezado común: Mapa · Tablero como vistas, Importar y Exportar, «Nueva comunidad» primaria y lo ocasional en «Más acciones» (con texto en todas las pantallas) | Calidad de datos y la captura a un clic más | `TerritorioPage.test.tsx`, `rutasF6.test.tsx` |
| A13 | Resumen del proyecto | «Registrar interacción», «Devolver», «Aprobar» y «Anular el proyecto» con el mismo peso | Proyecto en revisión | Lo que decide la aprobación queda al lado de lo destructivo | Media | Activo: «Registrar interacción» es la primaria. Si no está activo: su decisión (enviar a revisión, aprobar, reanudar). Devolver y anular en el menú | Ninguno | `ResumenPage.test.tsx`, `siguienteAccion.test.ts` |
| A14 | Todo error de carga | «Los filtros se conservan» también en fichas, tarjetas y diálogos | `comun.errorDeCarga` | Promete algo que no aplica | Baja | Solo «No se pudo cargar esta información», con motivo y «Reintentar» | Ninguno | las pruebas que lo citaban |
| A15 | Panel de decisión | «Desde —» cuando el registro no trae `state_changed_at` | Fichas de humo | Ruido sin información | Baja | La línea no se dibuja | Ninguno | `PanelDeDecision.test.tsx` |
| A16 | Ficha de compromiso | Un «—» suelto entre los chips cuando no hay monto | `simulada-compromiso-ficha-telefono.jpg` | Ruido | Baja | Sin monto, sin chip | Ninguno | `FichaCompromisoPage.test.tsx` |
| A17 | Página no encontrada | Sin `<h1>` ni título de documento | — | El historial y los lectores no la nombran | Baja | `h1` y «Esta página no existe · SGSPE» | Ninguno | `NoEncontrada.test.tsx` |

### 3.2 Observados y no resueltos

| # | Pantalla o flujo | Problema | Evidencia | Gravedad | Por qué no se hizo | Propuesta |
|---|---|---|---|---|---|---|
| P1 | Mis tareas (global) | «Las tareas para tomar se ven dentro de cada proyecto: elija uno en el selector» | `antes/tareas-escritorio.jpg` | Media | `MisTareasPage` lo cambia la otra sesión (D10) | La vista «Para tomar» global con el proyecto como columna (plan anterior, etapa 3) |
| P2 | Listas | El vacío no dice el siguiente paso («No hay riesgos en esta vista.») | Riesgos, Tareas | Media | Listas en D10 | `Vacio` con la acción de crear (`BotonCrear`) y, si hay filtros, «Quitar filtros» |
| P3 | Lista de QCS a 1440 px | Nueve columnas: «Responsable» queda cortada y la tabla se desplaza | `antes/qcs-escritorio.jpg` | Media | `AtencionPage` en D10 | Bajar Canal y Categoría a una segunda línea de la fila, o mostrarlas solo desde 1600 px |
| P4 | Territorio | Su propio «Proyecto del mapa» además del selector de la barra | `despues/territorio-escritorio.jpg` | Media | El mapa necesita «Todo el territorio», que no es «Todos los proyectos»: es una decisión de diseño | Decidir en `docs/ux` si el mapa sigue a la barra y suma «Todo el territorio» |
| P5 | Riesgos sin riesgos | Matriz 5×5 llena de ceros sobre «No hay riesgos en esta vista» | `antes/riesgos-escritorio.jpg` | Baja | `RiesgosPage` en D10 | Sin riesgos, solo el vacío con «Identificar riesgo» |
| P6 | Camino del flujo | Sin etiqueta en el workflow, muestra el nombre técnico (`pending_approval`) | `simulada-compromiso-ficha-escritorio.jpg` | Baja | Con el backend real las etiquetas existen | Mientras no llega la etiqueta, no dibujar el paso |

### 3.3 Hipótesis que necesitan personas

- **H1. Navegación por grupos de tareas.** 13 secciones planas pueden ser muchas para quien usa el portal de vez en
  cuando. Agruparlas («Mi trabajo», «Proyectos y territorio», «Relacionamiento y compromisos», «Riesgos», «Inversión»,
  «Documentos e informes») choca con RNF-USA-001 (el mismo orden para todos) y con `ux-architecture.md` §6.2 y §7.2. No se
  aplicó: ver §8.
- **H2. «QCS».** La sigla de la barra lateral lleva el nombre completo en `title` y para lectores de pantalla. Falta saber
  si quien no es de la gestión de quejas la entiende.
- **H3. Lo que pasó a «Más acciones».** Reclasificar, crear un compromiso desde la queja, «Informar riesgo de atraso» y
  las transiciones de excepción quedan a un clic más. Hay que medir cuánto se usan antes de decidir si alguna vuelve a la
  vista.
- **H4. Interacción con 8 pestañas.** Puede ser demasiado; se necesita ver qué pestañas usa el relacionista en campo.

## 4. Arquitectura de información y navegación

**Se conserva la estructura** de `ux-architecture.md` §6: tres contextos (global, proyecto, territorio), las 13 secciones
en su orden, Project 360 con nueve pestañas y «Más», y las fichas bajo su proyecto con una sola URL. La revisión anterior
ya había resuelto la sección marcada dentro de un proyecto, los conteos de las pestañas y el selector en el teléfono. Lo
que faltaba para responder «¿dónde estoy y cómo vuelvo?» eran casos sueltos: A1, A2 y A17.

El contexto se lee así, sin elementos nuevos:

| Contexto | Lo dice | Cómo se vuelve |
|---|---|---|
| Global | El selector de la barra superior («Todos los proyectos»), sin migas | La barra lateral |
| Proyecto | El selector con el proyecto, las migas «Proyectos / código · nombre / pestaña», la pestaña marcada y la barra lateral en la sección del módulo | Las migas o las pestañas |
| Ficha | Las migas terminan en el registro; antetítulo con tipo y código; pestaña del módulo marcada | La miga de la pestaña (la lista) o el rastro |
| Pantalla abierta desde una ficha | El rastro (el recorrido) sobre las migas | El rastro |
| Ruta que no existe | «Esta página no existe» con la sección y el inicio | Sus enlaces |

## 5. Patrones compartidos

**Encabezado de página** (`EncabezadoDePagina`):

- Título.
- Antetítulo con tipo y código.
- Chips de estado.
- Descripción.
- Vistas del módulo (Lista · Tablero, Mapa · Tablero).
- Hasta dos secundarias.
- «Más acciones» **con su texto**.
- **Una** primaria al final.

En la ficha y en el teléfono, solo la primaria y «Más acciones» van en la barra fija.

**Acciones de ficha** (`BotonesDeTransicion agrupadas`):

- La primaria es la transición del camino (`siguienteTransicion`, la misma «Siguiente acción» del panel de decisión).
- Si la ficha tiene su propia primaria (registrar una interacción, una nueva revisión), la del camino queda a la vista
  como secundaria.
- El menú lleva el resto de las transiciones, las acciones poco frecuentes de la ficha (`mas`, con `ITEM_DE_MENU`) y, tras
  un separador, las destructivas, que nombran el objeto.
- Una transición bloqueada dice por qué bajo su nombre.
- Las comprobaciones de las reglas corren con el menú cerrado.
- Elegir cierra el menú y el foco vuelve a «Más acciones» cuando se cierra el diálogo.
- Los paneles y cajones con pocas transiciones (verificación, tarea, alerta) conservan el grupo completo.

**Crear** (`BotonCrear`): dentro de un proyecto crea ahí. Con el alcance global pide el proyecto entre los que la cuenta
escribe, o va directo al único. Ahora también abre un diálogo (`alElegir`) en lugar de una ruta.

**Estados:**

- Página no encontrada con salida.
- Lista sin su objeto: «no disponible en su organización».
- Error de carga sin promesas que no aplican.
- Porcentaje con signo y base.

**Búsqueda:** contexto del resultado, ayuda sin resultados, consulta conservada y alcance del proyecto.

**Inicio:** lo propio antes que la cartera y los filtros plegados con su resumen.

## 6. Resultado medido

Con Playwright, el backend real y la misma cuenta; `main` (56a6c80) frente a esta rama. Son métricas de la interfaz, no
de personas.

| Métrica | Antes | Después |
|---|---|---|
| Controles en la barra superior (escritorio) | 10 | 7 |
| Controles visibles antes de «Lo que necesita atención hoy» (inicio ejecutivo) | 5 | 1 |
| Altura de «Lo que necesita atención hoy» en la pantalla | 317 px | 227 px |
| Acciones visibles en el encabezado de la ficha de queja | 6 | 3 (Editar, Más acciones, Acusar recibo) |
| Acciones visibles en el encabezado de la ficha de interacción | 4 | 3 |
| Acciones del encabezado de Territorio | 6 | 4 |
| Barra fija de la ficha a 390 px | 169 px (20 % de la pantalla), 6 botones | 49 px (6 %), 2 botones |
| Ruta inexistente | en blanco: 0 títulos, 0 enlaces | 1 título, 2 enlaces |
| Botón Buscar con nombre accesible en el teléfono | no | sí |
| Clics para «Acusar recibo» desde la ficha | 1 | 1 |
| Clics para «Reclasificar» desde la ficha | 1 | 2 |
| Desplazamiento horizontal a 390 px (17 pantallas de `responsivo.spec.ts`) | ninguno | ninguno |

## 7. Implementación

Rama `ux/rediseno-orientacion`, un commit por cambio (Conventional Commits), con la prueba antes del código:

- `fix`: la ficha fuera del segmento de su pestaña y la ruta que no existe orientan (A1, A2).
- `feat`: una sola acción primaria en cada ficha y el resto en «Más acciones» (A3, A4).
- `feat`: el idioma, el tema y la salida pasan al menú del perfil (A5).
- `fix`: un porcentaje se lee «0 %» con su base y una lista sin su objeto no alarma (A9, A10).
- `feat`: encabezados con una primaria y «Más acciones» con nombre (A12).
- `feat`: «Nuevo entregable» pide el proyecto como toda alta (A11).
- `feat`: la revisión ejecutiva abre con lo que pide atención (A8).
- `feat`: la búsqueda dice el proyecto y el estado y orienta sin resultados (A6, A7).
- `feat`: el resumen del proyecto tiene una sola primaria (A13).
- `test(e2e)`: el flujo de una queja se orienta y una ruta que no existe dice cómo seguir.
- `fix`: la página que no existe tiene su título y el panel de decisión no dice «Desde —» (A15, A17).
- `fix`: un error de carga no dice que conserva filtros donde no los hay (A14).
- `fix`: sin monto, el encabezado del compromiso no dibuja un «—» suelto (A16).

Archivos principales:

- `componentes/Pagina.tsx` (`ITEM_DE_MENU`, menú con nombre, barra fija solo con la primaria).
- `transiciones/BotonesDeTransicion.tsx` (`agrupadas`, `mas`).
- `fichas/siguienteAccion.ts`.
- `componentes/BotonCrear.tsx` y `componentes/CrearRelacionado.tsx`.
- `componentes/KpiCard.tsx`, `componentes/LecturaConEstados.tsx`, `componentes/PanelDeDecision.tsx` y
  `componentes/VistasDelModulo.tsx`.
- `contexto/ProyectoLayout.tsx` y `componentes/Migas.tsx`.
- `shell/NoEncontrada.tsx`, `shell/AppShell.tsx`, `shell/Perfil.tsx` y los once `*Rutas.tsx`.
- `busqueda/BusquedaGlobal.tsx`.
- `tableros/RevisionEjecutivaPage.tsx` y `pages/AtencionRequerida.tsx`.
- `proyectos/ResumenPage.tsx`.
- `territorio/TerritorioPage.tsx`.
- `entregables/EntregablesDeReportes.tsx`.
- Las fichas de queja, consulta, compromiso, interacción, grupo, riesgo, aporte, programa y acuerdo.
- Los textos de `textos/` en los dos idiomas.

Contratos que no cambiaron:

- Rutas y URL.
- Permisos y guardas, sin nombres de rol.
- Escrituras, motivo, `If-Match` e `Idempotency-Key`.
- Comprobación de transiciones.
- Confidencialidad y lectura acotada por el servidor.
- Dependencias.
- Tokens `sg-*`.

## 8. Decisiones pendientes y riesgos

1. **Navegación por grupos (H1).** Cambiar la barra lateral a grupos exige revisar RNF-USA-001 y `ux-architecture.md` §6.2
   y §7.2 en `sgspe`. Antes conviene un recorrido con dos o tres personas nuevas: ¿encuentran la sección sin ayuda con la
   barra actual (y la búsqueda ahora más útil)?
2. **El mapa y la barra (P4).** Decidir si Territorio sigue al selector de la barra.
3. **Lo que vuelve de «Más acciones» (H3).** Medir el uso de reclasificar y de crear un compromiso desde la queja.
4. **Listas (P1, P2, P3, P5).** Retomarlas cuando la rama de listas por rango y atención se integre, con el mismo criterio:
   una primaria, el vacío con su siguiente paso y la tabla sin desplazarse a 1440 px.
5. **Riesgo.** El documento `docs/ux/design-system.md` §6.1 describe la barra de la ficha: hay que sumarle la regla de
   «una primaria + Más acciones» para que el diseño y el portal no diverjan.

## 9. Pruebas ejecutadas

- `yarn format`, `yarn lint` y `yarn typecheck`: sin cambios ni errores.
- `yarn test`: 2166 pruebas en 188 archivos, todas en verde (antes de esta pasada: 2143 en 186).
- `yarn build` y las e2e de Playwright contra la build en otro puerto: 62 recorridos en verde, incluidos los 2 nuevos de
  `orientacion.spec.ts`.
- Recorrido manual con Playwright contra el backend real a 1440 y 390 px: sin errores de página, salvo las respuestas
  esperadas del entorno (404 de entregables y 503 del WMS).
