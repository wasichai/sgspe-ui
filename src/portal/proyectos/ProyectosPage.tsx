import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { comparable } from '../componentes/FiltroDeGrupo'
import { ordenarEnCliente } from '../componentes/ordenEnCliente'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, NoDisponible, Vacio } from '../componentes/Estados'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { ROL_DE_JEFATURA } from '../config'
import { useLeeTodosLosProyectos, useMisAsignaciones } from '../contexto/proyectos'
import { atributo, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { Persona } from '../componentes/Persona'

// S06 · lista de proyectos (screens.md §3): vistas "Mis proyectos", "Activos", "En revisión" y "Todos"; filtros por tipo,
// etapa y fase en la URL; la jefatura son las asignaciones activas con el rol de jefatura (ASM-080) y la campaña en curso,
// la que está EN EJECUCION. los proyectos de un tenant son pocos: se leen todos y se filtran aquí. desde la tercera pasada de UX
// (3.8), con el patrón común de las listas: las vistas en el selector, la búsqueda por código o nombre y los filtros en la barra,
// y la tabla priorizada con el orden en la URL
const VISTAS = ['mine', 'active', 'in_review', 'all'] as const
const CAMPO_DE_ORDEN: Record<string, string> = { codigo: 'code', nombre: 'name' }
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'nombre', dir: 'asc' }
const FILTROS = [
  ['project_type', 'tipo'],
  ['stage', 'etapa'],
  ['exploration_phase', 'fase']
] as const

export function ProyectosPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const telefono = useEsTelefono()
  const leeTodo = useLeeTodosLosProyectos()
  // quien lee todos los proyectos abre en «Todos»: sus asignaciones pueden no existir, y el
  // selector de la cabecera ya le dice «Todos los proyectos»
  const lista = useParametrosDeLista(leeTodo ? 'all' : 'mine')
  const proyectos = useTodos('project', { sort: 'name', dir: 'asc' })
  const definicion = useDefinicion('project')
  const asignaciones = useMisAsignaciones()
  const jefaturas = useTodos('project_assignment', { role_name: ROL_DE_JEFATURA, active: true })
  const campanas = useTodos('exploration_campaign', { campaign_status: 'EN EJECUCION' })

  // «Mis proyectos» sale de las asignaciones propias: sin ellas no hay lista que mostrar, ni siquiera vacía
  const mios = new Set((asignaciones.data ?? []).map((a) => String(atributo(a, 'project'))))
  const porProyecto = (registros: Registro[] | undefined, campo: string) => {
    const mapa = new Map<string, Set<string>>()
    for (const r of registros ?? []) {
      const valor = texto(r, campo)
      if (!valor) continue
      const proyecto = String(atributo(r, 'project'))
      mapa.set(proyecto, (mapa.get(proyecto) ?? new Set<string>()).add(valor))
    }
    return mapa
  }
  const jefes = porProyecto(jefaturas.data, 'member_user_email')
  const enCurso = porProyecto(campanas.data, 'name')
  // la jefatura y la campaña son de otras consultas: mientras cargan no se afirma nada, y si fallan o dan 403 se dice. solo
  // sin datos: un refetch fallido (volver a la pestaña) no reemplaza lo ya cargado por «No disponible»
  const celda = (
    consulta: { isPending: boolean; isError: boolean; data: unknown },
    valores: Set<string> | undefined,
    vacio: ReactNode,
    mostrar: (valores: Set<string>) => ReactNode = (v) => [...v].join(', ')
  ) =>
    consulta.isError && !consulta.data ? (
      <NoDisponible />
    ) : consulta.isPending ? (
      <span className="text-sg-text-muted">…</span>
    ) : valores ? (
      mostrar(valores)
    ) : (
      vacio
    )
  const lasMias = lista.vista === 'mine'
  const cargando = proyectos.isPending || (lasMias && asignaciones.isPending)
  // el error de carga reemplaza la lista solo si no hay lista: un refetch fallido deja la ya cargada
  const fallo = proyectos.isError && !proyectos.data ? proyectos : lasMias && asignaciones.isError && !asignaciones.data ? asignaciones : null
  // sin asignaciones vigentes ni la acción de leer todos, el servidor no devuelve ningún proyecto (alcance por proyecto, spec 4.4
  // §3.12): se dice que no tiene proyectos asignados, no «un proyecto nace con Nuevo proyecto» a quien no puede crearlo
  const sinProyectos = proyectos.isSuccess && proyectos.data.length === 0 && !leeTodo && !can('project', 'CREATE')

  const buscado = comparable(lista.filtro('q').trim())
  const enLaVista = (vista: string, p: Registro) => {
    if (vista === 'mine' && !mios.has(p.id)) return false
    if ((vista === 'active' || vista === 'in_review') && p.state !== vista) return false
    if (buscado && !comparable(`${texto(p, 'code')} ${texto(p, 'name')}`).includes(buscado)) return false
    return FILTROS.every(([campo]) => !lista.filtro(campo) || atributo(p, campo) === lista.filtro(campo))
  }
  const [orden, ordenar] = ordenEnUrl(lista, ORDEN_INICIAL, ['codigo', 'nombre'])
  const filtrados = ordenarEnCliente(
    (proyectos.data ?? []).filter((p) => enLaVista(lista.vista, p)),
    orden,
    (p, columna) => texto(p, CAMPO_DE_ORDEN[columna])
  )
  // cada vista dice cuántos tiene con los filtros puestos (revisión de UX, etapa 3)
  const conteoDe = (vista: string) => (proyectos.data ?? []).filter((p) => enLaVista(vista, p)).length
  const chips = [
    ...FILTROS.filter(([campo]) => lista.filtro(campo)).map(([campo, clave]) => ({
      clave: campo as string,
      etiqueta: `${t(`proyectos.filtros.${clave}`)}: ${rotuloDeOpcion(lista.filtro(campo))}`
    })),
    ...(buscado ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: lista.filtro('q').trim() }) }] : [])
  ]
  const sinFiltros = Object.fromEntries([...FILTROS.map(([c]) => [c, null]), ['q', null]])
  const ruta = (p: Registro) => `/projects/${encodeURIComponent(p.id)}/overview`
  const columnas: ColumnaPriorizada[] = [
    { id: 'codigo', encabezado: t('proyectos.columnas.codigo'), prioridad: 'esencial', claseDeCelda: 'font-sg-mono text-sg-caption', ordenable: true },
    { id: 'nombre', encabezado: t('proyectos.columnas.nombre'), prioridad: 'esencial', ordenable: true },
    { id: 'tipo', encabezado: t('proyectos.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'etapa', encabezado: t('proyectos.columnas.etapa'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('proyectos.columnas.estado'), prioridad: 'esencial' },
    { id: 'jefatura', encabezado: t('proyectos.columnas.jefatura'), prioridad: 'esencial', claseDeCelda: 'text-sm' },
    { id: 'campana', encabezado: t('proyectos.columnas.campana'), prioridad: 'secundaria', claseDeCelda: 'text-sm' }
  ]
  const celdaDeTabla = (p: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'codigo':
        return texto(p, 'code')
      case 'nombre':
        return <EnlaceDeRegistro codigoAparte codigo={texto(p, 'code')} titulo={texto(p, 'name')} ruta={ruta(p)} desde={t('proyectos.titulo')} />
      case 'tipo':
        return opcion(p, 'project_type')
      case 'etapa':
        return opcion(p, 'stage')
      case 'estado':
        return <EstadoChip objeto="project" estado={p.state} />
      case 'jefatura':
        return celda(jefaturas, jefes.get(p.id), <span className="text-sg-warning">{t('proyectos.sinJefatura')}</span>, (correos) =>
          [...correos].map((c, i) => (
            <span key={c}>
              {i ? ', ' : ''}
              <Persona correo={c} />
            </span>
          ))
        )
      default:
        return celda(campanas, enCurso.get(p.id), '—')
    }
  }
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('proyectos.titulo')}
        conteo={cargando || fallo || sinProyectos ? undefined : t('proyectos.conteo', { count: filtrados.length })}
        primaria={
          can('project', 'CREATE') ? (
            <Button asChild size="sm">
              <Link to="/projects/new">{t('proyectos.nuevo')}</Link>
            </Button>
          ) : undefined
        }
      />
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((id) => ({ id, etiqueta: t(`proyectos.vistas.${id}`), n: cargando || fallo ? null : conteoDe(id) }))}
            actual={lista.vista}
            alElegir={(id) => lista.cambiar({ view: id })}
          />
        }
        busqueda={{ etiqueta: t('proyectos.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        frecuentes={FILTROS.filter(([campo]) => opciones(campo).length > 0).map(([campo, clave]) => (
          <FiltroDeLista
            key={campo}
            etiqueta={t(`proyectos.filtros.${clave}`)}
            opciones={opciones(campo)}
            value={lista.filtro(campo)}
            onChange={(e) => lista.cambiar({ [campo]: e.target.value })}
          />
        ))}
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={() => lista.cambiar(sinFiltros)}
      />
      {cargando ? (
        <Cargando />
      ) : fallo ? (
        <ErrorDeCarga error={fallo.error} alReintentar={() => void fallo.refetch()} />
      ) : sinProyectos ? (
        <Vacio titulo={t('contexto.sinProyectos')} />
      ) : filtrados.length === 0 ? (
        <VacioDeLista conFiltros={chips.length > 0 || lista.vista !== 'all'} alLimpiar={() => lista.cambiar({ view: 'all', ...sinFiltros })}>
          {/* «Nuevo proyecto» solo se le sugiere a quien puede crearlo, no a quien solo lee todos */}
          {can('project', 'CREATE') ? t('proyectos.vacio') : null}
        </VacioDeLista>
      ) : telefono ? (
        // en el teléfono, tarjetas (revisión de UX, etapa 8)
        <ListaEnTarjetas
          etiqueta={t('proyectos.titulo')}
          total={filtrados.length}
          tarjetas={filtrados.map((p) => ({
            id: p.id,
            titulo: <EnlaceDeRegistro codigo={texto(p, 'code')} titulo={texto(p, 'name')} ruta={ruta(p)} desde={t('proyectos.titulo')} />,
            estado: <EstadoChip objeto="project" estado={p.state} />,
            detalle: [opcion(p, 'project_type'), opcion(p, 'stage')].filter(Boolean).join(' · ') || undefined
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('proyectos.titulo')}
          total={filtrados.length}
          columnas={columnas}
          filas={filtrados}
          clave={(p) => p.id}
          celda={celdaDeTabla}
          orden={orden}
          alOrdenar={ordenar}
          alAbrir={(p) => navegar(ruta(p))}
        />
      )}
    </div>
  )
}
