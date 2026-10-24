import { SituacionDePlazo } from 'sgspe-kit'

export const Plazos = () => (
  <div className="flex flex-wrap gap-2 p-4">
    <SituacionDePlazo valor="AL DIA" />
    <SituacionDePlazo valor="POR VENCER" />
    <SituacionDePlazo valor="VENCIDO" />
  </div>
)

export const RevisionYVigencia = () => (
  <div className="flex flex-wrap gap-2 p-4">
    <SituacionDePlazo valor="POR REVISAR" revision />
    <SituacionDePlazo valor="REVISION VENCIDA" revision />
    <SituacionDePlazo valor="VIGENTE" vigencia />
  </div>
)
