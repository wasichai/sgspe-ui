import { useAuth } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router'
import { ErrorDeCarga, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { Insignia } from '../componentes/Insignia'
import { MigasDelProyecto, pestanaDeSegmento, ProveedorDeMigas } from '../componentes/Migas'
import { useTituloDeDocumento } from '../componentes/Pagina'
import { PestanasDesplazables } from '../componentes/PestanasDesplazables'
import { NS } from '../i18n'
import { LEE_ACUERDOS } from '../shell/leeAcuerdos'
import { LEE_PROPUESTAS } from '../shell/leePropuestas'
import { estadoDe, guardaDe, useOferta, type ClaveDeSeccion, type Par } from '../shell/navTree'
import { seccionDeRuta } from '../shell/seccionActual'
import { BarraDeContexto } from './BarraDeContexto'
import { useConteosDelProyecto } from './conteos'
import { useMisAsignaciones, useProyecto, vigenciaDeAsignacion } from './proyectos'

// el ProjectLayout de screens.md §2: dentro de un proyecto, la barra de contexto y la sub-navegación de Project 360; por
// debajo de lg pasa a una fila desplazable. con el alcance por proyecto (ADR-0029) solo llega aquí sin asignación quien lee
// todos los proyectos (READ_ALL_PROJECTS): lee en solo lectura (design-system.md §6.5), salvo ADMIN, que no necesita asignación.
// un proyecto que responde 404 no existe o no es de sus proyectos, sin distinguir (spec 4.4 §3.6)
const PESTANAS = [
  'overview',
  'map',
  'stakeholders',
  'engagements',
  'commitments',
  'agreements',
  'attention',
  'risks',
  'programs',
  'documents',
  'tasks',
  'ai-review',
  'reports',
  'settings'
] as const
type Pestana = (typeof PESTANAS)[number]
// la revisión de UX (decisión 2, ux-architecture.md §7.1): nueve pestañas a la vista y «Más» con las demás. Acuerdos no es
// pestaña: es una vista de Compromisos (VISTAS_DE_PESTANA), y su pestaña es Compromisos
const EN_MAS: readonly Pestana[] = ['tasks', 'ai-review', 'reports', 'settings']
const VISTAS_DE_PESTANA: Partial<Record<Pestana, Pestana[]>> = { commitments: ['commitments', 'agreements'] }
const PESTANA_DE_VISTA: Partial<Record<string, Pestana>> = { agreements: 'commitments' }
// las pestañas de otra sección se ofrecen con los permisos de esa sección, como el árbol y su guarda (GuardaDeSeccion): el PAD
// no ve «Grupos de interés» ni «Relacionamiento» para llegar al aviso de que no puede abrirlas. Acuerdos vive bajo Compromisos
// pero se ofrece con READ sobre agreement, como sus rutas (rutasEnProyecto.ts y pantallas.ts)
const SECCION_DE_PESTANA: Partial<Record<Pestana, ClaveDeSeccion>> = {
  stakeholders: 'stakeholders',
  engagements: 'engagements',
  commitments: 'commitments',
  agreements: 'commitments',
  attention: 'attention',
  risks: 'risks',
  programs: 'programs',
  documents: 'documents',
  tasks: 'tasks',
  'ai-review': 'projects',
  reports: 'reports'
}
const PERMISOS_DE_PESTANA: Partial<Record<Pestana, Par[][]>> = { agreements: LEE_ACUERDOS, 'ai-review': LEE_PROPUESTAS }

export function ProyectoLayout() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const proyecto = useProyecto(projectId)
  const asignaciones = useMisAsignaciones()
  const escribe = useEscribeEnProyecto(projectId)
  const oferta = useOferta()
  const { pathname } = useLocation()
  const [registro, setRegistro] = useState<string | null>(null)
  // la ficha de una queja vive en /grievances/:id y su pestaña es la de QCS: se marca esa y las migas la nombran
  const pestanaActual = pestanaDeSegmento(pathname.split('/')[3] ?? 'overview')
  const seccion = seccionDeRuta(pathname)
  // D7: la pestaña (o la sección de la ruta, si no es una pestaña) y el proyecto en el título del documento
  useTituloDeDocumento(t(`contexto.pestanas.${pestanaActual}`, { defaultValue: '' }) || (seccion ? t(`secciones.${seccion}`) : ''), 1)
  const pestanas = PESTANAS.filter((p) => {
    const clave = SECCION_DE_PESTANA[p]
    return !clave || estadoDe(guardaDe(clave, PERMISOS_DE_PESTANA[p]), oferta) === 'disponible'
  })
  const base = `/projects/${encodeURIComponent(projectId ?? '')}`
  // una vista es pestaña propia si la cuenta no tiene la pestaña que la contiene (lee acuerdos pero no compromisos)
  const contenedora = (p: string) => {
    const de = PESTANA_DE_VISTA[p]
    return de && pestanas.includes(de) ? de : undefined
  }
  const marcada = contenedora(pestanaActual) ?? pestanaActual
  const visibles = pestanas.filter((p) => !EN_MAS.includes(p) && !contenedora(p))
  const enMas = pestanas.filter((p) => EN_MAS.includes(p))
  // las vistas de la pestaña marcada, solo en su lista (no en una ficha) y si la cuenta tiene más de una
  const vistas = (VISTAS_DE_PESTANA[marcada as Pestana] ?? []).filter((v) => pestanas.includes(v))
  const enLista = pathname.split('/').length === 4
  const corto = (p: Pestana) => (p === 'attention' ? t('seccionesCortas.attention') : '')
  const conteos = useConteosDelProyecto(projectId, visibles)
  const idConteo = useId()
  // el total y lo que pide acción, dichos en la descripción del enlace: su nombre sigue siendo el de la pestaña
  const describir = (p: Pestana) => {
    const c = conteos[p]
    const partes = [
      c?.total != null ? t('contexto.conteos.total', { count: c.total }) : '',
      c?.accion ? t('contexto.conteos.vencidos', { count: c.accion }) : ''
    ]
    return partes.filter(Boolean).join(', ')
  }
  // solo sin datos: un refetch fallido (tras guardar o volver a la pestaña) no desmonta el Outlet ni pierde lo escrito
  if (proyecto.isError && !proyecto.data)
    return (
      <div className="mx-auto max-w-[1440px] space-y-3">
        {esIlegible(proyecto.error) ? <NoEsDeSusProyectos /> : <ErrorDeCarga error={proyecto.error} alReintentar={() => void proyecto.refetch()} />}
        <Link to="/projects" className="inline-block text-sm font-medium text-sg-primary-text">
          {t('contexto.irAProyectos')}
        </Link>
      </div>
    )
  return (
    <ProveedorDeMigas value={setRegistro}>
      <div className="mx-auto max-w-[1440px] space-y-4">
        <BarraDeContexto principal={<MigasDelProyecto pestana={marcada} registro={registro ?? undefined} />} />
        <div className="flex items-end gap-1 border-b border-sg-border">
          <PestanasDesplazables etiqueta={t('contexto.subnav')} className="min-w-0 flex-1 [&>nav]:border-b-0">
            {visibles.map((p) => (
              <Link
                key={p}
                to={`${base}/${p}`}
                aria-current={p === marcada ? 'page' : undefined}
                aria-label={corto(p) ? t(`contexto.pestanas.${p}`) : undefined}
                aria-describedby={describir(p) ? `${idConteo}-${p}` : undefined}
                title={corto(p) ? t(`contexto.pestanas.${p}`) : undefined}
                className={cn(CLASE_DE_PESTANA, 'flex items-center gap-1.5', p === marcada ? ACTIVA : REPOSO)}
              >
                {corto(p) || t(`contexto.pestanas.${p}`)}
                {conteos[p]?.total != null ? (
                  <span aria-hidden className="text-sg-caption tabular-nums text-sg-text-muted">
                    {conteos[p].total}
                  </span>
                ) : null}
                <Insignia n={conteos[p]?.accion} id={`${idConteo}-${p}-accion`} descripcion="" />
                {describir(p) ? (
                  <span id={`${idConteo}-${p}`} hidden>
                    {describir(p)}
                  </span>
                ) : null}
              </Link>
            ))}
          </PestanasDesplazables>
          {enMas.length > 0 ? <MasPestanas base={base} pestanas={enMas} marcada={marcada} /> : null}
        </div>
        {enLista && vistas.length > 1 ? (
          <nav aria-label={t('contexto.vistasDe', { pestana: t(`contexto.pestanas.${marcada}`) })} className="flex gap-1 text-sm">
            {vistas.map((v) => (
              <Link
                key={v}
                to={`${base}/${v}`}
                aria-current={v === pestanaActual ? 'page' : undefined}
                className={cn(
                  'rounded-sg-md px-2.5 py-1',
                  v === pestanaActual ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
                )}
              >
                {t(`contexto.pestanas.${v}`)}
              </Link>
            ))}
          </nav>
        ) : null}
        {asignaciones.isSuccess && !escribe ? <Alert tone="notice">{t('contexto.soloLectura')}</Alert> : null}
        <Outlet />
      </div>
    </ProveedorDeMigas>
  )
}

const CLASE_DE_PESTANA = 'whitespace-nowrap border-b-2 px-3 py-2 text-sm'
const ACTIVA = 'border-sg-primary font-medium text-sg-primary-text'
const REPOSO = 'border-transparent text-sg-text-secondary hover:text-sg-text'

// «Más»: las pestañas que no van a la vista. si la abierta es una de ellas, el botón la nombra y queda marcado
function MasPestanas({ base, pestanas, marcada }: { base: string; pestanas: readonly Pestana[]; marcada: string }) {
  const { t } = useTranslation(NS)
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const abierta = pestanas.find((p) => p === marcada)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const nombre = abierta ? `${t('contexto.masPestanas')}: ${t(`contexto.pestanas.${abierta}`)}` : t('contexto.masPestanas')
  return (
    <div
      ref={raiz}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        setAbierto(false)
        boton.current?.focus()
      }}
    >
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={nombre}
        aria-current={abierta ? 'page' : undefined}
        onClick={() => setAbierto((a) => !a)}
        className={cn(CLASE_DE_PESTANA, 'flex items-center gap-1', abierta ? ACTIVA : REPOSO)}
      >
        {abierta ? t(`contexto.pestanas.${abierta}`) : t('shell.mas')}
        <ChevronDown aria-hidden className="size-3.5" />
      </button>
      {abierto ? (
        <div
          id={id}
          role="group"
          aria-label={t('contexto.masPestanas')}
          className="absolute top-full right-0 z-30 mt-1 flex min-w-48 flex-col rounded-sg-md border border-sg-border bg-sg-surface p-1 shadow-sg-md"
        >
          {pestanas.map((p) => (
            <Link
              key={p}
              to={`${base}/${p}`}
              onClick={() => setAbierto(false)}
              aria-current={p === marcada ? 'page' : undefined}
              className={cn(
                'rounded-sg-sm px-2.5 py-1.5 text-sm',
                p === marcada ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
              )}
            >
              {t(`contexto.pestanas.${p}`)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// si la cuenta puede escribir en el proyecto: tiene una asignación vigente, activa y dentro de sus fechas (ProjectScopeGuard
// decide; esto solo oculta lo que el servidor rechazaría)
export function useAsignadoAlProyecto(projectId: string | undefined): boolean {
  const asignaciones = useMisAsignaciones()
  return (asignaciones.data ?? []).some((a) => a.attributes.project === projectId && vigenciaDeAsignacion(a) === 'vigente')
}

// si la cuenta escribe en el proyecto como lo decide ProjectScopeGuard: ADMIN sin asignación (P38) y los demás con una asignación
// vigente. es la guarda de UI de toda escritura con alcance de proyecto, junto con can(objeto, acción). las escrituras de
// project_assignment están exentas (security.md §9.2, ítem 5: así se forman los equipos) y dependen solo de can(...)
export function useEscribeEnProyecto(projectId: string | undefined): boolean {
  const { isAdmin } = useAuth()
  const asignado = useAsignadoAlProyecto(projectId)
  return isAdmin || asignado
}
