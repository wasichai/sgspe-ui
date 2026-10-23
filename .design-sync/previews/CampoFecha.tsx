import { useState } from 'react'
import { CampoFecha } from 'sgspe-kit'

function Dia({
  inicial,
  ...props
}: {
  inicial: string | null
  etiqueta: string
  ayuda?: string
  requerido?: boolean
  min?: string
  max?: string
  error?: string
}) {
  const [valor, setValor] = useState<string | null>(inicial)
  return <CampoFecha valor={valor} alCambiar={setValor} {...props} />
}

function ConHora() {
  const [valor, setValor] = useState<string | null>('2026-10-23T09:30')
  return <CampoFecha conHora valor={valor} alCambiar={setValor} etiqueta="Inicio de la reunión" ayuda="Hora de Lima, de 24 horas." />
}

export const Formulario = () => (
  <div className="max-w-md space-y-4 p-4">
    <Dia inicial="2026-11-15" etiqueta="Fecha comprometida" ayuda="Día en que la organización se compromete a cumplir." requerido />
    <ConHora />
    <Dia inicial={null} etiqueta="Fecha de la entrega" error="Indique la fecha de la entrega." requerido />
    <CampoFecha valor="2026-09-30" alCambiar={() => {}} etiqueta="Fecha de registro" deshabilitado />
  </div>
)
