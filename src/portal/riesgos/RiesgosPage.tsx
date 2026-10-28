import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { PaginasDeRiesgos } from './PaginasDeRiesgos'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { useAuth } from '@wasichai/core'
import { Alert, Button, cn } from '@wasichai/ui'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { useSiguientePaso } from '../contexto/Rastro'
import { CLASE_DE_TONO } from '../componentes/apariencias'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { ordenarEnCliente, posicionEn, type ValorDeOrden } from '../componentes/ordenEnCliente'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { rutaDeFicha } from '../datos/fichas'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto, useProyectos } from '../contexto/proyectos'
import { atributo, texto, useTodosSinTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { NIVELES, nivelDePuntaje, TONO_DE_NIVEL, umbralesDe } from './niveles'
import { opcion } from '../datos/opciones'
import { FechaDePlazo } from '../componentes/CuandoVence'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Persona } from '../componentes/Persona'
import { Seccion } from '../componentes/Seccion'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'

// S38 y S39 · registro y matriz de riesgos (screens.md §9): qué riesgos hay, de qué nivel y cuáles piden revisión. la misma página
// con alcance global (columna Proyecto) o de un proyecto (ASM-076). la API genérica no filtra por estado ni por situación, así que,
// como la lista de compromisos, se leen los riesgos del alcance con tope (avisa si recorta) y las vistas y la celda elegida se arman
// aquí. el mapa de calor 5 × 5 cuenta los riesgos por sus valores vigentes (probabilidad e impacto, derivados de la última revisión
// no residual); uno sin revisión no entra al mapa y se cuenta aparte. elegir una celda filtra la tabla. «Identificar riesgo» crea
// el riesgo en identified con motivo (social_risk es requiresReason); ?nuevo=1 lo abre, y ?origin_incident= lo crea desde un
// incidente
const VISTAS = ['registro', 'revision', 'mios', 'cerrados'] as const
const ESCALA = [1, 2, 3, 4, 5] as const
const CAMPOS_DEL_ALTA = [
  'code',
  'title',
  'risk_source',
  'category',
  'impact_type',
  'impact_nature',
  'owner_user_id',
  'owner_user_email',
  'review_every_days',
  'locality',
  'community'
]

const cerrado = (r: Registro) => r.state === 'closed'

const NIVELES_ALTOS = ['ALTO', 'CRITICO']

// el orden por columna (05-especificacion §1.6) es del portal, que ya tiene todos los riesgos del alcance: el riesgo por su código
// (el orden que la lista ya pedía), P × I por su puntaje y el nivel por su orden de negocio (bajo, medio, alto, crítico), nunca por
// su texto. un riesgo sin puntaje o sin nivel va al final en los dos sentidos
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'riesgo', dir: 'asc' }
export function valorDeOrden(r: Registro, columna: string): ValorDeOrden {
  switch (columna) {
    case 'puntaje':
      return celdaDe(r) && texto(r, 'score') ? Number(texto(r, 'score')) : null
    case 'nivel':
      return posicionEn(NIVELES, atributo(r, 'risk_level'))
    default:
      return texto(r, 'code')
  }
}

export function enVista(vista: string, r: Registro, usuario: string | undefined): boolean {
  switch (vista) {
    case 'revision':
      return !cerrado(r) && ['POR REVISAR', 'REVISION VENCIDA'].includes(texto(r, 'review_status'))
    case 'mios':
      return !cerrado(r) && atributo(r, 'owner_user_id') === usuario
    case 'cerrados':
      return cerrado(r)
    default:
      return !cerrado(r)
  }
}

// la celda P-I de un riesgo con valores vigentes; sin ellos, null (sin evaluar)
export function celdaDe(r: Registro): string | null {
  const p = Number(atributo(r, 'probability'))
  const i = Number(atributo(r, 'impact'))
  return Number.isInteger(p) && Number.isInteger(i) && p >= 1 && p <= 5 && i >= 1 && i <= 5 ? `${p}-${i}` : null
}

export function RiesgosPage() {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useParametrosDeLista('registro')
  const telefono = useEsTelefono()
  // Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
  const navegar = useNavigate()
  const previa = useRutaDeVistaPrevia()
  const paso = useSiguientePaso()
  const [busqueda, fijar] = useSearchParams()
  // todos los riesgos del alcance, sin tope: la matriz de calor cuenta cada celda con el conjunto entero (D10 de la revisión de UX)
  const riesgos = useTodosSinTope('social_risk', { project: proyecto, sort: 'code', dir: 'asc' })
  const registroDelProyecto = useProyecto(proyecto)
  const proyectos = useProyectos()
  const umbrales = umbralesDe(registroDelProyecto.data)
  const celda = lista.filtro('cell')
  // ?level=alto: los de nivel alto o crítico, como «Riesgos altos» (KPI-RSK-01) del resumen y del tablero (revisión de UX, etapa 6)
  const soloAltos = lista.filtro('level') === 'alto'
  const enLaVista = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id) && (!soloAltos || NIVELES_ALTOS.includes(texto(r, 'risk_level'))))
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva
  const [orden, setOrden] = ordenEnUrl(lista, ORDEN_INICIAL, ['riesgo', 'puntaje', 'nivel'])
  const filtrados = ordenarEnCliente(celda ? enLaVista.filter((r) => celdaDe(r) === celda) : enLaVista, orden, valorDeOrden)
  const enLaVistaSinFiltros = (riesgos.data ?? []).filter((r) => enVista(lista.vista, r, user?.id)).length
  const sinEvaluar = enLaVista.filter((r) => celdaDe(r) === null).length
  const crea = proyecto !== undefined && escribe && can('social_risk', 'CREATE')
  const nuevo = busqueda.get('nuevo') === '1'
  const incidente = busqueda.get('origin_incident')
  const abrirAlta = (abrir: boolean) => {
    const siguiente = new URLSearchParams(busqueda)
    if (abrir) siguiente.set('nuevo', '1')
    else {
      siguiente.delete('nuevo')
      siguiente.delete('origin_incident')
    }
    fijar(siguiente, { replace: true })
  }
  const nombreDelProyecto = (id: string) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
  const [p, i] = celda.split('-')
  const chips = [
    ...(soloAltos ? [{ clave: 'level', etiqueta: t('riesgos.filtroAltos') }] : []),
    ...(celda ? [{ clave: 'cell', etiqueta: t('riesgos.filtroCelda', { p, i }) }] : [])
  ]
  // la tabla con prioridad de columnas (hallazgo U-06, DD-05): esenciales el riesgo, el proyecto, el nivel, el estado y la
  // revisión; secundarias, desde xl, la categoría, P × I y el responsable. una columna no esencial que dice lo mismo en todas las
  // filas sale a una nota encima, y en «Mis riesgos» el responsable es quien mira: no se dibuja
  const columnas: ColumnaPriorizada[] = [
    { id: 'riesgo', encabezado: t('riesgos.columnas.riesgo'), prioridad: 'esencial', claseDeCelda: 'min-w-64 text-sm', ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('riesgos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'categoria', encabezado: t('riesgos.columnas.categoria'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'puntaje', encabezado: t('riesgos.columnas.puntaje'), prioridad: 'secundaria', claseDeCelda: 'text-sm tabular-nums', ordenable: true },
    { id: 'nivel', encabezado: t('riesgos.columnas.nivel'), prioridad: 'esencial', ordenable: true },
    { id: 'estado', encabezado: t('riesgos.columnas.estado'), prioridad: 'esencial' },
    { id: 'revision', encabezado: t('riesgos.columnas.revision'), prioridad: 'esencial', claseDeCelda: 'space-x-1 text-sm' },
    ...(lista.vista === 'mios'
      ? []
      : [{ id: 'responsable', encabezado: t('riesgos.columnas.responsable'), prioridad: 'secundaria' as const, claseDeCelda: 'text-sm' }])
  ]
  const celdaDeTabla = (r: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'riesgo':
        return (
          <EnlaceDeRegistro
            codigo={texto(r, 'code')}
            titulo={texto(r, 'title')}
            ruta={rutaDeFicha('social_risk', r)}
            desde={t('riesgos.titulo')}
            previa={{ objeto: 'social_risk', id: r.id }}
          />
        )
      case 'proyecto':
        return nombreDelProyecto(texto(r, 'project'))
      case 'categoria':
        return opcion(r, 'category') || '—'
      case 'puntaje':
        return celdaDe(r) && texto(r, 'score') ? `${texto(r, 'probability')} × ${texto(r, 'impact')} = ${texto(r, 'score')}` : '—'
      case 'nivel':
        return <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
      case 'estado':
        return <EstadoChip objeto="social_risk" estado={r.state} />
      case 'revision':
        return (
          <>
            <SituacionDePlazo valor={atributo(r, 'review_status')} revision />
            {texto(r, 'next_review_date') ? <FechaDePlazo dia={texto(r, 'next_review_date')} situacion={atributo(r, 'review_status')} /> : null}
          </>
        )
      default:
        return <Persona correo={texto(r, 'owner_user_email')} />
    }
  }
  const valorPlano = (r: Registro, columna: string): string => {
    switch (columna) {
      case 'categoria':
        return String(atributo(r, 'category') ?? '')
      case 'puntaje':
        return `${texto(r, 'probability')}×${texto(r, 'impact')}=${texto(r, 'score')}`
      case 'responsable':
        return texto(r, 'owner_user_email').toLowerCase()
      default:
        return r.id
    }
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      {/* la sección aterriza en el registro y la matriz (decisión 7 de la revisión de UX): el tablero es una vista más, y las
          demás páginas de riesgos van en su selector, en la cabecera (DD-03, U-20) */}
      <EncabezadoDePagina
        titulo={t('riesgos.titulo')}
        conteo={riesgos.data ? t('riesgos.conteo', { count: filtrados.length }) : undefined}
        primaria={
          proyecto ? (
            crea ? (
              <Button size="sm" onClick={() => abrirAlta(true)}>
                {t('riesgos.identificar')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="social_risk" etiqueta={t('riesgos.identificar')} resto="risks?nuevo=1" />
          )
        }
        vistas={
          <>
            <PaginasDeRiesgos actual="registro" />
            <VistasDelModulo modulo="risks" actual="lista" />
          </>
        }
      />
      {/* la barra de filtros (P-02; hallazgos U-18 y U-22): las vistas en una sola fila con su conteo, y el nivel y la celda del
          mapa como chips con «Limpiar». ?view=, ?level= y ?cell= siguen siendo los mismos */}
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((v) => ({
              id: v,
              etiqueta: t(`riesgos.vistas.${v}`),
              n: riesgos.data ? riesgos.data.filter((r) => enVista(v, r, user?.id)).length : null
            }))}
            actual={lista.vista}
            alElegir={(vista) => lista.cambiar({ view: vista, cell: null })}
          />
        }
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={() => lista.cambiar({ level: null, cell: null })}
      />
      {riesgos.isPending ? (
        <Cargando />
      ) : riesgos.isError && !riesgos.data ? (
        <FalloDeLectura error={riesgos.error} alReintentar={() => void riesgos.refetch()} />
      ) : (riesgos.data ?? []).length === 0 ? (
        // sin ningún riesgo, ni la matriz llena de ceros ni «esta vista»: el registro está vacío y se dice cómo empezarlo (rediseño de
        // UX, 2026-10-20)
        <Vacio titulo={t('riesgos.sinRiesgos')}>{can('social_risk', 'CREATE') ? t('riesgos.sinRiesgosAyuda') : null}</Vacio>
      ) : (
        <div className="grid gap-4 min-[105rem]:grid-cols-[360px_minmax(0,1fr)]">
          <Seccion titulo={t('riesgos.mapa.titulo')} className="w-full max-w-md min-[105rem]:max-w-none">
            <MapaDeCalor riesgos={enLaVista} umbrales={umbrales} elegida={celda} alElegir={(c) => lista.cambiar({ cell: c })} />
            <p className="text-sm text-sg-text-secondary">{t('riesgos.mapa.sinEvaluar', { n: numeroPe(sinEvaluar) })}</p>
            {celda ? (
              <button type="button" className="text-sm text-sg-primary-text underline" onClick={() => lista.cambiar({ cell: null })}>
                {t('riesgos.mapa.quitar')}
              </button>
            ) : null}
          </Seccion>
          {filtrados.length === 0 ? (
            // con la celda o el nivel puestos, el vacío los quita (rediseño de UX, 2026-10-20); sin ellos, la vista está vacía
            celda || soloAltos ? (
              <VacioDeLista conFiltros alLimpiar={() => lista.cambiar({ cell: null, level: null })} sinFiltros={enLaVistaSinFiltros || undefined} />
            ) : (
              <Vacio titulo={t('riesgos.vacio')} />
            )
          ) : telefono ? (
            <ListaEnTarjetas
              etiqueta={t('riesgos.tabla')}
              total={filtrados.length}
              tarjetas={filtrados.map((r) => ({
                id: r.id,
                titulo: (
                  <EnlaceDeRegistro
                    codigo={texto(r, 'code')}
                    titulo={texto(r, 'title')}
                    ruta={rutaDeFicha('social_risk', r)}
                    desde={t('riesgos.titulo')}
                    previa={{ objeto: 'social_risk', id: r.id }}
                  />
                ),
                estado: (
                  <>
                    <NivelDeRiesgo valor={atributo(r, 'risk_level')} />
                    <EstadoChip objeto="social_risk" estado={r.state} />
                  </>
                ),
                plazo: (
                  <>
                    <SituacionDePlazo valor={atributo(r, 'review_status')} revision />
                    {texto(r, 'next_review_date') ? <FechaDePlazo dia={texto(r, 'next_review_date')} situacion={atributo(r, 'review_status')} /> : null}
                  </>
                ),
                proyecto: proyecto ? undefined : nombreDelProyecto(texto(r, 'project'))
              }))}
            />
          ) : (
            <TablaPriorizada<Registro>
              etiqueta={t('riesgos.tabla')}
              total={filtrados.length}
              columnas={columnas}
              filas={filtrados}
              clave={(r) => r.id}
              celda={celdaDeTabla}
              valorPlano={valorPlano}
              ocultarUniformes
              orden={orden}
              alOrdenar={setOrden}
              alAbrir={(r) => {
                const ruta = rutaDeFicha('social_risk', r)
                if (ruta) navegar(ruta, { state: paso(t('riesgos.titulo'), ruta) })
              }}
              alPrevisualizar={(r) => navegar(previa('social_risk', r.id))}
            />
          )}
        </div>
      )}
      {crea ? <AltaDeRiesgo proyecto={proyecto} incidente={incidente} abierto={nuevo} alCerrar={() => abrirAlta(false)} /> : null}
    </section>
  )
}

// el mapa de calor (S39): filas de probabilidad (5 arriba) y columnas de impacto; cada celda dice cuántos riesgos tiene y su nivel
// con texto, y es un botón que filtra la tabla
function MapaDeCalor({
  riesgos,
  umbrales,
  elegida,
  alElegir
}: {
  riesgos: Registro[]
  umbrales: ReturnType<typeof umbralesDe>
  elegida: string
  alElegir: (celda: string) => void
}) {
  const { t } = useTranslation(NS)
  const conteo = new Map<string, number>()
  for (const r of riesgos) {
    const c = celdaDe(r)
    if (c) conteo.set(c, (conteo.get(c) ?? 0) + 1)
  }
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 text-center text-sg-caption">
      <caption className="sr-only">{t('riesgos.mapa.leyenda')}</caption>
      <thead>
        <tr>
          <th scope="col" className="font-normal text-sg-text-muted">
            {t('riesgos.mapa.pi')}
          </th>
          {ESCALA.map((i) => (
            <th key={i} scope="col" className="font-normal text-sg-text-muted">
              {t('riesgos.mapa.impacto', { n: i })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...ESCALA].reverse().map((p) => (
          <tr key={p}>
            <th scope="row" className="font-normal text-sg-text-muted">
              {t('riesgos.mapa.probabilidad', { n: p })}
            </th>
            {ESCALA.map((i) => {
              const clave = `${p}-${i}`
              const n = conteo.get(clave) ?? 0
              const nivel = nivelDePuntaje(p * i, umbrales)
              return (
                <td key={i}>
                  <button
                    type="button"
                    aria-pressed={elegida === clave}
                    aria-label={t('riesgos.mapa.celda', { p, i, count: n, nivel: t(`tableroRiesgos.niveles.${nivel}`) })}
                    onClick={() => alElegir(clave)}
                    className={cn(
                      'h-12 w-full rounded-sg-sm',
                      CLASE_DE_TONO[TONO_DE_NIVEL[nivel]],
                      elegida === clave && 'outline-2 outline-offset-1 outline-sg-focus'
                    )}
                  >
                    <span className="block text-sm font-semibold tabular-nums">{numeroPe(n)}</span>
                    <span className="block text-sg-caption">{t(`tableroRiesgos.niveles.${nivel}`)}</span>
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// el alta de un riesgo con su motivo: el formulario de la metadata con el proyecto (y el incidente de origen) fijos
function AltaDeRiesgo({ proyecto, incidente, abierto, alCerrar }: { proyecto: string; incidente: string | null; abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const motivo = useMotivo()
  const fijos = useMemo(() => (incidente ? { project: proyecto, origin_incident: incidente } : { project: proyecto }), [proyecto, incidente])
  const cerrar = () => {
    motivo.limpiar()
    alCerrar()
  }
  return (
    <Drawer titulo={t('riesgos.identificar')} descripcion={t('riesgos.alta.descripcion')} abierto={abierto} alCerrar={cerrar}>
      {incidente ? <Alert tone="notice">{t('riesgos.alta.desdeIncidente')}</Alert> : null}
      <CampoDeMotivo motivo={motivo} etiqueta={t('comun.motivoObligatorio')} ayuda={t('riesgos.alta.motivoAyuda')} />
      <p className="text-sg-caption text-sg-text-muted">{t('riesgos.alta.cadencia')}</p>
      {abierto ? (
        <FormularioDeRegistro
          objeto="social_risk"
          fijos={fijos}
          campos={CAMPOS_DEL_ALTA}
          motivo={motivo.recortado}
          antesDeEnviar={motivo.exigir}
          alGuardar={cerrar}
          alCancelar={cerrar}
        />
      ) : null}
    </Drawer>
  )
}
