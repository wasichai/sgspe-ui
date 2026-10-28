import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { tituloQueDiceQueEs } from '../componentes/CabeceraDeFicha'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ListaPriorizada, type EntradaPriorizada, type TonoDeEntrada } from '../componentes/ListaPriorizada'
import { Seccion } from '../componentes/Seccion'
import { nombreDeProyecto, useLeeTodosLosProyectos, useMisAsignaciones, useProyectos, vigenciaDeAsignacion } from '../contexto/proyectos'
import { esQcs, plazoQueCorre } from '../datos/atencion'
import { hoyEnLima } from '../datos/fechas'
import { rutaDeFicha } from '../datos/fichas'
import { usePedir } from '../datos/http'
import { rotuloDeOpcion } from '../datos/opciones'
import { atributo, consulta, estados, texto, useRegistros, type Pagina, type Parametros, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { sinFiltroDeAsignados, soloAsignados } from '../tareas/paraTomar'
import { TomarTarea } from '../tareas/TomarTarea'
import { useSuTrabajo } from './aSuCargo'

// «Lo que me toca hoy», lo primero del inicio (P-01 del rediseño de UX; hallazgos U-05 y U-13): lo abierto a su cargo (tareas,
// compromisos y QCS de useSuTrabajo), lo vencido primero, luego lo por vencer y lo demás por fecha, cinco a la vista con su motivo
// y su fecha y el resto desplegable en el lugar; y lo que puede tomar: la cola compartida (tareas abiertas sin asignar, como el
// grupo «Para tomar» de Mis tareas), sin elegir un proyecto en el selector. es una sola lectura, que el servidor acota a sus
// proyectos (ADR-0029), con un tope y «Ver los N» hacia Mis tareas; cada tarea dice su proyecto. quien lee todos los proyectos
// la pide con assigned=true, para recibir la de sus proyectos asignados y no la de todo el tenant (B-04, tareas/paraTomar.ts); con
// un servidor que no lo conoce (422) se le lee la de cada proyecto con asignación vigente, con un tope de proyectos y «Ver los N»
// hacia la lista de tareas de cada uno. todo es lo que la API devolvió a quien mira: nada cuenta lo que no lee
const A_LA_VISTA = 5
const PARA_TOMAR = 5
const POR_PROYECTO = 3
const TOPE_DE_PROYECTOS = 6
const TAREA_ABIERTA = ['open', 'in_progress', 'blocked']
const URGENCIA: Record<string, number> = { VENCIDO: 0, 'POR VENCER': 1 }
const TONO: Record<string, TonoDeEntrada> = { VENCIDO: 'peligro', 'POR VENCER': 'aviso' }

interface DeSuCargo {
  objeto: string
  registro: Registro
}

// la fecha que vence: la de una tarea o un compromiso, o el plazo que corre en el estado de una QCS
const fechaDe = ({ objeto, registro }: DeSuCargo): string => (esQcs(objeto) ? (plazoQueCorre(objeto, registro)?.fecha ?? '') : texto(registro, 'due_date'))
// se lee como el resto del portal («17 oct. 2026», diaPe), no en el formato de escritura de CampoFecha: un instante, por su día de
// Lima (tercera pasada de UX: el inicio decía «17/10/2026» al lado de «desde el 23 oct. 2026»)
const diaLegible = (fecha: string): string => diaPe(/^\d{4}-\d{2}-\d{2}T/.test(fecha) ? hoyEnLima(new Date(fecha)) : fecha.slice(0, 10))

const porUrgencia = (a: DeSuCargo, b: DeSuCargo): number => {
  const urgencia = (x: DeSuCargo) => URGENCIA[texto(x.registro, 'deadline_status')] ?? 2
  if (urgencia(a) !== urgencia(b)) return urgencia(a) - urgencia(b)
  // sin fecha, al final
  const fa = fechaDe(a) || '9999'
  const fb = fechaDe(b) || '9999'
  return fa.localeCompare(fb)
}

const nombreDe = ({ objeto, registro }: DeSuCargo): string => {
  if (objeto === 'task') return texto(registro, 'title') || registro.id
  if (objeto === 'commitment') return [texto(registro, 'code'), texto(registro, 'title')].filter(Boolean).join(' · ') || registro.id
  // una QCS dice también lo que plantea (tercera pasada de UX, 3.2): el código solo no dice de qué se trata
  return [texto(registro, 'code'), tituloQueDiceQueEs(texto(registro, 'description'), '')].filter(Boolean).join(' · ') || registro.id
}

export function LoQueMeToca() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const trabajo = useSuTrabajo()
  const leeTareas = can('task', 'READ')
  const leeTodos = useLeeTodosLosProyectos()
  const asignaciones = useMisAsignaciones()
  const proyectos = useProyectos()
  const enSusProyectos = useRegistros(
    'task',
    { ...soloAsignados(leeTodos), empty: 'assignee_user_id', state: estados(TAREA_ABIERTA), sort: 'due_date', dir: 'asc', size: PARA_TOMAR },
    leeTareas
  )
  // un servidor sin assigned: la cola de cada proyecto con asignación vigente, como antes del filtro
  const porProyecto = leeTodos && sinFiltroDeAsignados(enSusProyectos.error)
  const vigentes = porProyecto
    ? [...new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(atributo(a, 'project'))))]
    : []
  const consultados = vigentes.slice(0, TOPE_DE_PROYECTOS)
  const pedir = usePedir()
  // el estado de cada entrada con el rótulo de su flujo; sin el flujo legible, la entrada no lo dice
  const etiquetas: Record<string, Record<string, string>> = {
    task: useEtiquetasDeEstado('task'),
    commitment: useEtiquetasDeEstado('commitment'),
    grievance: useEtiquetasDeEstado('grievance'),
    inquiry: useEtiquetasDeEstado('inquiry'),
    stakeholder_request: useEtiquetasDeEstado('stakeholder_request')
  }
  // lo que se acaba de tomar en la línea: la tarea pasa a «A su cargo» y aquí se dice
  const [tomada, setTomada] = useState<string | null>(null)
  const colas = useQueries({
    queries: consultados.map((proyecto) => {
      const busqueda = consulta({
        project: proyecto,
        empty: 'assignee_user_id',
        state: estados(TAREA_ABIERTA),
        sort: 'due_date',
        dir: 'asc',
        size: POR_PROYECTO
      } satisfies Parametros)
      return { queryKey: ['records', 'task', busqueda], queryFn: () => pedir<Pagina>(`/objects/task/records?${busqueda}`), enabled: leeTareas }
    })
  })

  const nombreDelProyecto = (id: string): string | null => {
    const registro = (proyectos.data ?? []).find((p) => p.id === id)
    return registro ? nombreDeProyecto(registro) : null
  }
  // el motivo de una entrada: qué es, de qué proyecto, en qué estado (tercera pasada de UX, 3.2) y en qué situación de plazo está;
  // y cuándo vence o venció. una tarea para tomar lleva «Tomar» en la línea
  const entrada = (item: DeSuCargo, tipo: string, proyecto?: string | null, paraTomar = false): EntradaPriorizada => {
    const situacion = texto(item.registro, 'deadline_status')
    const fecha = fechaDe(item)
    const estado = paraTomar ? '' : (etiquetas[item.objeto]?.[item.registro.state ?? ''] ?? '')
    return {
      clave: `${item.objeto}-${item.registro.id}`,
      titulo: nombreDe(item),
      a: rutaDeFicha(item.objeto, item.registro) ?? '/tasks',
      motivo: [tipo, proyecto ?? '', estado, situacion ? rotuloDeOpcion(situacion) : ''].filter(Boolean).join(' · '),
      cuando: fecha ? t(situacion === 'VENCIDO' ? 'miDia.hoy.vencio' : 'miDia.hoy.vence', { fecha: diaLegible(fecha) }) : undefined,
      tono: TONO[situacion] ?? 'neutro',
      accion: paraTomar ? <TomarTarea tarea={item.registro} alTomar={(r) => setTomada(texto(r, 'title'))} /> : undefined
    }
  }

  const aCargo: DeSuCargo[] = [
    ...trabajo.abiertas.map((registro) => ({ objeto: 'task', registro })),
    ...trabajo.aCargo.map((registro) => ({ objeto: 'commitment', registro })),
    ...trabajo.qcs
  ].sort(porUrgencia)
  const sinAsignar = t('miDia.hoy.sinAsignar')
  const paraTomar: { clave: string; titulo: string; pagina: Pagina; limite: number; a: string; entradas: EntradaPriorizada[] }[] = !leeTareas
    ? []
    : porProyecto
      ? consultados.flatMap((proyecto, i) => {
          const pagina = colas[i]?.data
          if (!pagina || pagina.content.length === 0) return []
          const nombre = nombreDelProyecto(proyecto)
          return [
            {
              clave: proyecto,
              titulo: nombre ? t('miDia.hoy.paraTomar', { proyecto: nombre }) : t('miDia.hoy.paraTomarSinNombre'),
              pagina,
              limite: POR_PROYECTO,
              a: `/projects/${encodeURIComponent(proyecto)}/tasks`,
              entradas: pagina.content.map((registro) => entrada({ objeto: 'task', registro }, sinAsignar, null, true))
            }
          ]
        })
      : enSusProyectos.data && enSusProyectos.data.content.length > 0
        ? [
            {
              clave: 'sus-proyectos',
              titulo: t('miDia.hoy.paraTomarEnSusProyectos'),
              pagina: enSusProyectos.data,
              limite: PARA_TOMAR,
              a: '/tasks',
              entradas: enSusProyectos.data.content.map((registro) =>
                entrada({ objeto: 'task', registro }, sinAsignar, nombreDelProyecto(texto(registro, 'project')), true)
              )
            }
          ]
        : []
  if (!trabajo.lee && paraTomar.length === 0) return null
  const otros = leeTareas ? vigentes.length - consultados.length : 0
  return (
    <Seccion
      titulo={t('miDia.hoy.titulo')}
      descripcion={t('miDia.hoy.descripcion')}
      acciones={
        leeTareas ? (
          <Link to="/tasks" className="text-sg-body-sm font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
            {t('miDia.hoy.verTareas')}
          </Link>
        ) : undefined
      }
    >
      {trabajo.lee ? (
        trabajo.cargando ? (
          <Cargando compacto />
        ) : (
          <>
            {/* una lectura que falló se dice con su reintento; con alguna fallida, la lista vacía no dice «nada pendiente» */}
            {trabajo.fallidas.map((f) => (
              <div key={f.objeto} className="space-y-2">
                <p className="text-sm text-sg-text-secondary">{t('miDia.hoy.noSeLeyo', { que: t(`miDia.fuentes.${f.objeto}`) })}</p>
                <FalloDeLectura error={f.error} alReintentar={f.reintentar} />
              </div>
            ))}
            <ListaPriorizada
              titulo={t('miDia.hoy.aCargo')}
              total={aCargo.length}
              limite={A_LA_VISTA}
              vacio={trabajo.fallidas.length > 0 ? undefined : t('miDia.hoy.nada')}
              entradas={aCargo.map((item) => entrada(item, t(`miDia.tipos.${item.objeto}`), nombreDelProyecto(texto(item.registro, 'project'))))}
            />
          </>
        )
      ) : null}
      {tomada ? (
        <p role="status" className="text-sm text-sg-success">
          {t('miDia.hoy.tomada', { titulo: tomada })}
        </p>
      ) : null}
      {paraTomar.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {paraTomar.map(({ clave, titulo, pagina, limite, a, entradas }) => (
            <ListaPriorizada key={clave} titulo={titulo} total={pagina.totalElements ?? null} limite={limite} entradas={entradas} verTodos={{ a }} />
          ))}
        </div>
      ) : null}
      {otros > 0 ? <p className="text-sg-caption text-sg-text-muted">{t('miDia.hoy.otrosProyectos', { count: otros })}</p> : null}
    </Seccion>
  )
}
