import { useAvailableTransitions as useTransicionesDeWasichai, useWorkflow as useWorkflowDeWasichai, type Workflow } from '@wasichai/workflow'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// B-01 (U-42): desde wasichai 1.4.0 cada estado y cada transición traen su etiqueta por idioma en `labels`, y `label` (en
// español) queda de respaldo. los hooks de @wasichai/workflow entregan los dos; el portal los lee por aquí, con `label` y
// `toLabel` ya en el idioma activo, para que ninguna pantalla tenga que elegir (flujos.test.tsx vigila las importaciones)

// la etiqueta en el idioma activo, en su idioma base (en-US → en) o, si no está, el label de siempre
export function enIdioma(label: string, labels: Readonly<Record<string, string>> | undefined, idioma: string | undefined): string {
  if (!labels || !idioma) return label
  return labels[idioma] || labels[idioma.split('-')[0]] || label
}

function useIdioma(): string | undefined {
  const { i18n } = useTranslation()
  return i18n.resolvedLanguage ?? i18n.language
}

// el workflow de un objeto (GET /api/objects/{object}/workflow) con sus estados y transiciones en el idioma activo
export function useWorkflow(objeto: string | undefined) {
  const consulta = useWorkflowDeWasichai(objeto)
  const idioma = useIdioma()
  const data = useMemo((): Workflow | undefined => {
    if (!consulta.data) return undefined
    const { states, transitions } = consulta.data.definition
    return {
      ...consulta.data,
      definition: {
        ...consulta.data.definition,
        states: states.map((s) => ({ ...s, label: enIdioma(s.label, s.labels, idioma) })),
        transitions: transitions.map((t) => ({ ...t, label: enIdioma(t.label, t.labels, idioma) }))
      }
    }
  }, [consulta.data, idioma])
  // la misma forma y el mismo tipo: data está definida justo cuando lo está la de wasichai, así que isPending, isError y
  // isSuccess siguen acotándola
  return { ...consulta, data } as typeof consulta
}

// las transiciones disponibles de un registro, con la acción y el estado destino en el idioma activo
export function useAvailableTransitions(objeto: string, registro: string) {
  const consulta = useTransicionesDeWasichai(objeto, registro)
  const idioma = useIdioma()
  const data = useMemo(
    () => consulta.data?.map((t) => ({ ...t, label: enIdioma(t.label, t.labels, idioma), toLabel: enIdioma(t.toLabel, t.toLabels, idioma) })),
    [consulta.data, idioma]
  )
  return { ...consulta, data } as typeof consulta
}
