import { useWorkflow } from '../datos/flujos'
import { aparienciaDe, CLASE_DE_CHIP, CLASE_DE_TONO } from './apariencias'
import { unir } from './clases'

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
    <span data-estado={estado} className={unir(CLASE_DE_CHIP, CLASE_DE_TONO[tono])}>
      <Icono aria-hidden className="size-3.5" />
      {etiqueta}
    </span>
  )
}

// las etiquetas de los estados de un workflow, para filtros y pasos; sin objeto (la cuenta no lo lee) no se pide nada
export function useEtiquetasDeEstado(objeto: string | undefined): Record<string, string> {
  const workflow = useWorkflow(objeto)
  return Object.fromEntries((workflow.data?.definition.states ?? []).map((s) => [s.name, s.label]))
}
