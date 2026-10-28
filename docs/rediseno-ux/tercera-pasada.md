# Tercera pasada de UX del portal: secuencia de uso e información (2026-10-28)

Esta pasada viene después de las dos de octubre: la auditoría U-01 a U-43 (`sgspe/docs/ux/redesign/`) y la de orientación A1
a A24 ([README](README.md), PR #75 y #76). No las rehace. Revisa el portal tal como quedó en `main` (7852e90) y busca tres
cosas: lo que quedó pendiente, lo que se aplicó de forma desigual entre módulos y lo que se perdió al integrar.

El diseño canónico sigue siendo `sgspe/docs/ux/`, que manda sobre este documento. Los cambios que esta pasada le propone van
en un PR aparte en `wasichai/sgspe` (§7).

## 1. Cómo se hizo

**Lectura del código.** Tres revisiones en paralelo del portal actual:
- orientación y arranque del día: shell, inicio, búsqueda, avisos, tareas y Project 360;
- avanzar un registro y registrar datos: fichas, transiciones, formularios y cajones;
- encontrar, leer y decidir: listas, tableros, territorio, IA, aprobaciones, exportaciones y entregables.

Cada hallazgo cita `archivo:línea`, y los de más peso se volvieron a verificar a mano.

**Capturas.** Las 42 de usuario de `sgspe/docs/manuals/assets/screenshots/user/`, tomadas sobre la demo viva el
2026-10-24, más las de [`capturas/despues/`](capturas/despues). Las de los manuales son de poco antes de que se integraran
#75 y #76, así que ningún hallazgo sale solo de una captura: todos se confirmaron en el código.

**Límites.**
- **Playwright.** No se pudo levantar el portal en esta sesión: los `@wasichai/*` vienen de GitHub Packages, que respondió
  401 sin un token `read:packages`.
- **Pruebas locales.** Por lo mismo no se corrieron en local `yarn test`, `typecheck`, `build` ni `e2e`. Cada cambio llegó
  con su prueba escrita primero; el formato se comprobó con Prettier 3.9.9, y la CI del PR validó el resto.
- **Personas.** No hubo pruebas con personas. Lo que necesita verlas queda en §6.

## 2. Criterio

En cada paso, la persona tiene que poder contestar cinco preguntas:

1. ¿Dónde estoy?
2. ¿Qué me toca?
3. ¿Qué falta y cómo lo resuelvo aquí mismo?
4. ¿Qué pasó con lo que hice?
5. ¿Qué sigue?

Las dos pasadas anteriores resolvieron casi todo lo de la 1 y la 2. Lo que queda está sobre todo en la 3, la 4 y la 5: el
portal informa bien, pero obliga a ir a otro lugar para actuar y casi nunca confirma qué pasó ni ofrece lo que sigue.

## 3. Hallazgos

**Gravedad:**
- **alta:** lleva a un error o hace que la persona crea algo falso;
- **media:** obliga a rodeos o a recordar;
- **baja:** es ruido.

**Estado:** «Hecho» va con su commit en este PR; «Ola N» es lo propuesto en §5.

### 3.1 Regresiones y lo que engaña (ola 0, hecha)

| # | Pantalla o flujo | Problema observado | Evidencia | Gravedad | Cambio | Estado | Criterio |
|---|---|---|---|---|---|---|---|
| T-01 | Territorio | A24 se perdió al integrar #76: el mapa volvió a tener su propio «Proyecto del mapa» y el de la barra, desde `/territory`, llevaba al mapa de un proyecto | `territorio/TerritorioPage.tsx:441-451`, `contexto/rutas.ts:13`; `git diff aa22606 c0918f8` | Media | En `/territory/**` el selector de la barra lee y escribe `?project=` y dice «Todo el territorio»; el mapa ya no tiene uno propio | Hecho | `contexto.test.tsx` (lente), `TerritorioPage.test.tsx` |
| T-02 | Resumen del proyecto | A13 se perdió al integrar #76: «Registrar interacción», «Devolver», «Aprobar» y «Anular» con el mismo peso | `proyectos/ResumenPage.tsx:120-132`; `project` faltaba en `CAMINO_DE` | Alta | Una primaria: la decisión mientras no está activo, o «Registrar interacción»; lo demás en «Más acciones» | Hecho | `ResumenPage.test.tsx`, `siguienteAccion.test.ts` |
| T-03 | Toda ficha | A3 se perdió: la razón de una transición bloqueada iba solo en `title` y en `sr-only` | `transiciones/BotonesDeTransicion.tsx:199-208` | Alta | La razón en una línea bajo el nombre, también en «Más acciones» | Hecho | `CabeceraDeFicha.test.tsx` |
| T-04 | Toda pantalla de un proyecto | El chip del estado del proyecto iba tras la última miga: «DEMO-Q-03 · Borrador» en una queja en atención | `contexto/BarraDeContexto.tsx:28`; `capturas` 17, 21, 25, 29 | Alta | El estado va en la miga del proyecto, anunciado como «Estado del proyecto:» | Hecho | `Migas.test.tsx` |
| T-05 | Inicio | Con una lectura fallida, «Lo que me toca hoy» decía «Nada pendiente a su cargo.» | `pages/aSuCargo.ts:18-27` sin `isError`; `pages/LoQueMeToca.tsx:163-173` | Alta | Cada lectura fallida dice qué no se leyó, con su motivo y «Reintentar»; «nada pendiente» solo si todas respondieron | Hecho | `LoQueMeToca.test.tsx` |
| T-06 | Inicio y barra del teléfono | Un aviso que pide acción salía del inicio al abrirlo; la campana y la barra inferior contaban cosas distintas | `pages/EsperanSuDecision.tsx:57` (`!a.read`), `shell/insignias.ts:18` | Alta | Se listan los ACTION activos con «Sin leer» como marca; las dos insignias cuentan los sin leer | Hecho | `EsperanSuDecision.test.tsx`, `ShellResponsive.test.tsx` |
| T-07 | Inicio | «venció el 17/10/2026» junto a «desde el 23 oct. 2026» | `LoQueMeToca.tsx:106` usaba `textoDeDia`, el formato de escritura de `CampoFecha` | Baja | `diaPe`, la fecha de todo el portal | Hecho | `LoQueMeToca.test.tsx`, `Inicio.test.tsx` |
| T-08 | Modo rápido, evidencia, actor, textos | «REUNION INFORMATIVA · 2026-10-28» como título guardado; «application/pdf»; el tipo de organización en mayúsculas; «ALTA o CRITICA» en dos textos | `RegistroRapido.tsx:65`, `FichaEvidenciaPage.tsx:147`, `FichaActorPage.tsx:72`, `textos/fichaQueja.ts:44`, `textos/comun.ts:256` | Media | Rótulos legibles («Reunión informativa · 28 oct. 2026», «PDF», «de severidad alta o crítica») | Hecho | `RegistrarInteraccionPage.test.tsx`, `documentos.test.tsx` |
| T-09 | Accesibilidad | Casillas que se anunciaban con el UUID; la «×» del territorio de 12 px; el chip del teléfono de unos 20 px; menús sin la superficie elevada (DD-15) | `GruposPage.tsx:181`, `Lista.tsx:149,209`, `BarraDeContexto.tsx:34-44`, `SelectorDeProyecto.tsx:44`, `Perfil.tsx:93`, `ProyectoLayout.tsx:203`, `Campana.tsx:94`, `Pagina.tsx:218` | Media | Nombre del registro, objetivos de 24 y 32 px como mínimo y `bg-sg-surface-raised` | Hecho | `GruposPage.test.tsx`, `Pagina.test.tsx` |
| T-10 | Mis tareas | El tablero ignoraba «Vencidas» con su chip a la vista; «Y N más.» no llevaba a ningún lado; el calendario no decía cuándo se cortaba; «Tareas del proyecto» mostraba solo las propias | `MisTareasPage.tsx:136,352,384`, `textos/tareas.ts:4` | Media | El tablero y el calendario aplican la situación; «Ver las N restantes en la lista»; aviso del tope; «Mis tareas en este proyecto» | Hecho | `MisTareasPage.test.tsx` |
| T-11 | Resumen del proyecto | La franja decía «3 / 10 · %», lo que A9 ya corrigió en `KpiCard`; «Etapa: —» y «Fase de exploración: —» | `ResumenPage.tsx:112-117,426-431` | Baja | «30 %» con «3 de 10» debajo; sin dato, la línea no se dibuja | Hecho | `ResumenPage.test.tsx` |
| T-12 | Avisos | Sin el módulo instalado decía «No tiene avisos.» | `avisos/AvisosPage.tsx:102-103` | Baja | «Esta información no está disponible en su organización.» | Hecho | `avisos.test.tsx` |
| T-13 | Biblioteca | Cada tecla de la búsqueda pedía al servidor y reescribía la URL | `documentos/BibliotecaPage.tsx:123` | Baja | La caja de `BarraDeFiltros`, con espera de 300 ms | Hecho | `documentos.test.tsx` |
| T-14 | Toda transición | Después de una transición no se releían las tareas ni los avisos: el acuse hecho seguía en «Mi día» | `transiciones/api.ts:41-48` | Media | Se invalidan `['records','task']` y `['notifications']` | Hecho | `transiciones.test.tsx` |

### 3.2 Avanzar un registro (ola 1, hecha)

| # | Pantalla o flujo | Problema observado | Evidencia | Gravedad | Cambio | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| T-15 | Ficha con un bloqueo | La pantalla dice «Para «Resolver» falta «Resolución»: complételo y vuelva a intentar.», pero no ofrece hacerlo: hay que cerrar, buscar «Editar» y el campo entre 17 | `CabeceraDeFicha.tsx:84-97`, `PanelDeDecision.tsx:65-69`; el enlace `resolver` de 05 §1.2 nunca se implementó | Alta | «Completar ‹campo›» junto al bloqueo, en un cajón con solo ese campo y el motivo si el objeto lo exige; al guardar se vuelven a comprobar las reglas | Hecho (`CompletarCampo`). El enlace a una pestaña no: lo que faltaba ahí (una entrega) lo resuelve T-21 | `CabeceraDeFicha.test.tsx`, `FichaAportePage.test.tsx` |
| T-16 | Resolver una queja, responder una consulta, cerrar un riesgo o un incidente | Los datos que exige la transición se escriben en «Editar», con su motivo, y después la transición pide otro motivo | `textos/fichaConsulta.ts:9-10`, `FichaQuejaPage.tsx:55-73`, `FichaRiesgoPage.tsx:64-84` | Alta | El diálogo pide los datos del propio paso (lista explícita por objeto en `DatosDelPaso.tsx`), los guarda con `If-Match` y aplica la transición sobre la versión nueva con un solo motivo. No pide los que cambian qué reglas se evalúan (el tipo de un aporte). La consulta deja «Escribir la respuesta» | Hecho | `transiciones.test.tsx`, `FichaConsultaPage.test.tsx`, `incidentes.test.tsx` |
| T-17 | Diálogo de transición | «Qué pasará» dice lo mismo en toda transición y el botón dice «Confirmar» | `DialogoDeTransicion.tsx:109-112`, `textos/transiciones.ts:41-42` | Media | El verbo en el botón («Cancelar el compromiso», con peligro, si cierra el registro) y «Qué pasará» con lo que el paso hace además del estado, solo donde el modelo lo hace (automatizaciones AUT-01, AUT-05, AUT-10 y los ítems congelados del aporte) | Hecho, salvo los motivos sugeridos: necesitan una lista que salga de los equipos (H5) | `transiciones.test.tsx` |
| T-18 | Después de una transición | «Listo: el registro está en «Acusada».» se va a los 6 s, no dice qué sigue y el foco queda en el cuerpo | `BotonesDeTransicion.tsx:23,78-82`, `foco.ts:13-14` | Media | El mensaje queda hasta la siguiente acción, dice «Ahora: ‹siguiente acción›» con las transiciones releídas y recibe el foco | Hecho | `transiciones.test.tsx` |
| T-19 | Panel de decisión | «Siguiente acción: Aprobar» sin decir a quién le toca; «Nada pendiente» con el registro esperando a otra persona | `fichas/useSiguienteAccion.ts:11-18`, `PanelDeDecision.tsx:71` | Media | «Le toca a usted», «Usted no está asignado a este proyecto» o «El siguiente paso lo da otra persona»; «Nada pendiente» solo en un estado final. El panel tampoco presenta como falta lo que el diálogo pedirá («Al darla se le pedirán…») | Hecho. No nombra a la otra persona: saberlo exige leer quién tiene el rol | `PanelDeDecision.test.tsx` |
| T-20 | Programa, entregable, incidente, alerta | Sin `CabeceraDeFicha`: todas las transiciones a la vista y «Cancelar el programa» junto a «Enviar a aprobación» | `inversion/FichaProgramaPage.tsx:106-118`, `entregables/Emitir.tsx:46`, `PanelDelBorrador.tsx:120-123` | Alta | El patrón común: `CabeceraDeFicha`, `PanelDeDecision` y el camino del flujo | Hecho en programa, incidente y alerta. El entregable (S50) queda como está: es un espacio de trabajo (secciones, borrador y emisión por comando) que ya muestra su camino | `FichaProgramaPage.test.tsx`, `incidentes.test.tsx`, `alertas.test.tsx` |
| T-21 | Entrega de un compromiso | No dice qué evidencia falta (la del aporte sí) y al guardar no ofrece «Registrar cumplimiento»: 12 a 13 clics | `compromisos/PestanaEntregas.tsx:59,242,371` frente a `inversion/EntregaDelAporte.tsx:287-288,421-431` | Alta | «Para el cumplimiento faltan: …» con la regla D9 del backend, la evidencia que sigue propuesta y «Registrar cumplimiento» en la misma pestaña | Hecho | `PestanaEntregas.test.tsx` |
| T-22 | Plazos en fichas y listas | Solo la fecha absoluta y la categoría; ningún «vence en 3 días» | `PanelDeDecision.tsx:77-86`, `CompromisosPage.tsx:211`, `AtencionPage.tsx:395`, `MisTareasPage.tsx:287` | Media | `cuandoRelativo` (`datos/fechas.ts`) y `CuandoVence`, con la fecha exacta en `<time>` y solo mientras el plazo corre. En días hábiles solo el acuse de una queja, el único plazo que el backend cuenta así | Hecho en el panel y en las columnas de Compromisos, QCS, Tareas y Riesgos | `fechas.test.ts`, `PanelDeDecision.test.tsx` |
| T-23 | Panel y cuerpo de la ficha | «Sin responsable» y «Sin fecha límite» ocupan dos de cuatro casillas en objetos sin responsable ni plazo; el compromiso y el programa dibujan 18 pares con «—» | `FichaAportePage.tsx:163`, `FichaCompromisoPage.tsx:276-311`, `FichaProgramaPage.tsx:163-180`; captura 29 | Baja | La tarjeta no se dibuja si el objeto no tiene ese dato; si lo tiene y está vacío, sí («Sin responsable» importa). `CamposPlegables` en el compromiso y el programa | Hecho | `PanelDeDecision.test.tsx`, `FichaCompromisoPage.test.tsx` |
| T-24 | Historial | El correo tal cual, solo el día y solo el nombre del campo («Cambió (Estado)») | `componentes/Historia.tsx:37-43` | Media | La hora de Lima, `Persona` y «Cambió el estado: «Acusada» → «En atención»» con las etiquetas del flujo; de los demás campos, cuáles cambiaron y nunca su valor | Hecho | `Historia.test.tsx` |
| T-24b | Aporte solicitado | A quien solo tenía «Aprobar sin revisión interna», el panel le decía «Nada pendiente» | `fichas/siguienteAccion.ts:26` | Media | `approve_direct` en el camino del aporte | Hecho (hallado al implementar T-15) | `siguienteAccion.test.ts` |

### 3.3 Registrar sin perder trabajo (ola 2, hecha)

| # | Pantalla o flujo | Problema observado | Evidencia | Gravedad | Cambio | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| T-25 | Los 39 cajones | Ninguno avisa al cerrarse con cambios: Esc, un clic fuera, la X o Atrás descartan la evaluación de 15 escalas o una entrega con evidencias ya subidas | `componentes/Drawer.tsx:25`; `grupos/EvaluacionDrawer.tsx:185-193` | Alta | `Drawer` con `conCambios` y el diálogo de confirmación; lo escrito cuenta como guardado solo cuando el guardado salió bien | Hecho. La evaluación pasa `conCambios`: sus escalas son botones y el cajón no las veía | `Drawer.test.tsx`, `FichaGrupoPage.test.tsx` |
| T-26 | Cajones de edición | El motivo va arriba, fuera del formulario, sin validar: el error sale en otro lugar y el campo no se marca | Siete sitios, de `FichaCompromisoPage.tsx:236-245` a `AntesDeAprobar.tsx:131-139` | Alta | `useMotivo` y `CampoDeMotivo`: el motivo se valida en su campo antes de enviar y recibe el foco | Hecho en los diez cajones con motivo. Queda arriba del formulario: el «Motivo» de `DynamicForm` usa tú y otros rótulos | `FichaQuejaPage.test.tsx`, `FichaAportePage.test.tsx` |
| T-27 | Formularios | Los obligatorios no se marcan; el foco no va al primer error; «Complete este dato.» genérico | `Campo.tsx:27-29`, `NuevaQcsPage.tsx:159-190`, `RegistrarInteraccionPage.tsx:308` | Media | En un alta por pasos, el foco va al título del paso nuevo o al primer control inválido; `Campo` dice `aria-required` | Hecho. La marca visible del obligatorio no: cambia el nombre accesible de cientos de controles en las pruebas, y queda para una pasada propia | `FormularioPorPasos.test.tsx` |
| T-28 | Altas largas | Borrador y «Guardar y salir» solo en el alta de compromiso, y sin los ids elegidos | `NuevoCompromisoPage.tsx:160-190` | Media | `useBorradorLocal` (`datos/borrador.ts`): guarda medio segundo después del último cambio y al salir, con los ids elegidos; la clave lleva la cuenta y «Cerrar sesión» los borra | Hecho en compromiso, interacción (los dos modos), QCS y evaluación. Una QCS confidencial no deja borrador y la persona (restringida) nunca se guarda. El aporte no: su alta es el formulario de core, que no expone lo escrito | `borrador.test.tsx`, `NuevoCompromisoPage.test.tsx`, `RegistrarInteraccionPage.test.tsx`, `NuevaQcsPage.test.tsx`, `FichaGrupoPage.test.tsx`, `BarraSuperior.test.tsx` |
| T-29 | Modo rápido de campo | Pasar al asistente borra lo cargado, y el modo rápido no avisa al salir | `relacionamiento/ConmutadorDeModo.tsx:17`, `RegistroRapido.tsx` | Alta | El conmutador lleva el tipo, los grupos, los asistentes contados y el punto (`traspaso.ts`); lo demás queda en el borrador del modo que se deja. El modo rápido avisa al salir | Hecho | `traspaso.test.ts`, `RegistrarInteraccionPage.test.tsx` |
| T-30 | Valores iniciales | «Sí, ya se realizó» deja la fecha vacía; una QCS creada desde una interacción no propone sus grupos ni su lugar; el responsable se elige escribiendo un UUID | `RegistrarInteraccionPage.tsx:132`, `NuevaQcsPage.tsx:114-125`, `SelectorDeUsuario.tsx:48-62` | Alta | «Sí, ya se realizó» propone la hora de ahora; desde una interacción, la QCS propone su fecha y su único grupo, y el compromiso, sus grupos como solicitantes y su día como fecha del acuerdo; «Asignarme» en el responsable; «¿En qué proyecto?» propone el último elegido | Hecho. La lista del equipo del proyecto en el responsable no: el directorio de usuarios solo lo lee quien administra la organización (UPS-06), y los demás escriben el correo | `RegistrarInteraccionPage.test.tsx`, `NuevaQcsPage.test.tsx`, `NuevoCompromisoPage.test.tsx`, `componentesF3.test.tsx`, `BotonCrear.test.tsx` |
| T-31 | Elegir grupos de interés | Listas largas sin búsqueda (85 en la demo) | `NuevaQcsPage.tsx:366-375`, `RegistrarInteraccionPage.tsx:392-410`, `NuevoCompromisoPage.tsx:577-596` | Media | `EleccionDeGrupos`: con seis grupos o más, búsqueda por el nombre que ve quien mira, sin tildes; lo elegido no se esconde al buscar | Hecho en la interacción, el modo rápido y los solicitantes. La QCS elige un solo grupo con un `select`, que ya salta al teclear | `EleccionDeGrupos.test.tsx` |
| T-32 | Registrar interacción | «Programar» se deshabilita en el paso 5 por una fecha del paso 1, sin decirlo | `RegistrarInteraccionPage.tsx:298` | Media | No se deshabilita: lleva al paso 1 con el error | Hecho | `RegistrarInteraccionPage.test.tsx` |
| T-33 | Interacción | No se puede editar: lo que «Guardar y completar después» promete solo vale para participantes, preguntas y acta | `proyectos/rutasEnProyecto.ts:78-80`, `FichaInteraccionPage.tsx:132-170` | Alta | «Editar» en un cajón con el título, el objetivo, el tipo y el lugar, ofrecido con `usePuedeEditar('engagement')` | Hecho | `FichaInteraccionPage.test.tsx` |
| T-34 | Edición de una ficha | 16 a 23 campos en un cajón para cambiar uno; «Guardar» al final | `FichaCompromisoPage.tsx:46-70`, `FichaRiesgoPage.tsx:64-84` | Media | `EditarSeccion`: «Editar» junto al título de cada sección, con solo sus campos; las acciones del formulario, fijas al pie del cajón | Hecho en las QCS y el riesgo. El compromiso no tiene secciones: su resumen es una lista | `EditarSeccion.test.tsx` |
| T-35 | Alta de aporte | 17 campos y el motivo en un cajón; los ítems, uno por cajón | `inversion/ProgramasPage.tsx:41-62,497-527` | Media | «Qué pasará» en el alta, el aviso de la ficha que dice qué sigue y, en los ítems, el cajón que queda abierto para el siguiente | Hecho, salvo los tres pasos: crear el aporte y sus ítems en una sola alta exige deshacer a medias si un ítem falla, y queda para cuando el backend lo haga en un comando | `ProgramasPage.test.tsx`, `FichaAportePage.test.tsx` |
| T-36 | Después de crear o guardar | El cajón se cierra en silencio y el alta abre la ficha sin decir qué pasó | `NuevaQcsPage.tsx:215-218`, `NuevoCompromisoPage.tsx:390-393`, `FichaCompromisoPage.tsx:246` | Media | `AvisoDeExito` bajo la cabecera, una sola vez, con lo que se creó y lo que el modelo hizo con ello («Se creó la tarea de acusar recibo») | Hecho en las altas de QCS, compromiso, interacción, acuerdo, aporte y programa. «Volver a…» no: la ficha ya trae su rastro | `AvisoDeExito.test.tsx`, `ProgramasPage.test.tsx` |

### 3.4 Empezar el día y encontrar (ola 3)

| # | Pantalla o flujo | Problema observado | Evidencia | Gravedad | Cambio | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| T-37 | Inicio | «Monitoreo del plan…» y «Catálogo de indicadores» encabezan el inicio de toda cuenta que los lee, también la del agente de campo; un bloque se dibuja vacío; una cuenta sin asignación no sabe a quién pedirla | `pages/InicioPage.tsx:50-63`, `LoQueMeToca.tsx:149`, `Atajos.tsx:19-22`; capturas 02 y 41 | Media | Los accesos a los tableros, en «Atajos»; sin bloques vacíos; un bloque de orientación con una sola frase de «a quién pedir» | Hecho. Los dos accesos van al final, en «Consultar»; los atajos no se ofrecen sin un proyecto donde crear, y la visión ejecutiva queda arriba cuando es lo único que la cuenta lee | `Inicio.test.tsx`, `superficies.test.ts` |
| T-38 | «Lo que me toca hoy» | Las QCS se nombran por código; ninguna entrada dice su estado ni su siguiente acción; «Para tomar» no muestra el plazo del acuse ni ofrece «Tomar» | `LoQueMeToca.tsx:52-56,98-108` | Alta | Asunto, estado o siguiente acción y proyecto en cada entrada; plazo real y «Tomar» en la línea | Hecho. El estado sale solo de los objetos que la cuenta lee | `Inicio.test.tsx`, `LoQueMeToca.test.tsx`, `e2e/inicio.spec.ts` |
| T-39 | Mis tareas | Patrón viejo, sin acción por fila ni selección; Prioridad y Vence vacías en «Para tomar»; abrir una tarea cambia de contexto | `MisTareasPage.tsx:129-134,253-301`, `datos/fichas.ts:30-31`; captura 32 | Alta | `BarraDeFiltros` + `SelectorDeVista` + `TablaPriorizada`; «Tomar» en la fila y en lote; sin columnas vacías | En parte. «Tomar» en la fila y varias a la vez (`BarraDeSeleccion`), y una columna sin valor no se dibuja. Las vistas «Todas del proyecto» y «Aprobaciones» dentro de Tareas quedan pendientes | `MisTareasPage.test.tsx` |
| T-40 | Aprobaciones | Solo se llega desde el inicio y solo con más de tres; la tarjeta dice el código y «¿Puede decidir? Sí»; con una pendiente, el detalle queda vacío; tras decidir se queda en lo decidido | `EsperanSuDecision.tsx:75`, `AprobacionesPage.tsx:140-144,366-371`; captura 33 | Alta | En Tareas y en el inicio con `?selected=`; elegir sola la única; «Aprobó X · Siguiente: Y»; qué, para quién y en qué proyecto | En parte. La más antigua primero, el conteo en la pestaña, la única se elige sola si su registro se lee, y tras decidir lleva a la siguiente y dice cuántas quedan. La tarjeta sigue diciendo «¿Puede decidir?» | `aprobaciones.test.tsx` |
| T-41 | Avisos | Cinco avisos casi iguales seguidos, cada uno con su nota «Se va solo cuando…»; «Abrir» es el enlace menos visible | `AvisosPage.tsx:164-187`; captura 40 | Media | Agrupar los iguales; «Abrir» como acción principal; la nota, una vez | En parte. «Abrir» es la acción del aviso y la nota va una vez. Agrupar los iguales y deshacer «Marcar todos como leídos» quedan pendientes | `avisos.test.tsx` |
| T-42 | Volver de una ficha | El orden de la lista no va en la URL; el desplazamiento de `<main>` y el foco no se manejan al cambiar de ruta | `CompromisosPage.tsx:115-116` y otras ocho listas; `AppShell.tsx:147-149` | Alta | `?sort=&dir=`; guardar y restaurar el desplazamiento por `location.key`; foco al `h1`; «Saltar al contenido» | Hecho (`ordenEnUrl`, `useLugarDeLaPagina`) | `lugarDeLaPagina.test.tsx`, las pruebas de orden de cada lista |
| T-43 | Listas | Búsqueda solo en Compromisos, QCS y Alertas; Grupos, la tarea más frecuente, no la tiene | `CompromisosPage.tsx:253`, `AtencionPage.tsx:288`, `AlertasPage.tsx:152` | Alta | `BarraDeFiltros.busqueda` en todas | Hecho en Grupos y Riesgos (sin tildes ni mayúsculas), Interacciones, Programas, Aportes, Acuerdos e Incidentes (en el servidor), Proyectos, Señales, Menciones e Impactos. Quedan Tareas, Avisos y la bandeja de IA | `GruposPage.test.tsx`, `RiesgosPage.test.tsx`, `InteraccionesPage.test.tsx`, `ProgramasPage.test.tsx`, `acuerdos.test.tsx`, `incidentes.test.tsx`, `ProyectosPage.test.tsx`, `registrosDeAlerta.test.tsx` |
| T-44 | Listas con patrón viejo | Incidentes, Señales, Menciones, Impactos, Reglas, Entregables, Visitas y Proyectos: tablas sueltas, sin «Volver»; Grupos corta su lectura en silencio a 1000 | `riesgos/IncidentesPage.tsx:47-90`, `RegistrosSimples.tsx:97-126`, `GruposPage.tsx:59` | Media | El patrón de Compromisos; `useTodosConTope` o paginar en el servidor | En parte. Incidentes y Proyectos siguen el patrón (vistas, búsqueda, orden en la URL, tarjetas en el teléfono y «Volver», «Anterior» y «Siguiente»). Señales, Menciones e Impactos ganan la búsqueda en `RegistrosSimples`. Reglas, Entregables y Visitas, y el tope de Grupos, quedan pendientes | `incidentes.test.tsx`, `ProyectosPage.test.tsx`, `registrosDeAlerta.test.tsx` |
| T-45 | Selección | Solo Grupos selecciona, sin «seleccionar todo»; `TablaPriorizada` no admite selección | `GruposPage.tsx:145,282-295` | Media | Selección en `TablaPriorizada` y una `BarraDeSeleccion` | En parte. `BarraDeSeleccion` (cuántos, las acciones, elegir todos los de la página, quitar la selección y el resultado del lote) en Grupos y en «Para tomar». Cada lista sigue dibujando su casilla: `TablaPriorizada` no la trae | `GruposPage.test.tsx`, `MisTareasPage.test.tsx` |
| T-46 | Cambiar de proyecto | Se pierden los filtros y las subvistas; aprobaciones y la bandeja de IA caen en otro lugar | `SelectorDeProyecto.tsx:115`, `rutas.ts:18,25-28,55-68` | Media | Parámetros que se conservan y mapeo de las rutas que faltan | Hecho. En la misma pantalla del otro alcance se conservan la vista, el orden, la búsqueda y los filtros que no nombran un registro; la bandeja de IA va a la del otro proyecto | `contexto.test.tsx` |
| T-47 | Nombres y cifras | KPI-GRV-02 es «Quejas abiertas» y «QCS abiertas»; QCS tiene tres nombres a la vez y en inglés «GIR»; «Mis proyectos» dibuja «—» para lo que la cuenta nunca lee | `textos/tablerosF8.ts:46`, `p360.ts:34`, `es.ts:190-196`, `en.ts:188`, `MisProyectos.tsx:86-88` | Media | Un solo diccionario de rótulos por KPI; un nombre corto de QCS con `<abbr>`; omitir lo que no se lee | En parte. Un diccionario de cifras por código (`textos/tableros.ts`), en los dos idiomas, y «Mis proyectos» omite lo que la cuenta no lee y lleva los riesgos a su filtro. El nombre corto de QCS espera a H2 (DD-40). Los conteos de riesgos e IA en las pestañas piden B-06 | `RevisionEjecutivaPage.test.tsx`, `FichaContextual.test.tsx`, `Inicio.test.tsx` |
| T-48 | Vacíos y listas cortadas | «No hay compromisos en esta vista.» sin cómo empezar; «…hay más.» sin salida | `textos/compromisos.ts:42`, `textos/piezas.ts:19`, `textos/aprobaciones.ts:9` | Baja | `Vacio` con `BotonCrear`; un texto común con la causa y la salida | En parte. El vacío inicial de Compromisos, Incidentes y Entregables dice cómo empezar, y una lista cortada que busca en lo leído lo dice. Los demás «…hay más.» siguen sin salida | `CompromisosPage.test.tsx`, `incidentes.test.tsx`, `registrosDeAlerta.test.tsx` |
| T-49 | «Qué requiere atención» del proyecto | Grupos saturados: «Sin contacto en más de 90 días 85» y «Evaluaciones con más de 30 días 85» con 85 grupos en total. Si todo es urgente, nada lo es | Captura 07; `ResumenPage.tsx` (`Atencion`) | Media (hipótesis) | Un grupo que abarca casi todo el universo se resume en una línea con su acción, no en una lista de nombres | Sin cambio: espera a H6 | — |

### 3.5 Leer y decidir (ola 4)

| # | Pantalla o flujo | Problema observado | Evidencia | Gravedad | Cambio | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| T-50 | Tableros | Casi ninguna cifra lleva a la lista que la explica (`KpiCard.a`, en 5 tarjetas); del tablero a la lista se pierden el periodo, «solo los míos» y el territorio | `RevisionEjecutivaPage.tsx:199`, `TableroCompromisosPage.tsx:91`, `VistasDelModulo.tsx:33` | Alta | `a` en cada cifra, «Ver datos» con enlaces, `alElegir` en `Barras`, filtros que viajan y `FiltrosIgnorados` | En parte. En la revisión ejecutiva, lo crítico lleva a su lista con la vista o el filtro que cuenta lo mismo (vencidos, nivel alto, alertas activas), y las tiles que tienen una lista así la enlazan; con varios proyectos o un filtro que la lista no aplica, no se enlazan. Los filtros que viajan del tablero a la lista, «Ver datos» con enlaces y `alElegir` en `Barras` quedan pendientes | `RevisionEjecutivaPage.test.tsx`, `atencionEjecutiva.test.ts` |
| T-51 | Cifras | Sin meta, diferencia ni tendencia; en Monitoreo, valor y meta en columnas separadas | `KpiCard.tsx`, `MonitoreoPage.tsx:110-111` | Media | «Meta 80 % · −5 pts», y un chip con texto «Cumple / Bajo la meta» | En parte. El monitoreo dice con texto cuánto está cada cifra sobre o bajo su meta. No dice «Cumple»: el diseño no fija si cada meta de la Tabla 9.5 es un mínimo (H7). La tendencia en `KpiCard` queda pendiente | `MonitoreoPage.test.tsx` |
| T-52 | Territorio | El periodo y sus atajos ocupan la cabecera antes del mapa; las capas y el encuadre no van en la URL; los registros del lugar quedan bajo un mapa de 70 vh | `TerritorioPage.tsx:100-101,257,358-365`; captura 37 | Media | El periodo plegado en un chip; `?layers=`; los registros del lugar en el panel, con conteo por tipo y foco | En parte. «Lugares visibles» se busca por el nombre con más de cinco lugares. El periodo en un chip, `?layers=` y los registros en el panel quedan pendientes | `territorio.test.tsx` |
| T-53 | IA | Los filtros de la bandeja no van en la URL; aceptar no confirma; «Modelo» e «Instrucción» al mismo peso que la propuesta; el asistente aparece tarde | `BandejaDeIaPage.tsx:66-67`, `AceptarSugerencia.tsx:92`, `Propuesta.tsx:116-118`, `Asistente.tsx:93` | Media | Filtros en la URL con `?target=`; «Propuesta aceptada: ver en ‹registro›»; la procedencia, plegable | En parte. Los filtros van en la URL, `?target=` deja solo las propuestas de un registro y la ficha lleva ahí, y aceptar dice «Propuesta aceptada. Quedó en: ‹registro›». La procedencia plegable y el lugar del asistente quedan pendientes | `BandejaDeIaPage.test.tsx`, `AceptarSugerencia.test.tsx`, `AccionesDeIa.test.tsx` |
| T-54 | Exportar | Desde una lista se cae en Entregables sin los filtros; cuatro primarias; al terminar no se dice nada; una casilla para tres condiciones | `CompromisosPage.tsx:235`, `ReportesPage.tsx:69-94`, `exportacion.tsx:62-65,149-154` | Media | `?tab=exportaciones` con los filtros; una primaria; «Se exportaron N filas (nivel X)»; una casilla por condición | En parte. Al terminar, la página dice qué archivo se descargó y con qué nivel. Las filas no: la respuesta no las trae, y `row_count` de `export_log` cuenta cosas distintas según la exportación. Los filtros que viajan, la primaria única y una casilla por condición quedan pendientes | `ReportesPage.test.tsx` |
| T-55 | Entregable (S50) | «el estado se consulta cada 5 segundos» como texto; los avisos del borrador no llevan a su sección; no se sabe cuántas secciones están revisadas | `PanelDelBorrador.tsx:90-97`, `EditorDeSeccion.tsx:65` | Media | Cuánto lleva y aviso al terminar; enlaces a `?seccion=`; «N de M revisadas» | Hecho | `PanelDelBorrador.test.tsx`, `EntregablePage.test.tsx` |
| T-56 | Ayuda | No hay hoja de atajos; «⌘K» también en Windows; no hay «Saltar al contenido» ni glosario (QCS, AIDS, AIIS, «Para tomar», escalamiento) | `NavegacionDeOrigen.tsx:81-93`, `busqueda.ts:4` | Media | Hoja de atajos (Shift + ?), la tecla según la plataforma, el enlace de salto y `<abbr>` con un glosario breve | En parte. La hoja de atajos («?» o el menú de la cuenta), ⌘ K o Ctrl K según el teclado, «Saltar al contenido» (ola 3), y el código técnico de un indicador fuera de su detalle. El glosario no: AIDS y AIIS ya se explican donde aparecen, y el nombre corto de QCS espera a H2 | `HojaDeAtajos.test.tsx`, `BarraSuperior.test.tsx`, `MatrizYTablero.test.tsx` |
| T-57 | El inicio en el tiempo | No se relee al volver a la pestaña; una abierta desde ayer muestra el día de ayer | `PortalApp.tsx:104` (`refetchOnWindowFocus: false`), `aSuCargo.ts:18-19` | Baja | Releer al volver y «Actualizado hace N min»; filtrar por estado en el servidor | En parte. «Lo que me toca hoy» se relee al volver a la pestaña tras un minuto y dice «Actualizado hace N min», con «Actualizar». Filtrar por estado en el servidor queda pendiente | `LoQueMeToca.test.tsx` |

### 3.6 Fuera del portal

| # | Dónde | Problema | Propuesta |
|---|---|---|---|
| B-05 | `sgspe/src/main/kotlin/sgspe/notification/Notices.kt:26,66` | Los textos de los avisos llevan el código de la opción («Severidad ALTO»), la fecha `dd/MM/yyyy` («debía hacerse el 17/09/2026») y solo existen en español | El rótulo de la opción y la fecha es-PE del portal; la traducción queda para cuando wasichai-notifications admita textos por idioma |
| B-06 | `sgspe/src/main/kotlin/sgspe/dashboard/ProjectCounts.kt:49-52` | La lectura única de los conteos de las pestañas trae `risks:total`, pero no lo que pide acción en riesgos (altos o con la revisión vencida), ni las propuestas de IA por revisar, ni las tareas vencidas: «Más» no puede mostrar una insignia | Sumar `risks:accion`, `ai-review:total` y `tasks:accion` a `/api/sgspe/projects/{id}/counts`, con el alcance de la cuenta; el portal ya dibuja cualquier clave `<pestaña>:<clase>` que llegue |

## 4. Secuencias rehechas

Clics contados en el código, desde la ficha o la lista.

| Tarea | Hoy | Propuesto | Hallazgos |
|---|---|---|---|
| Resolver una queja | Editar (17 campos) → motivo → Guardar → Resolver → motivo → Confirmar: 4 clics, desplazarse, 2 motivos | «Resolver» → el diálogo pide Resolución, Respuesta y motivo → «Resolver»: 2 clics, 1 motivo | T-15, T-16, T-17 |
| Responder una consulta | 4 clics, 2 motivos | 2 clics, 1 motivo | T-16 |
| Cerrar un riesgo | 5 clics, 3 textos | 3 clics; el motivo de cierre en el diálogo | T-16 |
| Registrar cumplimiento | 12 a 13 clics, volviendo a la cabecera | Bloqueo con «Registrar entrega» → «Faltan» → «Registrar cumplimiento» en el mismo lugar: unos 8 | T-15, T-21 |
| Tomar 5 tareas | 5 × (abrir, Tomar, cerrar) = 15 | Seleccionar 5 → «Tomar»: 6 | T-38, T-39, T-45 |
| Acusar recibo desde Mis tareas | Tarea → origen → Acusar → motivo → Confirmar: 4 | La acción en la fila o el enlace directo al origen: 2 a 3 | T-39 |
| Decidir 3 aportes | Inicio → S31 → volver, por cada uno | Bandeja con el primero elegido y «Siguiente»: 1 + 3 × 2 | T-40 |
| Volver a la lista desde una ficha | «Volver» monta la lista con otro orden y arriba de todo | La misma página, el mismo orden y el mismo lugar | T-42 |

## 5. Plan por olas

Las olas van en este orden porque cada una se apoya en la anterior:
- **Ola 0:** lo que engaña.
- **Ola 1:** avanzar sin rodeos.
- **Ola 2:** no perder trabajo.
- **Ola 3:** empezar el día y encontrar.
- **Ola 4:** leer, decidir y la ayuda.

Cada ola va en commits propios, con la prueba primero. La siguiente empieza solo con la CI de la anterior en verde.

**Lo que no cambia:**
- Las rutas: solo se suman parámetros opcionales (`sort`, `dir`, `layers`, `target`).
- Los permisos: se deciden con `useAuth().can`, sin nombres de rol.
- Las escrituras: siguen pasando por `datos/`, con `If-Match`, `Idempotency-Key` y su motivo.
- La confidencialidad: `RegistroVinculado`, `NotaDeConfidenciales` y los 404 sin distinguir quedan igual.
- Las dependencias y los tokens `sg-*`.

## 6. Hipótesis que necesitan personas

- **H1, navegación por bloques** (segunda pasada): sigue sin validar. Aprobaciones no está en la navegación (T-40).
- **H2, «QCS».** La barra lateral ya dice «Quejas y solicitudes», que deja fuera las consultas. La sigla sigue en la pestaña,
  el inicio y la búsqueda, y en inglés es «GIR» (T-47). Hay que elegir un nombre corto con personas de cada perfil.
- **H3, lo que pasó a «Más acciones».** La medición existe (`sgspe/model/uso_de_acciones.py`). Falta correrla sobre un
  trimestre de producción.
- **H4, la interacción con 8 pestañas:** sin cambios; se agrega que no se puede editar (T-33).
- **H5, motivos sugeridos en las transiciones rutinarias** (T-17): ¿ahorran tiempo sin empobrecer la auditoría? Se mide con
  el largo y la variedad de los motivos antes y después.
- **H6, grupos saturados en «Qué requiere atención»** (T-49): ¿la jefatura prefiere la lista de nombres o una línea con su
  acción?
- **H7, metas de la Tabla 9.5** (T-51): ¿cada meta es un mínimo a alcanzar? Si lo es, el monitoreo puede decir «Cumple» o
  «Bajo la meta»; hoy solo dice la diferencia, sin juzgarla.

## 7. Cambios al diseño canónico

Van en un PR a `wasichai/sgspe` (`docs/ux/` y `docs/ux/redesign/07-decisiones-y-compatibilidad.md`, DD-30 en adelante):

- **Listas:** el orden va en la URL (cambia `screens.md:65`, «el orden dura la visita»).
- **Lo que la cuenta no lee:** se omite en vez de «—» (`ux-architecture.md` §7.6).
- **Diálogo de transición:** pide los campos que la transición exige, dice «Qué pasará» por transición y ofrece motivos
  sugeridos (`design-system.md` §6.2).
- **Respuesta del sistema:** la confirmación de éxito con lo que sigue, los plazos relativos, el aviso al cerrar un cajón con
  cambios y el glosario.
- **Vistas de Tareas y Aprobaciones** (S47 y S48).
- **B-05:** la propuesta de los textos de los avisos.

## 8. Pruebas ejecutadas

- **Formato:** Prettier 3.9.9 sobre cada archivo cambiado.
- **Lo que corre la CI del PR:** `yarn lint`, `typecheck`, `test`, `build` y `e2e`. En esta sesión no se pudieron correr en
  local (§1).
- **El primer push** (T-01, T-02 y T-04): la CI pasó entera.
- **Ola 0:** dos rojos, los dos de las pruebas: un botón que se volvía a montar al llegar su razón y un archivo sin formato.
  Corregidos; la ola terminó en verde.
- **Ola 1:** cuatro rojos, todos de pruebas escritas sin poder correrlas:
  - un parámetro con valor por defecto que `undefined` no anula;
  - una prueba que suponía «Aprobar sin revisión interna» en el camino del aporte, lo que destapó T-24b;
  - una prueba de la consulta que esperaba «Reclasificar…» sin transición de reclasificación;
  - un `waitFor` sin uso, que `typecheck` rechaza.

  Cada uno se corrigió en su propio commit.
- **Ola 2:** dos rojos.
  - En Web, una prueba que escribía la fecha después de un «Siguiente» que la hora propuesta (T-30) ya deja pasar. Se
    corrigió en su propio commit.
  - En «Conventional commits», una línea de 101 caracteres en el cuerpo de un commit de la ola 2 (commitlint admite
    100). Con la autorización del usuario se reescribió solo ese mensaje y se forzó el push de la rama: el árbol quedó
    idéntico, y los commits desde ese cambiaron de hash.
- **Ola 3:** tres rojos en Web.
  - 17 pruebas que esperaban el canon anterior: el orden fuera de la URL (DD-37), una caja a mano donde va `Seccion`, las
    lecturas del flujo de objetos que la cuenta no lee y una columna Origen que ya no se dibuja vacía. Se corrigieron en
    bf71717 y 27e7f1e.
  - En e2e, «Lo que me toca hoy» esperaba «Tarea · Vencido», y la línea ya dice también el proyecto (T-38).
  - Una prueba de aprobaciones que fallaba según el orden de las respuestas destapó un defecto propio: la bandeja elegía sola
    la única aprobación aunque su registro respondiera 404, y el detalle volvía a pedirlo. Ahora se elige cuando el registro
    se leyó (1e9d3da).
- **Ola 4:** tres rojos en Web.
  - En e2e, dos expectativas viejas: lo crítico de la revisión ejecutiva lleva ahora a `?view=vencidos` (T-50), y la espera
    del borrador ya no dice que el estado se consulta cada 5 segundos (T-55). Se corrigieron en 89ae6a8.
  - En `typecheck`, una clave de texto repetida en la bandeja de IA («aceptada»), que además tapaba a la nueva en
    ejecución. Pasó a «aceptadaEn» (8cb25ee).
  - En Web, la prueba de `?target=` en la bandeja de IA suponía una sola propuesta sobre la queja g1; el fixture tiene dos
    (la clasificación y el posible duplicado) y la prueba contaba los `<li>` anidados de las tarjetas. Ahora las cuenta
    por su tipo; el filtro estaba bien.
