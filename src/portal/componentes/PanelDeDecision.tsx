import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { Dia } from './Dia'
import { EstadoChip } from './EstadoChip'
import { Persona } from './Persona'
import { SituacionDePlazo } from './SituacionDePlazo'

// el panel de decisión de design-system.md §6.1: cuatro tarjetas fijas que responden sin buscar. la siguiente acción la
// decide cada ficha con una función pura (siguienteAccion, por objeto) que dice también lo que falta para darla. lo que no
// llegó (desde cuándo, quién) se dice «—»: de dónde se lee se resuelve con cada ficha
export interface SiguienteAccion {
  etiqueta: string
  // lo que falta para darla («al menos un solicitante»)
  falta?: string
}

export function PanelDeDecision({
  objeto,
  estado,
  desde,
  por,
  siguiente,
  responsable,
  vencimiento,
  situacion
}: {
  objeto: string
  estado: string | null | undefined
  desde?: string | null
  por?: string | null
  siguiente: SiguienteAccion | null
  responsable: string | null | undefined
  vencimiento: string | null | undefined
  // deadline_status del registro (JOB-01)
  situacion?: unknown
}) {
  const { t } = useTranslation(NS)
  return (
    <section aria-label={t('paginas.decision.titulo')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta titulo={t('paginas.decision.estado')}>
        <EstadoChip objeto={objeto} estado={estado} />
        <p className="text-sg-caption text-sg-text-muted">
          {t('paginas.decision.desde')} <Dia valor={desde} />
        </p>
        {por ? (
          <p className="text-sg-caption text-sg-text-muted">
            {t('paginas.decision.por')} <Persona correo={por} />
          </p>
        ) : null}
      </Tarjeta>
      <Tarjeta titulo={t('paginas.decision.siguiente')}>
        {siguiente ? (
          <>
            <p className="font-medium">{siguiente.etiqueta}</p>
            {siguiente.falta ? <p className="text-sg-caption text-sg-text-secondary">{t('paginas.decision.falta', { que: siguiente.falta })}</p> : null}
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
            <SituacionDePlazo valor={situacion} />
          </div>
        ) : (
          <p className="text-sg-text-muted">{t('paginas.decision.sinVencimiento')}</p>
        )}
      </Tarjeta>
    </section>
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
