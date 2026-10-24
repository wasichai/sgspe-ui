import { useWorkflow } from '../datos/flujos'
import { cn } from '@wasichai/ui'
import { aparienciaDe, CLASE_DE_TONO } from './apariencias'

// el StatusBadge de design-system.md §9: el estado de workflow con su tono, su ícono y la etiqueta de la metadata
// (GET /api/objects/{object}/workflow, de @wasichai/workflow); mientras no llega, el nombre técnico
export function EstadoChip({ objeto, estado }: { objeto: string; estado: string | null | undefined }) {
  const workflow = useWorkflow(objeto)
  if (!estado) return null
  const etiqueta = workflow.data?.definition.states.find((s) => s.name === estado)?.label ?? estado
  return <ChipDeEstado objeto={objeto} estado={estado} etiqueta={etiqueta} />
}

// el mismo chip para un estado que no es de workflow (el de generación de una presentación), con la etiqueta que da la pantalla
export function ChipDeEstado({ objeto, estado, etiqueta }: { objeto: string; estado: string; etiqueta: string }) {
  const { tono, Icono } = aparienciaDe(objeto, estado)
  return (
    <span
      data-estado={estado}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-sg-sm px-2 py-0.5 text-sg-caption font-medium', CLASE_DE_TONO[tono])}
    >
      <Icono aria-hidden className="size-3.5" />
      {etiqueta}
    </span>
  )
}

// las etiquetas de los estados de un workflow, para filtros y pasos
export function useEtiquetasDeEstado(objeto: string): Record<string, string> {
  const workflow = useWorkflow(objeto)
  return Object.fromEntries((workflow.data?.definition.states ?? []).map((s) => [s.name, s.label]))
}
