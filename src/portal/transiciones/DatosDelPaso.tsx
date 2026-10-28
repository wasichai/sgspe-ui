import { useAuth, type FieldMeta } from '@wasichai/core'
import { Input, Textarea } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { esCompletable } from '../componentes/CompletarCampo'
import { ahoraEnLima, instanteDeLima } from '../datos/fechas'
import { campoDe, useDefinicion } from '../datos/registros'
import { NS } from '../i18n'
import type { Aviso } from './api'

// tercera pasada de UX (1.2): los datos que un paso exige se piden en su diálogo, con el mismo motivo, en vez de «Editar» (17
// campos y su motivo) y después la transición (otro motivo). un FIELD_REQUIRED de transition-checks (las reglas de SGSPE dicen
// todos los que faltan a la vez) sobre uno de esos campos, si quien mira puede escribirlo, no bloquea el botón: el diálogo lo pide,
// lo guarda con useActualizar (If-Match) y aplica la transición sobre la versión nueva. lo demás bloquea como siempre, con el texto
// de su regla, y lo que es un campo se completa en la ficha (CompletarCampo)
//
// los datos del propio paso: la clasificación al atender una queja, la resolución y la respuesta, cuándo se comunicó, la decisión de
// tratamiento y el motivo de cierre de un riesgo, la fecha de una interacción y el motivo de su cancelación, las fechas de firma y de
// vigencia de un acuerdo. no van los que cambian qué reglas se evalúan (el tipo de un aporte decide sus lineamientos, que «Antes de
// aprobar» muestra) ni los de la matriz de un compromiso, que se completan uno a uno en su ficha
export const PEDIDOS_EN_EL_DIALOGO: Readonly<Record<string, readonly string[]>> = {
  grievance: ['category', 'severity', 'resolution', 'response', 'responded_at'],
  inquiry: ['response', 'responded_at'],
  stakeholder_request: ['response', 'responded_at'],
  social_risk: ['treatment_decision', 'close_reason'],
  engagement: ['scheduled_at', 'held_at', 'cancel_reason'],
  agreement: ['signed_date', 'effective_date']
}

// los controles simples que el diálogo dibuja
const TIPOS_DEL_DIALOGO: ReadonlySet<string> = new Set(['TEXT', 'LONG_TEXT', 'EMAIL', 'ENUM', 'DATE', 'DATETIME', 'BOOLEAN'])

// una fecha con hora que se propone con la de ahora (cuándo se comunicó la respuesta, cuándo ocurrió la interacción); la de una
// interacción que se programa la elige la persona
const CON_LA_HORA_DE_AHORA: ReadonlySet<string> = new Set(['responded_at', 'held_at'])

export interface BloqueosDelPaso {
  // los campos que el diálogo pide, sin repetir
  pedidos: FieldMeta[]
  // lo demás que bloquea
  otros: Aviso[]
}

export function useBloqueosDelPaso(objeto: string, bloqueos: readonly Aviso[]): BloqueosDelPaso {
  const { can } = useAuth()
  const definicion = useDefinicion(objeto)
  const escribe = can(objeto, 'UPDATE')
  const pedidos: FieldMeta[] = []
  const otros: Aviso[] = []
  for (const b of bloqueos) {
    const campo =
      escribe && b.code === 'FIELD_REQUIRED' && b.field && PEDIDOS_EN_EL_DIALOGO[objeto]?.includes(b.field) ? campoDe(definicion.data, b.field) : undefined
    if (campo && TIPOS_DEL_DIALOGO.has(campo.type) && esCompletable(objeto, definicion.data, campo.name)) {
      if (!pedidos.some((p) => p.name === campo.name)) pedidos.push(campo)
    } else otros.push(b)
  }
  return { pedidos, otros }
}

// el valor con que se abre el control: el guardado si lo hay (una decisión de tratamiento que no es la que el paso pide) y, en una
// fecha con hora de CON_LA_HORA_DE_AHORA (falta porque está vacía), la hora de Lima de ahora, que se puede cambiar
export function valorInicial(campo: FieldMeta, guardado: unknown): string {
  if (campo.type === 'DATETIME') return CON_LA_HORA_DE_AHORA.has(campo.name) ? ahoraEnLima() : ''
  if (typeof guardado === 'boolean') return String(guardado)
  if (typeof guardado !== 'string') return ''
  return campo.type === 'DATE' ? guardado.slice(0, 10) : guardado
}

export const datoVacio = (campo: FieldMeta, valor: string): boolean => (campo.type === 'DATETIME' ? instanteDeLima(valor) === '' : valor.trim() === '')

export function valorParaEnviar(campo: FieldMeta, valor: string): unknown {
  if (campo.type === 'BOOLEAN') return valor === 'true'
  if (campo.type === 'DATETIME') return instanteDeLima(valor)
  return valor.trim()
}

export function DatoDelPaso({
  campo,
  valor,
  alCambiar,
  error,
  ayuda
}: {
  campo: FieldMeta
  valor: string
  alCambiar: (valor: string) => void
  error?: string
  // lo que el paso espera de ese dato (transiciones.ayudasDelPaso)
  ayuda?: string
}) {
  const { t } = useTranslation(NS)
  const etiqueta = t('transiciones.datoObligatorio', { campo: campo.label || campo.name })
  if (campo.type === 'DATE' || campo.type === 'DATETIME')
    return (
      <CampoFecha
        etiqueta={etiqueta}
        conHora={campo.type === 'DATETIME'}
        valor={valor || null}
        alCambiar={(v) => alCambiar(v ?? '')}
        requerido
        error={error}
        ayuda={ayuda}
      />
    )
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      {(p) =>
        campo.type === 'ENUM' ? (
          <SelectNativo {...p} value={valor} onChange={(e) => alCambiar(e.target.value)} opciones={campo.enumOptions ?? []} />
        ) : campo.type === 'BOOLEAN' ? (
          <SelectNativo
            {...p}
            value={valor}
            onChange={(e) => alCambiar(e.target.value)}
            opciones={[
              { valor: 'true', etiqueta: t('comun.si') },
              { valor: 'false', etiqueta: t('comun.no') }
            ]}
          />
        ) : campo.type === 'LONG_TEXT' ? (
          <Textarea {...p} rows={3} value={valor} onChange={(e) => alCambiar(e.target.value)} />
        ) : (
          <Input {...p} type={campo.type === 'EMAIL' ? 'email' : 'text'} value={valor} onChange={(e) => alCambiar(e.target.value)} />
        )
      }
    </Campo>
  )
}
