import { useAuth } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { ChevronDown, House, MapIcon, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router'
import { ErrorDeCarga, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { pestanaDeSegmento } from '../componentes/Migas'
import { MARGENES_DE_PAGINA, MARGENES_DE_RESPALDO, useTituloDeDocumento } from '../componentes/Pagina'
import { CabeceraDelProyecto } from '../proyectos/CabeceraDelProyecto'
import { PestanasDesplazables } from '../componentes/PestanasDesplazables'
import { NS } from '../i18n'
import { LEE_ACUERDOS } from '../shell/leeAcuerdos'
import { LEE_PROPUESTAS } from '../shell/leePropuestas'
import { estadoDe, guardaDe, NAV_TREE, useOferta, type ClaveDeSeccion, type Par } from '../shell/navTree'
import { seccionDeRuta } from '../shell/seccionActual'
import { useConteosDelProyecto } from './conteos'
import { useMisAsignaciones, useProyecto, vigenciaDeAsignacion } from './proyectos'

// el ProjectLayout de screens.md §2: dentro de un proyecto, la navegación local de Project 360 (las migas y el sello del proyecto
// van en la banda de contexto del shell, BarraDeContexto). con el alcance por proyecto (ADR-0029) solo llega aquí sin asignación quien lee
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
export type Pestana = (typeof PESTANAS)[number]
// la revisión de UX (decisión 2, ux-architecture.md §7.1): nueve pestañas a la vista y «Más» con las demás. Acuerdos no es
// pestaña: su pestaña es Compromisos, y las dos páginas se ofrecen en el selector de su cabecera (PaginasDeCompromisos). una sola
// fila de pestañas por pantalla (DD-03): las vistas de un módulo van en el selector de su lista, nunca en una segunda fila
const EN_MAS: readonly Pestana[] = ['tasks', 'ai-review', 'reports', 'settings']
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

// los íconos de la navegación local (design-system.md §5.2): los de las secciones del árbol, y el resumen y el mapa del proyecto
// (se busca al dibujar: navTree y las pantallas se importan en ciclo con este módulo)
const iconoDe = (p: Pestana): LucideIcon | undefined => {
  if (p === 'overview') return House
  if (p === 'map') return MapIcon
  const clave = SECCION_DE_PESTANA[p]
  return clave ? NAV_TREE.find((s) => s.clave === clave)?.icon : undefined
}

// las pestañas que la cuenta tiene en el proyecto y la marcada para la ruta: la navegación local y las migas de la banda de
// contexto (BarraDeContexto) dicen la misma
export function usePestanasDelProyecto(): { pestanas: Pestana[]; marcada: string } {
  const oferta = useOferta()
  const { pathname } = useLocation()
  const pestanas = PESTANAS.filter((p) => {
    const clave = SECCION_DE_PESTANA[p]
    return !clave || estadoDe(guardaDe(clave, PERMISOS_DE_PESTANA[p]), oferta) === 'disponible'
  })
  // la ficha de una queja vive en /grievances/:id y su pestaña es la de QCS: se marca esa y las migas la nombran
  const pestanaActual = pestanaDeSegmento(pathname.split('/')[3] ?? 'overview')
  return { pestanas, marcada: contenedoraDe(pestanaActual, pestanas) ?? pestanaActual }
}

// una vista es pestaña propia si la cuenta no tiene la pestaña que la contiene (lee acuerdos pero no compromisos)
function contenedoraDe(p: string, pestanas: readonly Pestana[]): Pestana | undefined {
  const de = PESTANA_DE_VISTA[p]
  return de && pestanas.includes(de) ? de : undefined
}

export function ProyectoLayout() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const proyecto = useProyecto(projectId)
  const asignaciones = useMisAsignaciones()
  const escribe = useEscribeEnProyecto(projectId)
  const { pathname } = useLocation()
  const { pestanas, marcada } = usePestanasDelProyecto()
  const seccion = seccionDeRuta(pathname)
  // D7: la pestaña (o la sección de la ruta, si no es una pestaña) y el proyecto en el título del documento
  useTituloDeDocumento(
    t(`contexto.pestanas.${pestanaDeSegmento(pathname.split('/')[3] ?? 'overview')}`, { defaultValue: '' }) || (seccion ? t(`secciones.${seccion}`) : ''),
    1
  )
  // solo sin datos: un refetch fallido (tras guardar o volver a la pestaña) no desmonta el Outlet ni pierde lo escrito
  if (proyecto.isError && !proyecto.data)
    return (
      <div className="space-y-3">
        {esIlegible(proyecto.error) ? <NoEsDeSusProyectos /> : <ErrorDeCarga error={proyecto.error} alReintentar={() => void proyecto.refetch()} />}
        <Link to="/projects" className="inline-block text-sm font-medium text-sg-primary-text">
          {t('contexto.irAProyectos')}
        </Link>
      </div>
    )
  return (
    // el proyecto ocupa todo el ancho de <main> (data-ancho: el shell no le pone márgenes): en el resumen, la banda del proyecto
    // arriba (CabeceraDelProyecto, S05 y T17); debajo, desde lg, la navegación local de 248 px pegada al borde izquierdo y a toda
    // la altura, y el contenido, que pone sus márgenes con ContenedorDePagina o, si la pantalla aún no lo usa, con el respaldo
    <div data-ancho="proyecto" className="flex min-h-full flex-col">
      {marcada === 'overview' && proyecto.data ? <CabeceraDelProyecto proyecto={proyecto.data} /> : null}
      <div className="flex flex-1 flex-col lg:flex-row">
        <NavegacionLocal projectId={projectId ?? ''} pestanas={pestanas} marcada={marcada} />
        <div className={cn('min-w-0 flex-1', MARGENES_DE_RESPALDO)}>
          {asignaciones.isSuccess && !escribe ? (
            <div className={MARGENES_DE_PAGINA}>
              <Alert tone="notice">{t('contexto.soloLectura')}</Alert>
            </div>
          ) : null}
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// la navegación local del proyecto (ux-architecture.md §7.1, design-system.md §5.2): una sola navegación con tres formas. desde
// lg, una columna de 248 px con las nueve secciones, el rótulo «Más» con las otras cuatro y la leyenda del punto; en tableta
// (md), una fila de pestañas de 48 px que se desplaza, con «Más» como desplegable que nombra la abierta si está ahí; en el
// teléfono, un botón con la sección abierta que despliega la misma lista. cada entrada lleva el total del alcance y, si pide
// acción, un punto danger con su número, dichos en la descripción del enlace: su nombre sigue siendo el de la sección
const ENTRADA = cn(
  'flex items-center gap-3 border-transparent whitespace-nowrap',
  'h-10 border-l-4 px-4',
  'md:h-12 md:gap-1.5 md:border-b-4 md:border-l-0 md:px-3',
  'lg:h-10 lg:gap-3 lg:border-b-0 lg:border-l-4 lg:pr-4 lg:pl-5 in-data-[density=compact]:lg:h-9'
)
const ACTIVA = 'border-sg-primary bg-sg-primary-soft font-bold text-sg-primary-text md:bg-transparent lg:bg-sg-primary-soft'
const REPOSO =
  'font-medium text-sg-text hover:bg-sg-surface-hover md:text-sg-text-secondary md:hover:bg-transparent md:hover:text-sg-text lg:text-sg-text lg:hover:bg-sg-surface-hover'
// las de «Más»: en tableta son las opciones de un desplegable
const ENTRADA_DE_MAS = cn(
  'flex h-10 items-center border-l-4 px-4 whitespace-nowrap',
  'md:h-auto md:rounded-sg-sm md:border-l-0 md:px-2.5 md:py-1.5',
  'lg:h-10 lg:rounded-none lg:border-l-4 lg:py-0 lg:pr-4 lg:pl-5 in-data-[density=compact]:lg:h-9'
)

function NavegacionLocal({ projectId, pestanas, marcada }: { projectId: string; pestanas: Pestana[]; marcada: string }) {
  const { t } = useTranslation(NS)
  const { pathname } = useLocation()
  const [desplegada, setDesplegada] = useState(false)
  const id = useId()
  useEffect(() => setDesplegada(false), [pathname])
  const base = `/projects/${encodeURIComponent(projectId)}`
  const visibles = pestanas.filter((p) => !EN_MAS.includes(p) && !contenedoraDe(p, pestanas))
  const enMas = pestanas.filter((p) => EN_MAS.includes(p))
  const corto = (p: Pestana) => (p === 'attention' ? t('seccionesCortas.attention') : '')
  const conteos = useConteosDelProyecto(projectId, visibles)
  // el total y lo que pide acción, dichos en la descripción del enlace: su nombre sigue siendo el de la pestaña
  const describir = (p: Pestana) => {
    const c = conteos[p]
    const partes = [
      c?.total != null ? t('contexto.conteos.total', { count: c.total }) : '',
      c?.accion ? t('contexto.conteos.vencidos', { count: c.accion }) : ''
    ]
    return partes.filter(Boolean).join(', ')
  }
  const nombreDe = (p: string) => t(`contexto.pestanas.${p}`, { defaultValue: '' }) || p
  return (
    // por debajo de lg, los márgenes de la página: en tableta la fila de pestañas va pegada a la banda; en el teléfono, el botón
    <nav
      aria-label={t('contexto.subnav')}
      className="shrink-0 px-4 pt-4 text-sg-body md:px-6 md:pt-0 lg:w-62 lg:border-r lg:border-sg-border lg:bg-sg-surface lg:px-0 lg:pt-4"
    >
      <div className="lg:sticky lg:top-0">
        {/* el teléfono: la sección abierta, y la lista entera a pedido */}
        <button
          type="button"
          aria-expanded={desplegada}
          aria-controls={`${id}-secciones`}
          onClick={() => setDesplegada((d) => !d)}
          className="flex h-12 w-full items-center justify-between gap-2 rounded-sg-md border-2 border-sg-border-control bg-sg-surface px-4 text-sg-body font-semibold md:hidden"
        >
          <span className="truncate">{t('contexto.seccionAbierta', { seccion: nombreDe(marcada) })}</span>
          <ChevronDown aria-hidden className={cn('size-5 shrink-0', desplegada && 'rotate-180')} />
        </button>
        <div
          id={`${id}-secciones`}
          className={cn(
            'max-md:mt-2 max-md:rounded-sg-md max-md:border max-md:border-sg-border max-md:bg-sg-surface max-md:py-2',
            'md:flex md:items-end md:border-b md:border-sg-border lg:block lg:border-b-0',
            !desplegada && 'max-md:hidden'
          )}
        >
          <PestanasDesplazables
            etiqueta={t('contexto.subnav')}
            rol="grupo"
            className="min-w-0 md:flex-1"
            filaClassName="flex flex-col md:flex-row md:gap-1 md:overflow-x-auto md:[scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible"
          >
            {visibles.map((p) => {
              const Icono = iconoDe(p)
              const c = conteos[p]
              return (
                <Link
                  key={p}
                  to={`${base}/${p}`}
                  aria-current={p === marcada ? 'page' : undefined}
                  aria-label={corto(p) ? nombreDe(p) : undefined}
                  aria-describedby={describir(p) ? `${id}-${p}` : undefined}
                  title={corto(p) ? nombreDe(p) : undefined}
                  className={cn(ENTRADA, p === marcada ? ACTIVA : REPOSO)}
                >
                  {Icono ? <Icono aria-hidden className="size-5 shrink-0 md:hidden lg:block" /> : null}
                  <span className="min-w-0 truncate">{corto(p) || nombreDe(p)}</span>
                  {c?.total != null ? (
                    <span aria-hidden className="ml-auto text-sg-body-sm font-bold text-sg-text-secondary tabular-nums md:ml-0 lg:ml-auto">
                      {c.total}
                    </span>
                  ) : null}
                  {c?.accion ? (
                    <span
                      aria-hidden
                      className={cn(
                        'inline-flex items-center gap-1 text-sg-body-sm font-extrabold text-sg-danger tabular-nums',
                        c.total == null && 'ml-auto md:ml-0 lg:ml-auto'
                      )}
                    >
                      <span className="size-2 rounded-full bg-sg-danger" />
                      {c.accion}
                    </span>
                  ) : null}
                  {describir(p) ? (
                    <span id={`${id}-${p}`} hidden>
                      {describir(p)}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </PestanasDesplazables>
          {enMas.length > 0 ? <MasSecciones base={base} pestanas={enMas} marcada={marcada} /> : null}
          <p aria-hidden className="px-4 pt-4 pb-2 text-sg-caption text-sg-text-secondary md:hidden lg:block lg:px-5">
            {t('contexto.leyenda')}
          </p>
        </div>
      </div>
    </nav>
  )
}

// «Más»: Tareas, Bandeja de IA, Reportes y Equipo y parámetros. en la columna y en el teléfono, un rótulo y su lista; en tableta,
// un desplegable cuyo botón nombra la abierta y queda marcado si es una de ellas
function MasSecciones({ base, pestanas, marcada }: { base: string; pestanas: readonly Pestana[]; marcada: string }) {
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
      className="relative md:shrink-0 lg:mt-2"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !abierto) return
        setAbierto(false)
        boton.current?.focus()
      }}
    >
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={`${id}-mas`}
        aria-label={nombre}
        aria-current={abierta ? 'page' : undefined}
        onClick={() => setAbierto((a) => !a)}
        className={cn(ENTRADA, 'hidden md:flex lg:hidden', abierta ? ACTIVA : REPOSO)}
      >
        {abierta ? t(`contexto.pestanas.${abierta}`) : t('shell.mas')}
        <ChevronDown aria-hidden className="size-3.5" />
      </button>
      <p aria-hidden className="px-4 pt-3 pb-1 text-sg-overline tracking-wide text-sg-text-secondary uppercase md:hidden lg:block lg:px-5">
        {t('contexto.mas')}
      </p>
      <div
        id={`${id}-mas`}
        role="group"
        aria-label={t('contexto.masPestanas')}
        className={cn(
          'flex flex-col',
          abierto
            ? 'md:absolute md:top-full md:right-0 md:z-30 md:mt-1 md:min-w-48 md:rounded-sg-md md:border-2 md:border-sg-border-strong md:bg-sg-surface-raised md:p-1 md:shadow-sg-overlay lg:static lg:mt-0 lg:min-w-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
            : 'md:hidden lg:flex'
        )}
      >
        {pestanas.map((p) => (
          <Link
            key={p}
            to={`${base}/${p}`}
            onClick={() => setAbierto(false)}
            aria-current={p === marcada ? 'page' : undefined}
            className={cn(
              ENTRADA_DE_MAS,
              p === marcada
                ? 'border-sg-primary bg-sg-primary-soft font-bold text-sg-primary-text'
                : 'border-transparent font-medium text-sg-text hover:bg-sg-surface-hover'
            )}
          >
            {t(`contexto.pestanas.${p}`)}
          </Link>
        ))}
      </div>
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

// la misma guarda para una lista con registros de varios proyectos (tomar varias tareas a la vez): dice, por proyecto, si la cuenta
// escribe en él
export function useEscribeEnProyectos(): (projectId: string | undefined) => boolean {
  const { isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const vigentes = new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(a.attributes.project)))
  return (projectId) => isAdmin || (projectId !== undefined && vigentes.has(projectId))
}
