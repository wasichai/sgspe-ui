import { useState } from 'react'
import { EstadoChip, SituacionDePlazo, TablaPriorizada } from 'sgspe-kit'

interface Riesgo {
  id: string
  codigo: string
  titulo: string
  estado: string
  nivel: string
  plazo: string
  proyecto: string
  responsable: string
  puntaje: number
}

const FILAS: Riesgo[] = [
  {
    id: 'r1',
    codigo: 'RSK-0031',
    titulo: 'Bloqueo de la vía de acceso por la comunidad de Huancapampa',
    estado: 'identified',
    nivel: 'Alto',
    plazo: 'VENCIDO',
    proyecto: 'Ampliación Norte',
    responsable: 'relacionista@sgspe.test',
    puntaje: 16
  },
  {
    id: 'r2',
    codigo: 'RSK-0027',
    titulo: 'Desacuerdo sobre el uso del agua del canal',
    estado: 'assessed',
    nivel: 'Medio',
    plazo: 'POR VENCER',
    proyecto: 'Ampliación Norte',
    responsable: 'coordinacion@sgspe.test',
    puntaje: 9
  },
  {
    id: 'r3',
    codigo: 'RSK-0019',
    titulo: 'Reclamo por el empleo local en la obra',
    estado: 'mitigating',
    nivel: 'Bajo',
    plazo: 'AL DIA',
    proyecto: 'Ampliación Norte',
    responsable: 'relacionista@sgspe.test',
    puntaje: 4
  }
]

const COLUMNAS = [
  { id: 'codigo', encabezado: 'Código', prioridad: 'esencial' as const, ordenable: true, claseDeCelda: 'font-sg-mono text-sg-caption' },
  { id: 'titulo', encabezado: 'Riesgo', prioridad: 'esencial' as const },
  { id: 'estado', encabezado: 'Estado', prioridad: 'esencial' as const },
  { id: 'nivel', encabezado: 'Nivel', prioridad: 'esencial' as const, ordenable: true },
  { id: 'puntaje', encabezado: 'Puntaje', prioridad: 'secundaria' as const, numerica: true, ordenable: true },
  { id: 'plazo', encabezado: 'Revisión', prioridad: 'secundaria' as const },
  { id: 'proyecto', encabezado: 'Proyecto', prioridad: 'opcional' as const },
  { id: 'responsable', encabezado: 'Responsable', prioridad: 'opcional' as const }
]

function celda(r: Riesgo, columna: string) {
  if (columna === 'estado') return <EstadoChip objeto="social_risk" estado={r.estado} />
  if (columna === 'plazo') return <SituacionDePlazo valor={r.plazo} />
  if (columna === 'titulo') return <span className="font-medium text-sg-primary-text">{r.titulo}</span>
  return String(r[columna as keyof Riesgo])
}

function Registro() {
  const [orden, setOrden] = useState<{ columna: string; dir: 'asc' | 'desc' }>({ columna: 'puntaje', dir: 'desc' })
  return (
    <TablaPriorizada
      etiqueta="Riesgos del proyecto"
      columnas={COLUMNAS}
      filas={FILAS}
      clave={(r) => r.id}
      celda={celda}
      valorPlano={(r, c) => String(r[c as keyof Riesgo])}
      ocultarUniformes
      orden={orden}
      alOrdenar={setOrden}
      alAbrir={() => {}}
    />
  )
}

export const ConColumnasYOrden = () => (
  <div className="p-4">
    <Registro />
  </div>
)
