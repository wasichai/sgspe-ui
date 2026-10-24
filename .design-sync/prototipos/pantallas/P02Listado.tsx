// P-02 · listado con filtros: una fila de pestañas, selector de vista con conteos, filtros con chips y tabla priorizada
import { Button, EstadoChip, ListaEnTarjetas, Monto, Pagination, SituacionDePlazo, Table, Td, Th } from '../../kit/index'
import { Eye, Plus } from 'lucide-react'
import { useL } from '../idioma'
import { Marco, MigasDelProyecto, PestanasDelProyecto } from '../marco'
import { BarraDeFiltros, SelectorDeVista } from '../piezas'

export function P02() {
  const l = useL()
  const filas = [
    [
      'DEMO-C-03',
      l('Segundo monitoreo participativo de agua en la época seca', 'Second participatory water monitoring in the dry season'),
      'in_progress',
      'POR VENCER',
      '2026-10-31',
      '8000',
      'Comité de agua de Ccollpa'
    ],
    [
      'DEMO-C-07',
      l('Entrega por escrito de los resultados del muestreo de junio', 'Written delivery of the June sampling results'),
      'approved',
      'POR VENCER',
      '2026-10-30',
      '1200',
      'JASS de Huaylla Alto'
    ],
    [
      'DEMO-C-06',
      l('Implementos para el comité de vigilancia de la perforación', 'Equipment for the drilling oversight committee'),
      'approved',
      'AL DIA',
      '2026-10-30',
      '3600',
      'Comité de vigilancia'
    ],
    [
      'DEMO-C-05',
      l('Capacitación en seguridad para la mano de obra local de Pucará Chico', 'Safety training for local workers in Pucará Chico'),
      'approved',
      'AL DIA',
      '2026-10-30',
      '2400',
      'Sector Pucará Chico'
    ],
    [
      'DEMO-C-04',
      l('Cemento para el revestimiento de un tramo del canal Yanaccocha', 'Cement to line a stretch of the Yanaccocha canal'),
      'blocked',
      'VENCIDO',
      '2026-09-15',
      '6500',
      'Comité de regantes'
    ],
    [
      'DEMO-C-01',
      l('Señalización de la trocha en el tramo de la escuela de Tambillo', 'Road signs by the Tambillo school'),
      'in_progress',
      'AL DIA',
      '2026-11-15',
      '9500',
      'APAFA de Tambillo'
    ],
    [
      'DEMO-C-12',
      l('Reunión informativa en el distrito con la dirección regional de energía y minas', 'Briefing with the regional energy and mines office'),
      'draft',
      '',
      '2026-11-05',
      '1500',
      'Municipalidad distrital'
    ]
  ]
  return (
    <Marco activa="compromisos" proyecto="DEMO-T1 · Proyecto Wayra Ejemplo" persona="Gestión de compromisos (demo)" insignias={{ compromisos: 1 }}>
      <MigasDelProyecto modulo={l('Compromisos', 'Commitments')} />
      <PestanasDelProyecto
        activa="commitments"
        conteos={{ stakeholders: [85], engagements: [100], commitments: [12, 1], attention: [11, 3], risks: [5], programs: [1], documents: [4] }}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Compromisos', 'Commitments')}</h1>
          <p className="text-sg-body-sm text-sg-text-secondary">{l('7 de 11 abiertos · filtrados', '7 of 11 open · filtered')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden md:inline-flex">
            <SelectorDeVista
              etiqueta={l('Presentación', 'Layout')}
              actual="lista"
              vistas={[
                { id: 'lista', etiqueta: l('Lista', 'List') },
                { id: 'tablero', etiqueta: l('Tablero', 'Board') }
              ]}
            />
          </span>
          <span className="hidden md:inline-flex">
            <Button size="sm" variant="secondary">
              {l('Exportar', 'Export')}
            </Button>
          </span>
          <Button>
            <Plus aria-hidden className="mr-1 size-4" />
            {l('Nuevo compromiso', 'New commitment')}
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <BarraDeFiltros
          vista={
            <SelectorDeVista
              etiqueta={l('Vista', 'View')}
              actual="abiertos"
              vistas={[
                { id: 'abiertos', etiqueta: l('Abiertos', 'Open'), n: 11 },
                { id: 'vencidos', etiqueta: l('Vencidos', 'Overdue'), n: 1 },
                { id: 'porvencer', etiqueta: l('Por vencer', 'Due soon'), n: 2 },
                { id: 'mios', etiqueta: l('Míos', 'Mine'), n: 0 },
                { id: 'mas', etiqueta: l('Más vistas ▾', 'More views ▾') }
              ]}
            />
          }
          busqueda={l('Código o título', 'Code or title')}
          filtros={[
            { etiqueta: l('Estado', 'Status'), valor: l('Todos', 'All') },
            { etiqueta: l('Responsable', 'Owner'), valor: l('Todos', 'All') }
          ]}
          aplicados={[l('Campaña: perforación 2026', 'Campaign: 2026 drilling'), l('Tema: agua', 'Topic: water')]}
          masFiltros={l('Más filtros', 'More filters')}
          limpiar={l('Limpiar filtros', 'Clear filters')}
        />
      </div>
      <div className="mt-3 md:hidden">
        <ListaEnTarjetas
          etiqueta={l('Compromisos', 'Commitments')}
          tarjetas={filas.map(([codigo, titulo, estado, plazo, , monto, para]) => ({
            id: codigo,
            titulo: <a className="font-medium">{titulo}</a>,
            estado: <EstadoChip objeto="commitment" estado={estado} />,
            plazo: <SituacionDePlazo valor={plazo} />,
            detalle: (
              <>
                {codigo} · {para} · <Monto valor={monto} moneda="PEN" />
              </>
            )
          }))}
        />
      </div>
      <div className="mt-3 hidden overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface md:block">
        <Table>
          <thead>
            <tr>
              <Th aria-sort="none">{l('Compromiso', 'Commitment')}</Th>
              <Th>{l('Para', 'For')}</Th>
              <Th>{l('Estado', 'Status')}</Th>
              <Th aria-sort="ascending">{l('Vence ↑', 'Due ↑')}</Th>
              <Th className="text-right">{l('Monto', 'Amount')}</Th>
              <Th>
                <span className="sr-only">{l('Acciones', 'Actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([codigo, titulo, estado, plazo, vence, monto, para], i) => (
              <tr key={codigo} className={i === 1 ? 'bg-sg-surface-hover' : ''}>
                <Td className="max-w-[28rem]">
                  <a className="block truncate font-medium text-sg-text hover:text-sg-primary-text">{titulo}</a>
                  <span className="font-sg-mono text-sg-caption text-sg-text-muted">{codigo}</span>
                </Td>
                <Td className="text-sg-body-sm text-sg-text-secondary">{para}</Td>
                <Td>
                  <EstadoChip objeto="commitment" estado={estado} />
                </Td>
                <Td>
                  <span className="block tabular-nums">
                    {new Date(vence + 'T12:00').toLocaleDateString(l('es-PE', 'en-GB'), { day: 'numeric', month: 'short' })}
                  </span>
                  <SituacionDePlazo valor={plazo} />
                </Td>
                <Td className="text-right">
                  <Monto valor={monto} moneda="PEN" />
                </Td>
                <Td className="w-28 text-right">
                  {i === 1 ? (
                    <Button size="sm" variant="ghost">
                      <Eye aria-hidden className="mr-1 size-4" />
                      {l('Vista previa', 'Preview')}
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="border-t border-sg-border px-4 py-2">
          <Pagination page={0} totalPages={1} totalElements={7} onPage={() => {}} />
        </div>
      </div>
    </Marco>
  )
}
