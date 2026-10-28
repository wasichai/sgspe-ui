import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import type { UseQueryResult } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { useSiguientePaso } from '../contexto/Rastro'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, NoDisponible, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { PaginacionDelServidor, useParametrosDeLista } from '../componentes/Lista'
import { montoPe } from '../componentes/Monto'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { rutaDeFicha } from '../datos/fichas'
import { desglose, useTablero, type Indicador } from '../datos/indicadores'
import { anioEnLima, APORTE_TERMINADO, MONEDA_POR_DEFECTO } from '../datos/inversion'
import { atributo, conEstado, estados, texto, useConteos, useRegistros, type Pagina, type Parametros, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ConsultaDeTablero, indicadorDe, useTableroDisponible } from '../tableros/comunes'
import { BeneficiariosPorFuente, CampanasFrenteAlTope, cifraDe, presupuestoDelPrograma, PresupuestoPorMoneda } from './cifras'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { Seccion } from '../componentes/Seccion'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'

// S42 · programas e inversión (screens.md §10): ¿cuánto del tope de la campaña queda, cómo avanzan los programas y qué aportes están
// en curso? la misma página con alcance global (columna Proyecto, sin altas) o de un proyecto (ASM-076). las cifras salen del
// tablero investment en una llamada (KPI-INV-01, 02 y 04); las listas, de la API genérica con tope (useTodosConTope avisa del
// recorte), porque no filtra por estado. el alta de un aporte lleva motivo (requiresReason) y no lleva ítems: se cargan en S44
const CAMPOS_DEL_APORTE = [
  'code',
  'contribution_type',
  'topic',
  'occasion',
  'declared_purpose',
  'conditions',
  'currency',
  'payer_organization',
  'recipient_organization',
  'stakeholder',
  'locality',
  'festivity',
  'exploration_campaign',
  'beneficiaries_count',
  'has_institutional_synergy',
  'agreement',
  'commitment'
]
const CAMPOS_DEL_PROGRAMA = ['code', 'name', 'description', 'topic', 'partner_organization', 'agreement', 'start_date', 'end_date', 'currency']
// las vistas de la página (hallazgo U-35, DD-03): Programas y las tres de los aportes en un solo selector, en lugar de dos listados
// completos apilados. ?view= de los aportes sigue igual (enCurso, terminados, todos); programas es la vista nueva y la primera
const VISTAS = ['enCurso', 'terminados', 'todos'] as const
const PROGRAMAS = 'programas'
const POR_PAGINA = 25
// las columnas que el servidor ordena (05-especificacion §1.6). en los programas, el código y el nombre; el estado no (su código
// no dice su orden), ni el presupuesto ni lo ejecutado, que salen del tablero y no son campos de la lista. en los aportes, el
// código; el monto no, porque la lista mezcla monedas (ASM-063)
const ORDEN_DE_PROGRAMAS: Record<string, string> = { codigo: 'code', programa: 'name' }
const ORDEN_INICIAL_DE_PROGRAMAS: OrdenDeTabla = { columna: 'codigo', dir: 'asc' }
const ORDEN_DE_APORTES: Record<string, string> = { codigo: 'code' }
const ORDEN_INICIAL_DE_APORTES: OrdenDeTabla = { columna: 'codigo', dir: 'desc' }

export function ProgramasPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const conTablero = useTableroDisponible('investment')
  const tablero = useTablero('investment', proyecto ? { project: [proyecto] } : {})
  // ?nuevo=social_contribution o social_program abre el alta: así llega BotonCrear desde lo global, ya con el proyecto elegido
  const [busqueda] = useSearchParams()
  const pedida = busqueda.get('nuevo')
  const [alta, setAlta] = useState<'social_contribution' | 'social_program' | null>(
    pedida === 'social_contribution' || pedida === 'social_program' ? pedida : null
  )
  const creaAporte = proyecto !== undefined && escribe && can('social_contribution', 'CREATE')
  const creaPrograma = proyecto !== undefined && escribe && can('social_program', 'CREATE')
  const indicadores = tablero.data?.indicators
  // las vistas que la cuenta lee; sin ?view= (o con una que no lee), la primera
  const leeProgramas = can('social_program', 'READ')
  const leeAportes = can('social_contribution', 'READ')
  const vistas: string[] = [...(leeProgramas ? [PROGRAMAS] : []), ...(leeAportes ? VISTAS : [])]
  const lista = useParametrosDeLista(vistas[0] ?? PROGRAMAS)
  const vista = vistas.includes(lista.vista) ? lista.vista : vistas[0]
  const enProgramas = vista === PROGRAMAS
  const estado = enProgramas ? '' : lista.filtro('state')
  // los programas y los aportes se paginan en el servidor (D10 de la revisión de UX); la página de los programas va en ?pp=
  const paginaDeProgramas = Number(lista.filtro('pp')) || 0
  // el orden es de esta visita, como en Alertas: no viaja en la URL, y otro orden vuelve a la primera página
  const [ordenDeProgramas, setOrdenDeProgramas] = useState(ORDEN_INICIAL_DE_PROGRAMAS)
  const ordenarProgramas = (siguiente: OrdenDeTabla) => {
    setOrdenDeProgramas(siguiente)
    lista.cambiar({ pp: null })
  }
  const programas = useRegistros(
    'social_program',
    {
      project: proyecto,
      sort: ORDEN_DE_PROGRAMAS[ordenDeProgramas.columna],
      dir: ordenDeProgramas.dir,
      page: paginaDeProgramas,
      size: POR_PAGINA
    },
    leeProgramas
  )
  const conteos = useConteos(
    'social_contribution',
    Object.fromEntries(VISTAS.map((v) => [v, consultaDeAportes(v, proyecto, lista.filtro('state'))])),
    leeAportes
  )
  const etiquetas = useEtiquetasDeEstado('social_contribution')
  const conteoDe = (v: string) => (v === PROGRAMAS ? (programas.data?.totalElements ?? null) : (conteos[v] ?? null))
  const chips = estado ? [{ clave: 'state', etiqueta: `${t('inversion.aportes.estado')}: ${etiquetas[estado] ?? rotuloDeOpcion(estado)}` }] : []
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="programs" actual="lista" conTablero={conTablero} />}
        titulo={t('inversion.titulo')}
        primaria={
          proyecto ? (
            creaAporte ? (
              <Button size="sm" onClick={() => setAlta('social_contribution')}>
                {t('inversion.nuevoAporte')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="social_contribution" etiqueta={t('inversion.nuevoAporte')} resto="programs?nuevo=social_contribution" />
          )
        }
        secundarias={
          <>
            {proyecto ? (
              creaPrograma ? (
                <Button size="sm" variant="secondary" onClick={() => setAlta('social_program')}>
                  {t('inversion.nuevoPrograma')}
                </Button>
              ) : null
            ) : (
              <BotonCrear objeto="social_program" etiqueta={t('inversion.nuevoPrograma')} resto="programs?nuevo=social_program" />
            )}
          </>
        }
      />
      {/* la barra de filtros (P-02): la vista en una sola fila con su conteo y, en los aportes, el estado como chip con «Limpiar» */}
      {vistas.length > 0 ? (
        <BarraDeFiltros
          vista={
            <SelectorDeVista
              etiqueta={t('comun.vistas')}
              vistas={vistas.map((v) => ({
                id: v,
                etiqueta: v === PROGRAMAS ? t('inversion.programas.vista') : t(`inversion.aportes.vistas.${v}`),
                n: conteoDe(v)
              }))}
              actual={vista}
              alElegir={(v) => lista.cambiar({ view: v, pp: null })}
            />
          }
          frecuentes={
            enProgramas ? undefined : (
              <FiltroDeLista
                etiqueta={t('inversion.aportes.estado')}
                value={estado}
                onChange={(e) => lista.cambiar({ state: e.target.value })}
                opciones={Object.entries(etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
              />
            )
          }
          aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
          alLimpiar={() => lista.cambiar({ state: null })}
        />
      ) : null}
      {conTablero ? (
        <ConsultaDeTablero consulta={tablero}>{(datos) => <Cifras indicadores={datos.indicators} deProgramas={enProgramas} />}</ConsultaDeTablero>
      ) : null}
      {enProgramas ? (
        <Programas proyecto={proyecto} indicadores={indicadores} programas={programas} orden={ordenDeProgramas} alOrdenar={ordenarProgramas} />
      ) : vista ? (
        <Aportes proyecto={proyecto} vista={vista} estado={estado} />
      ) : null}
      {alta && proyecto ? <Alta objeto={alta} proyecto={proyecto} alCerrar={() => setAlta(null)} /> : null}
    </section>
  )
}

// las cifras de la vista (S42; hallazgo U-35): los programas llevan el presupuesto del año y los beneficiarios; los aportes, el
// tope de las campañas. una zona por KPI, «No disponible» si la cuenta no lo lee (RQ-DSH-032), nunca cero; una zona sin datos no
// se dibuja, ni la campaña sin avance su barra vacía
function Cifras({ indicadores, deProgramas }: { indicadores: Indicador[]; deProgramas: boolean }) {
  const { t } = useTranslation(NS)
  const anio = anioEnLima()
  const zona = (titulo: string, code: string, conDatos: (i: Indicador) => boolean, contenido: (i: Indicador) => ReactNode) => {
    const indicador = indicadorDe(indicadores, code)
    if (indicador?.available && !conDatos(indicador)) return null
    return (
      <Seccion key={code} titulo={titulo}>
        {indicador?.available ? contenido(indicador) : <NoDisponible motivo={indicador?.unavailableReason} />}
      </Seccion>
    )
  }
  const zonas = (
    deProgramas
      ? [
          zona(
            t('inversion.cifras.presupuesto', { anio }),
            'KPI-INV-02',
            (i) => desglose(i, 'program').some((f) => cifraDe(f.year) === anio),
            (i) => <PresupuestoPorMoneda indicador={i} anio={anio} />
          ),
          zona(
            t('inversion.cifras.beneficiarios'),
            'KPI-INV-04',
            (i) => desglose(i, 'source').some((f) => cifraDe(f.value) !== null || cifraDe(f.target) !== null),
            (i) => <BeneficiariosPorFuente indicador={i} />
          )
        ]
      : [
          zona(
            t('inversion.cifras.campanas'),
            'KPI-INV-01',
            (i) => desglose(i, 'campaign').length > 0,
            (i) => <CampanasFrenteAlTope indicador={i} sinVacios />
          )
        ]
  ).filter(Boolean)
  if (zonas.length === 0) return null
  return <div className={deProgramas ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>{zonas}</div>
}

// Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
function useAccionesDeFila(objeto: 'social_program' | 'social_contribution', desde: string) {
  const navegar = useNavigate()
  const previa = useRutaDeVistaPrevia()
  const paso = useSiguientePaso()
  return {
    abrir: (r: Registro) => {
      const ruta = rutaDeFicha(objeto, r)
      if (ruta) navegar(ruta, { state: paso(desde, ruta) })
    },
    previsualizar: (r: Registro) => navegar(previa(objeto, r.id))
  }
}

function useNombreDelProyecto(): (id: string) => React.ReactNode {
  const proyectos = useProyectos()
  return (id) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
}

function Programas({
  proyecto,
  indicadores,
  programas,
  orden,
  alOrdenar
}: {
  proyecto?: string
  indicadores?: Indicador[]
  programas: UseQueryResult<Pagina>
  orden: OrdenDeTabla
  alOrdenar: (orden: OrdenDeTabla) => void
}) {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista(PROGRAMAS)
  const filas = programas.data?.content ?? []
  const fila = useAccionesDeFila('social_program', t('inversion.titulo'))
  const nombreDelProyecto = useNombreDelProyecto()
  const telefono = useEsTelefono()
  const anio = anioEnLima()
  const presupuesto = indicadorDe(indicadores, 'KPI-INV-02')
  const textosDeMonto = { ilegible: t('inversion.cifras.ilegible'), porAprobar: t('inversion.cifras.porAprobar') }
  const beneficiarios = indicadorDe(indicadores, 'KPI-INV-04')
  const alcanzados = (programa: string) => {
    const fila = beneficiarios?.available ? desglose(beneficiarios, 'program').find((f) => f.key === programa) : undefined
    const meta = cifraDe(fila?.target)
    const alcanzado = cifraDe(fila?.reached)
    return fila && meta !== null && alcanzado !== null ? t('inversion.programas.alcanzados', { alcanzados: numeroPe(alcanzado), meta: numeroPe(meta) }) : '—'
  }
  // en la tabla, el código va en su columna (se ordena aparte del nombre); en la tarjeta del teléfono, junto al nombre
  const enlace = (p: Registro, codigoAparte = false) => (
    <EnlaceDeRegistro
      codigo={texto(p, 'code')}
      codigoAparte={codigoAparte}
      titulo={texto(p, 'name')}
      ruta={rutaDeFicha('social_program', p)}
      previa={{ objeto: 'social_program', id: p.id }}
      desde={t('inversion.titulo')}
    />
  )
  // la tabla con prioridad de columnas (DD-05): esenciales el código, el programa, el proyecto, el estado y el presupuesto del
  // año; secundarias el socio, lo ejecutado y los beneficiarios
  const columnas: ColumnaPriorizada[] = [
    {
      id: 'codigo',
      encabezado: t('inversion.programas.columnas.codigo'),
      prioridad: 'esencial',
      claseDeCelda: 'font-sg-mono text-sg-caption whitespace-nowrap',
      ordenable: true
    },
    { id: 'programa', encabezado: t('inversion.programas.columnas.programa'), prioridad: 'esencial', claseDeCelda: 'min-w-48 text-sm', ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('inversion.programas.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'socio', encabezado: t('inversion.programas.columnas.socio'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('inversion.programas.columnas.estado'), prioridad: 'esencial' },
    { id: 'presupuesto', encabezado: t('inversion.programas.columnas.presupuesto', { anio }), prioridad: 'esencial', claseDeCelda: 'text-sm tabular-nums' },
    { id: 'ejecutado', encabezado: t('inversion.programas.columnas.ejecutado', { anio }), prioridad: 'secundaria', claseDeCelda: 'text-sm tabular-nums' },
    { id: 'beneficiarios', encabezado: t('inversion.programas.columnas.beneficiarios'), prioridad: 'secundaria', claseDeCelda: 'text-sm tabular-nums' }
  ]
  const celda = (p: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'codigo':
        return texto(p, 'code') || '—'
      case 'programa':
        return enlace(p, true)
      case 'proyecto':
        return nombreDelProyecto(texto(p, 'project'))
      case 'socio':
        return texto(p, 'partner_organization') ? (
          <RegistroVinculado objeto="organization" id={texto(p, 'partner_organization')} />
        ) : (
          t('inversion.programas.sinSocio')
        )
      case 'estado':
        return <EstadoChip objeto="social_program" estado={p.state} />
      case 'presupuesto':
        return presupuestoDelPrograma(presupuesto, p.id, anio, 'allocated', textosDeMonto)
      case 'ejecutado':
        return presupuestoDelPrograma(presupuesto, p.id, anio, 'executed', textosDeMonto)
      default:
        return alcanzados(p.id)
    }
  }
  return (
    <section aria-label={t('inversion.programas.titulo')} className="space-y-2">
      {programas.isPending ? (
        <Cargando />
      ) : programas.isError && !programas.data ? (
        <FalloDeLectura error={programas.error} alReintentar={() => void programas.refetch()} />
      ) : filas.length === 0 ? (
        <Vacio titulo={t('inversion.programas.vacio')}>{t('inversion.programas.vacioAyuda')}</Vacio>
      ) : telefono ? (
        // en el teléfono, tarjetas (revisión de UX, etapa 8)
        <ListaEnTarjetas
          etiqueta={t('inversion.programas.tabla')}
          total={programas.data?.totalElements ?? null}
          tarjetas={filas.map((p) => ({
            id: p.id,
            titulo: enlace(p),
            estado: <EstadoChip objeto="social_program" estado={p.state} />,
            proyecto: proyecto ? undefined : nombreDelProyecto(texto(p, 'project')),
            detalle: `${t('inversion.programas.columnas.presupuesto', { anio })}: ${presupuestoDelPrograma(presupuesto, p.id, anio, 'allocated', textosDeMonto)}`
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('inversion.programas.tabla')}
          total={programas.data?.totalElements ?? null}
          columnas={columnas}
          filas={filas}
          clave={(p) => p.id}
          celda={celda}
          alAbrir={fila.abrir}
          alPrevisualizar={fila.previsualizar}
          orden={orden}
          alOrdenar={alOrdenar}
        />
      )}
      <PaginacionDelServidor datos={programas.data} alPagina={(p) => lista.cambiar({ pp: String(p), page: lista.filtro('page') || null })} />
    </section>
  )
}

// la consulta de una vista de los aportes: los terminados, los que siguen en curso o todos, con el estado elegido; null si el
// estado no cabe en la vista
const consultaDeVista = (vista: string): Parametros =>
  vista === 'todos' ? {} : vista === 'terminados' ? { state: estados(APORTE_TERMINADO) } : { state_not: estados(APORTE_TERMINADO) }
const consultaDeAportes = (vista: string, proyecto: string | undefined, estado: string): Parametros | null => {
  const deLaVista = conEstado(consultaDeVista(vista), estado)
  return deLaVista && { project: proyecto, ...deLaVista }
}

function Aportes({ proyecto, vista, estado }: { proyecto?: string; vista: string; estado: string }) {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista(vista)
  const actual = consultaDeAportes(vista, proyecto, estado)
  // el orden es de esta visita: no viaja en la URL, y otro orden vuelve a la primera página
  const [orden, setOrden] = useState(ORDEN_INICIAL_DE_APORTES)
  const ordenar = (siguiente: OrdenDeTabla) => {
    setOrden(siguiente)
    lista.cambiar({ page: null })
  }
  const aportes = useRegistros(
    'social_contribution',
    { ...actual, sort: ORDEN_DE_APORTES[orden.columna], dir: orden.dir, page: lista.pagina, size: POR_PAGINA },
    actual !== null
  )
  const nombreDelProyecto = useNombreDelProyecto()
  const telefono = useEsTelefono()
  const filtrados = actual ? (aportes.data?.content ?? []) : []
  const fila = useAccionesDeFila('social_contribution', t('inversion.titulo'))
  const enlace = (a: Registro) => (
    <EnlaceDeRegistro
      titulo={texto(a, 'code')}
      ruta={rutaDeFicha('social_contribution', a)}
      previa={{ objeto: 'social_contribution', id: a.id }}
      desde={t('inversion.titulo')}
    />
  )
  // la tabla con prioridad de columnas (DD-05): esenciales el aporte, el proyecto, quién recibe, el estado y el monto (en su
  // moneda, «—» si no vino); secundarias el tipo y la campaña
  const columnas: ColumnaPriorizada[] = [
    { id: 'codigo', encabezado: t('inversion.aportes.columnas.codigo'), prioridad: 'esencial', claseDeCelda: 'font-sg-mono text-sm', ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('inversion.aportes.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'tipo', encabezado: t('inversion.aportes.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'recibe', encabezado: t('inversion.aportes.columnas.recibe'), prioridad: 'esencial', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('inversion.aportes.columnas.estado'), prioridad: 'esencial' },
    { id: 'monto', encabezado: t('inversion.aportes.columnas.monto'), prioridad: 'esencial', claseDeCelda: 'text-sm tabular-nums' },
    { id: 'campana', encabezado: t('inversion.aportes.columnas.campana'), prioridad: 'secundaria', claseDeCelda: 'text-sm' }
  ]
  const celda = (a: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'codigo':
        return enlace(a)
      case 'proyecto':
        return nombreDelProyecto(texto(a, 'project'))
      case 'tipo':
        return opcion(a, 'contribution_type') || '—'
      case 'recibe':
        return texto(a, 'recipient_organization') ? (
          <RegistroVinculado objeto="organization" id={texto(a, 'recipient_organization')} />
        ) : texto(a, 'stakeholder') ? (
          <RegistroVinculado objeto="stakeholder" id={texto(a, 'stakeholder')} />
        ) : (
          '—'
        )
      case 'estado':
        return <EstadoChip objeto="social_contribution" estado={a.state} />
      case 'monto':
        return montoPe(atributo(a, 'total_amount'), atributo(a, 'currency'))
      default:
        return texto(a, 'exploration_campaign') ? <RegistroVinculado objeto="exploration_campaign" id={texto(a, 'exploration_campaign')} /> : '—'
    }
  }
  return (
    <section aria-label={t('inversion.aportes.titulo')} className="space-y-2">
      {actual && aportes.isPending ? (
        <Cargando />
      ) : actual && aportes.isError && !aportes.data ? (
        <FalloDeLectura error={aportes.error} alReintentar={() => void aportes.refetch()} />
      ) : filtrados.length === 0 ? (
        <Vacio titulo={t('inversion.aportes.vacio')}>{t('inversion.aportes.vacioAyuda')}</Vacio>
      ) : telefono ? (
        <ListaEnTarjetas
          etiqueta={t('inversion.aportes.tabla')}
          tarjetas={filtrados.map((a) => ({
            id: a.id,
            titulo: enlace(a),
            estado: <EstadoChip objeto="social_contribution" estado={a.state} />,
            proyecto: proyecto ? undefined : nombreDelProyecto(texto(a, 'project')),
            detalle: [opcion(a, 'contribution_type'), montoPe(atributo(a, 'total_amount'), atributo(a, 'currency'))].filter(Boolean).join(' · ')
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('inversion.aportes.tabla')}
          columnas={columnas}
          filas={filtrados}
          clave={(a) => a.id}
          celda={celda}
          alAbrir={fila.abrir}
          alPrevisualizar={fila.previsualizar}
          orden={orden}
          alOrdenar={ordenar}
        />
      )}
      <PaginacionDelServidor datos={aportes.data} alPagina={(p) => lista.cambiar({ page: String(p) })} />
    </section>
  )
}

// el alta de un aporte (con motivo: requiresReason) o de un programa en el proyecto del contexto, con la moneda PEN propuesta; al
// guardar se abre su ficha (S44 o S43)
function Alta({ objeto, proyecto, alCerrar }: { objeto: 'social_contribution' | 'social_program'; proyecto: string; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const motivo = useMotivo()
  const fijos = useMemo(() => ({ project: proyecto }), [proyecto])
  const iniciales = useMemo(() => ({ currency: MONEDA_POR_DEFECTO }), [])
  const esAporte = objeto === 'social_contribution'
  return (
    <Drawer
      titulo={t(esAporte ? 'inversion.nuevoAporte' : 'inversion.nuevoPrograma')}
      descripcion={t(esAporte ? 'inversion.altaAporteAyuda' : 'inversion.altaProgramaAyuda')}
      abierto
      alCerrar={alCerrar}
    >
      {esAporte ? <CampoDeMotivo motivo={motivo} etiqueta={t('inversion.motivo')} ayuda={t('inversion.motivoAyuda')} /> : null}
      <FormularioDeRegistro
        objeto={objeto}
        fijos={fijos}
        iniciales={iniciales}
        campos={esAporte ? CAMPOS_DEL_APORTE : CAMPOS_DEL_PROGRAMA}
        motivo={esAporte ? motivo.recortado : undefined}
        antesDeEnviar={esAporte ? motivo.exigir : undefined}
        alGuardar={(r) => navegar(rutaDeFicha(objeto, r) ?? `/projects/${encodeURIComponent(proyecto)}/programs`)}
        alCancelar={alCerrar}
      />
    </Drawer>
  )
}
