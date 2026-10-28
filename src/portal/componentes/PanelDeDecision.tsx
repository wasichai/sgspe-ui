import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { CaminoDelFlujo } from './CaminoDelFlujo'
import { Dia } from './Dia'
import { EstadoChip } from './EstadoChip'
import { Persona } from './Persona'
import { SituacionDePlazo } from './SituacionDePlazo'

// el panel de decisión de design-system.md §6.1: cuatro tarjetas fijas que responden sin buscar. la siguiente acción la
// decide cada ficha con una función pura (siguienteAccion, por objeto) que dice también lo que falta para darla. lo que no
// llegó (desde cuándo, quién) no se dibuja: de dónde se lee se resuelve con cada ficha. el panel es el único lugar del
// estado de la ficha (DD-06): el camino del flujo, si la ficha lo da, va plegado dentro de «Estado actual»
export interface SiguienteAccion {
  etiqueta: string
  // lo que falta para darla, en el texto de la regla que la bloquea («Falta una entrega con conformidad»)
  falta?: string
  // el campo del registro que la bloquea y que quien mira puede completar (CompletarCampo, en la cabecera de la ficha)
  campo?: string
}

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
  tipoDeSituacion = 'plazo'
}: {
  objeto: string
  estado: string | null | undefined
  // el camino del flujo que da la ficha (el de CaminoDelFlujo); sin él no se ofrece «Ver el camino»
  camino?: string[]
  desde?: string | null
  por?: string | null
  siguiente: SiguienteAccion | null
  responsable: string | null | undefined
  vencimiento: string | null | undefined
  // deadline_status del registro (JOB-01), o review_status de un riesgo y validity_status de un acuerdo
  situacion?: unknown
  tipoDeSituacion?: 'plazo' | 'revision' | 'vigencia'
}) {
  const { t } = useTranslation(NS)
  return (
    <section aria-label={t('paginas.decision.titulo')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta titulo={t('paginas.decision.estado')}>
        <EstadoChip objeto={objeto} estado={estado} />
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
            <p className="font-medium">{siguiente.etiqueta}</p>
            {siguiente.falta ? <p className="text-sg-caption text-sg-warning">{siguiente.falta}</p> : null}
          </>
        ) : (
          <p className="text-sg-text-muted">{t('paginas.decision.sinSiguiente')}</p>
        )}
      </Tarjeta>
      <Tarjeta titulo={t('paginas.decision.responsable')}>
        {responsable ? <Persona correo={responsable} /> : <p className="text-sg-text-muted">{t('paginas.decision.sinResponsable')}</p>}
      </Tarjeta>
      <Tarjeta titulo={t('paginas.decision.vencimiento')}>
        {vencimiento ? (
          <div className="flex flex-wrap items-center gap-2">
            <Dia valor={vencimiento} />
            <SituacionDePlazo valor={situacion} revision={tipoDeSituacion === 'revision'} vigencia={tipoDeSituacion === 'vigencia'} />
          </div>
        ) : (
          <p className="text-sg-text-muted">{t('paginas.decision.sinVencimiento')}</p>
        )}
      </Tarjeta>
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
    <div role="group" aria-label={titulo} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">{titulo}</p>
      {children}
    </div>
  )
}
