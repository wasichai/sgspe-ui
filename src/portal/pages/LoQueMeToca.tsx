import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cargando } from '../componentes/Estados'
import { ListaPriorizada, type EntradaPriorizada, type TonoDeEntrada } from '../componentes/ListaPriorizada'
import { Seccion } from '../componentes/Seccion'
import { nombreDeProyecto, useMisAsignaciones, useProyectos, vigenciaDeAsignacion } from '../contexto/proyectos'
import { esQcs, plazoQueCorre } from '../datos/atencion'
import { textoDeDia } from '../datos/fechas'
import { rutaDeFicha } from '../datos/fichas'
import { usePedir } from '../datos/http'
import { rotuloDeOpcion } from '../datos/opciones'
import { atributo, consulta, estados, texto, type Pagina, type Parametros, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useSuTrabajo } from './aSuCargo'

// «Lo que me toca hoy», lo primero del inicio (P-01 del rediseño de UX; hallazgos U-05 y U-13): lo abierto a su cargo (tareas,
// compromisos y QCS de useSuTrabajo), lo vencido primero, luego lo por vencer y lo demás por fecha, cinco a la vista con su motivo
// y su fecha y el resto desplegable en el lugar; y lo que puede tomar: la cola compartida (tareas abiertas sin asignar, como el
// grupo «Para tomar» de Mis tareas) de cada proyecto con asignación vigente, sin elegir un proyecto en el selector, con un tope de
// proyectos y «Ver los N» hacia la lista de tareas de cada uno. todo es lo que la API devolvió a quien mira: nada cuenta lo que no lee
const A_LA_VISTA = 5
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
  return texto(registro, 'code') || registro.id
}

export function LoQueMeToca() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const trabajo = useSuTrabajo()
  const leeTareas = can('task', 'READ')
  const asignaciones = useMisAsignaciones()
  const proyectos = useProyectos()
  const vigentes = [...new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(atributo(a, 'project'))))]
  const consultados = vigentes.slice(0, TOPE_DE_PROYECTOS)
  const pedir = usePedir()
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

  // el motivo de una entrada: qué es y en qué situación de plazo está; y cuándo vence o venció
  const entrada = (item: DeSuCargo, tipo: string): EntradaPriorizada => {
    const situacion = texto(item.registro, 'deadline_status')
    const fecha = fechaDe(item)
    return {
      clave: `${item.objeto}-${item.registro.id}`,
      titulo: nombreDe(item),
      a: rutaDeFicha(item.objeto, item.registro) ?? '/tasks',
      motivo: [tipo, situacion ? rotuloDeOpcion(situacion) : ''].filter(Boolean).join(' · '),
      cuando: fecha ? t(situacion === 'VENCIDO' ? 'miDia.hoy.vencio' : 'miDia.hoy.vence', { fecha: textoDeDia(fecha) }) : undefined,
      tono: TONO[situacion] ?? 'neutro'
    }
  }

  const aCargo: DeSuCargo[] = [
    ...trabajo.abiertas.map((registro) => ({ objeto: 'task', registro })),
    ...trabajo.aCargo.map((registro) => ({ objeto: 'commitment', registro })),
    ...trabajo.qcs
  ].sort(porUrgencia)
  const paraTomar = leeTareas
    ? consultados.flatMap((proyecto, i) => {
        const pagina = colas[i]?.data
        if (!pagina || pagina.content.length === 0) return []
        const registroDelProyecto = (proyectos.data ?? []).find((p) => p.id === proyecto)
        return [{ proyecto, nombre: registroDelProyecto ? nombreDeProyecto(registroDelProyecto) : null, pagina }]
      })
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
          <ListaPriorizada
            titulo={t('miDia.hoy.aCargo')}
            total={aCargo.length}
            limite={A_LA_VISTA}
            vacio={t('miDia.hoy.nada')}
            entradas={aCargo.map((item) => entrada(item, t(`miDia.tipos.${item.objeto}`)))}
          />
        )
      ) : null}
      {paraTomar.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {paraTomar.map(({ proyecto, nombre, pagina }) => (
            <ListaPriorizada
              key={proyecto}
              titulo={nombre ? t('miDia.hoy.paraTomar', { proyecto: nombre }) : t('miDia.hoy.paraTomarSinNombre')}
              total={pagina.totalElements ?? null}
              limite={POR_PROYECTO}
              entradas={pagina.content.map((registro) => entrada({ objeto: 'task', registro }, t('miDia.hoy.sinAsignar')))}
              verTodos={{ a: `/projects/${encodeURIComponent(proyecto)}/tasks` }}
            />
          ))}
        </div>
      ) : null}
      {otros > 0 ? <p className="text-sg-caption text-sg-text-muted">{t('miDia.hoy.otrosProyectos', { count: otros })}</p> : null}
    </Seccion>
  )
}
