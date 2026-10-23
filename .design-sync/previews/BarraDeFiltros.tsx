import { useState } from 'react'
import { BarraDeFiltros, FiltroDeLista, SelectorDeVista } from 'sgspe-kit'

const ESTADOS = [
  { valor: 'in_progress', etiqueta: 'En ejecución' },
  { valor: 'blocked', etiqueta: 'Bloqueado' },
  { valor: 'fulfilled', etiqueta: 'Cumplido' }
]

function Barra({ conFiltros }: { conFiltros: boolean }) {
  const [vista, setVista] = useState('activos')
  const [q, setQ] = useState(conFiltros ? 'canal' : '')
  const [estado, setEstado] = useState(conFiltros ? 'in_progress' : '')
  const aplicados = [
    ...(q ? [{ clave: 'q', etiqueta: `Texto: ${q}`, alQuitar: () => setQ('') }] : []),
    ...(estado ? [{ clave: 'state', etiqueta: `Estado: ${ESTADOS.find((e) => e.valor === estado)?.etiqueta}`, alQuitar: () => setEstado('') }] : [])
  ]
  return (
    <BarraDeFiltros
      vista={
        <SelectorDeVista
          etiqueta="Vistas"
          actual={vista}
          alElegir={setVista}
          vistas={[
            { id: 'activos', etiqueta: 'Activos', n: 96 },
            { id: 'mios', etiqueta: 'Míos', n: 14 },
            { id: 'vencidos', etiqueta: 'Vencidos', n: 7 },
            { id: 'cerrados', etiqueta: 'Cerrados', n: 32 }
          ]}
        />
      }
      busqueda={{ etiqueta: 'Buscar compromiso', valor: q, alCambiar: setQ }}
      frecuentes={<FiltroDeLista etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} opciones={ESTADOS} />}
      todos={<FiltroDeLista etiqueta="Tipo de recurso" opciones={[{ valor: 'infra', etiqueta: 'Infraestructura' }]} />}
      aplicados={aplicados}
      alLimpiar={() => {
        setQ('')
        setEstado('')
      }}
    />
  )
}

export const ListaDeCompromisos = () => (
  <div className="space-y-8 p-4">
    <Barra conFiltros />
    <Barra conFiltros={false} />
  </div>
)
