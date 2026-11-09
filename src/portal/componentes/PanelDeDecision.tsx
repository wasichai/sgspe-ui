import { useAuth } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { useWorkflow } from '../datos/flujos'
import { NS } from '../i18n'
import { CaminoDelFlujo } from './CaminoDelFlujo'
import { CuandoVence } from './CuandoVence'
import { Dia } from './Dia'
import { EstadoChip } from './EstadoChip'
import { Persona } from './Persona'
import { SituacionDePlazo } from './SituacionDePlazo'

// el panel de decisión de design-system.md §6.1: cuatro tarjetas fijas que responden sin buscar. la siguiente acción la
// decide cada ficha con una función pura (siguienteAccion, por objeto) que dice también lo que falta para darla. lo que no
// llegó (desde cuándo, quién) no se dibuja: de dónde se lee se resuelve con cada ficha. el panel es el único lugar del
// estado de la ficha (DD-06): el camino del flujo, si la ficha lo da, va plegado dentro de «Estado actual». la siguiente acción dice
// a quién le toca (tercera pasada de UX, 1.4): a quien mira, si está asignado al proyecto; si no, que no lo está; sin una acción
// suya, que el paso lo da otra persona. «Nada pendiente» queda para un estado final
export interface SiguienteAccion {
  etiqueta: string
  // lo que falta para darla, en el texto de la regla que la bloquea («Falta una entrega con conformidad»)
  falta?: string
  // el campo del registro que la bloquea y que quien mira puede completar (CompletarCampo, en la cabecera de la ficha)
  campo?: string
  // las etiquetas de los datos que su diálogo pedirá (no la bloquean: se piden al darla)
  pide?: string[]
}

// la rejilla de design-system.md §5.3: una celda por tarjeta dibujada en una sola fila cuando el panel es ancho, y dos por dos
// en lo estrecho (el teléfono, la tableta y la vista previa acoplada de 420 px): se mide el panel (consulta de contenedor), no la
// ventana. clases enteras, para que Tailwind las vea
const COLUMNAS: Record<number, string> = { 2: '@3xl:grid-cols-2', 3: '@3xl:grid-cols-3', 4: '@3xl:grid-cols-4' }

export function PanelDeDecision({
  objeto,
  estado,
  camino,
  desde,
  por,
  siguiente,
  responsable,
  vencimiento,
  situacion,
  tipoDeSituacion = 'plazo',
  vencimientoEnHabiles = false,
  proyecto
}: {
  objeto: string
  estado: string | null | undefined
  // el camino del flujo que da la ficha (el de CaminoDelFlujo); sin él no se ofrece «Ver el camino»
  camino?: string[]
  desde?: string | null
  por?: string | null
  siguiente: SiguienteAccion | null
  // el responsable y el vencimiento: null es un dato vacío («Sin responsable», que importa); sin la prop (el objeto no tiene
  // responsable ni plazo: un aporte, un incidente) la tarjeta no se dibuja (tercera pasada de UX, 1.8)
  responsable?: string | null
  vencimiento?: string | null
  // deadline_status del registro (JOB-01), o review_status de un riesgo y validity_status de un acuerdo
  situacion?: unknown
  tipoDeSituacion?: 'plazo' | 'revision' | 'vigencia'
  // el vencimiento se cuenta en días hábiles (el acuse de una queja): el relativo también
  vencimientoEnHabiles?: boolean
  // el proyecto del registro: con él se dice si la siguiente acción le toca a quien mira
  proyecto?: string
}) {
  const { t, i18n } = useTranslation(NS)
  const lista = new Intl.ListFormat(i18n.language, { type: 'conjunction' })
  const { isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(proyecto)
  const workflow = useWorkflow(objeto)
  // mientras no se sabe (las asignaciones o el workflow no llegaron), no se dice nada: ni «Le toca a usted» ni «Nada pendiente»
  const aQuien = proyecto === undefined || (!isAdmin && !asignaciones.isSuccess) ? null : isAdmin || asignado ? 'leToca' : 'noAsignado'
  const tipoDelEstado = workflow.data?.definition.states.find((s) => s.name === estado)?.type
  return (
    <section aria-label={t('paginas.decision.titulo')} className="@container">
      {/* los separadores de 1 px son el borde derecho e inferior de cada celda; la caja recorta los del borde (margen de -1 px) */}
      <div
        data-rejilla-de-decision
        className={cn(
          'grid grid-cols-2 overflow-hidden rounded-sg-md border-2 border-sg-border-strong bg-sg-surface',
          COLUMNAS[2 + Number(responsable !== undefined) + Number(vencimiento !== undefined)]
        )}
      >
        <Tarjeta titulo={t('paginas.decision.estado')}>
          {/* un estado largo se parte en líneas dentro de su celda en lugar de salirse (S31) */}
          <div className="[&>[data-estado]]:h-auto [&>[data-estado]]:min-h-6.5 [&>[data-estado]]:max-w-full [&>[data-estado]]:whitespace-normal [&>[data-estado]]:py-1 [&>[data-estado]]:leading-tight [&>[data-estado]>svg]:shrink-0">
            <EstadoChip objeto={objeto} estado={estado} />
          </div>
          {/* sin la fecha (un registro anterior a state_changed_at) no se dibuja: «Desde —» no decía nada (rediseño de UX, 2026-10-20) */}
          {desde ? (
            <p className="text-sg-caption text-sg-text-muted">
              {t('paginas.decision.desde')} <Dia valor={desde} />
            </p>
          ) : null}
          {por ? (
            <p className="text-sg-caption text-sg-text-muted">
              {t('paginas.decision.por')} <Persona correo={por} />
            </p>
          ) : null}
          {camino ? <CaminoPlegado objeto={objeto} estado={estado} camino={camino} /> : null}
        </Tarjeta>
        <Tarjeta titulo={t('paginas.decision.siguiente')}>
          {siguiente ? (
            <>
              <p className="font-bold text-sg-text">{siguiente.etiqueta}</p>
              {aQuien ? <p className="text-sg-caption text-sg-text-muted">{t(`paginas.decision.${aQuien}`)}</p> : null}
              {siguiente.falta ? <p className="text-sg-caption text-sg-warning">{siguiente.falta}</p> : null}
              {siguiente.pide ? (
                <p className="text-sg-caption text-sg-text-muted">
                  {t('paginas.decision.pide', { count: siguiente.pide.length, campos: lista.format(siguiente.pide.map((c) => `«${c}»`)) })}
                </p>
              ) : null}
            </>
          ) : workflow.data ? (
            <p className="text-sg-text-muted">{t(tipoDelEstado === 'FINAL' ? 'paginas.decision.sinSiguiente' : 'paginas.decision.deOtraPersona')}</p>
          ) : null}
        </Tarjeta>
        {responsable !== undefined ? (
          <Tarjeta titulo={t('paginas.decision.responsable')}>
            {responsable ? <Persona correo={responsable} /> : <p className="text-sg-text-muted">{t('paginas.decision.sinResponsable')}</p>}
          </Tarjeta>
        ) : null}
        {vencimiento !== undefined ? (
          <Tarjeta titulo={t('paginas.decision.vencimiento')}>
            {vencimiento ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span data-vencimiento className={situacion === 'VENCIDO' ? 'font-bold text-sg-danger' : 'font-bold text-sg-text'}>
                    <Dia valor={vencimiento} />
                  </span>
                  <SituacionDePlazo valor={situacion} revision={tipoDeSituacion === 'revision'} vigencia={tipoDeSituacion === 'vigencia'} />
                </div>
                {/* el relativo, solo mientras el plazo corre: JOB-01 deja la situación vacía fuera de esos estados (un compromiso cumplido
                no «venció hace 40 días») */}
                {typeof situacion === 'string' && situacion !== '' ? (
                  <CuandoVence dia={vencimiento} habiles={vencimientoEnHabiles} className="block text-sg-caption text-sg-text-muted" />
                ) : null}
              </>
            ) : (
              <p className="text-sg-text-muted">{t('paginas.decision.sinVencimiento')}</p>
            )}
          </Tarjeta>
        ) : null}
      </div>
    </section>
  )
}

function CaminoPlegado({ objeto, estado, camino }: { objeto: string; estado: string | null | undefined; camino: string[] }) {
  const { t } = useTranslation(NS)
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  return (
    <div className="pt-1">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className="inline-flex items-center gap-1 rounded-sg-sm text-sg-caption font-medium text-sg-primary-text hover:underline"
      >
        <ChevronDown aria-hidden className={abierto ? 'size-3.5 rotate-180' : 'size-3.5'} />
        {t('paginas.decision.verCamino')}
      </button>
      <div id={id} hidden={!abierto} className="pt-2">
        {abierto ? <CaminoDelFlujo objeto={objeto} estado={estado} camino={camino} /> : null}
      </div>
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="-mr-px -mb-px min-w-0 space-y-1 border-r border-b border-sg-border px-4 py-3 text-sm">
      <p className="text-sg-body-sm text-sg-text-secondary">{titulo}</p>
      {children}
    </div>
  )
}
