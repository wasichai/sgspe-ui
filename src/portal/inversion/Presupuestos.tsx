import { useQueryClient } from '@tanstack/react-query'
import { Table, Td, Th } from '@wasichai/ui'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { montoPe } from '../componentes/Monto'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { anioEnLima, MONEDA_POR_DEFECTO, porcentaje, sumaPorMoneda } from '../datos/inversion'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'

// el presupuesto de un programa (screens.md S43, decisión 4, ASM-063): un registro por año con lo asignado y el ejecutado
// registrado a mano en su moneda, y su avance; los totales se suman por moneda, nunca entre monedas. total_budget (derivado,
// ProgramTotalsListener) es el total solo en la moneda del programa; sin ella, no se calcula. un presupuesto nuevo propone el año en
// curso de Lima y la moneda del programa
const CAMPOS = ['budget_year', 'currency', 'allocated_amount', 'executed_amount']

export function Presupuestos({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const monedaDelPrograma = texto(programa, 'currency')
  const filtros = useMemo(() => ({ social_program: programa.id, sort: 'budget_year', dir: 'asc' }), [programa.id])
  const fijos = useMemo(() => ({ social_program: programa.id }), [programa.id])
  const iniciales = useMemo(() => ({ budget_year: anioEnLima(), currency: monedaDelPrograma || MONEDA_POR_DEFECTO }), [monedaDelPrograma])
  const presupuestos = useTodosConTope('program_budget', filtros)
  const vacio = (valor: unknown) => valor === null || valor === undefined || valor === ''
  const columnas: ColumnaSimple[] = [
    { id: 'anio', encabezado: t('fichaPrograma.presupuesto.columnas.anio'), celda: (r) => texto(r, 'budget_year') },
    { id: 'moneda', encabezado: t('fichaPrograma.presupuesto.columnas.moneda'), celda: (r) => texto(r, 'currency') || '—' },
    {
      id: 'asignado',
      encabezado: t('fichaPrograma.presupuesto.columnas.asignado'),
      celda: (r) => montoPe(atributo(r, 'allocated_amount'), atributo(r, 'currency'))
    },
    {
      id: 'ejecutado',
      encabezado: t('fichaPrograma.presupuesto.columnas.ejecutado'),
      celda: (r) =>
        vacio(atributo(r, 'executed_amount')) ? t('fichaPrograma.presupuesto.sinRegistrar') : montoPe(atributo(r, 'executed_amount'), atributo(r, 'currency'))
    },
    {
      id: 'avance',
      encabezado: t('fichaPrograma.presupuesto.columnas.avance'),
      celda: (r) => {
        const avance = porcentaje(atributo(r, 'executed_amount'), atributo(r, 'allocated_amount'))
        return avance === null ? '—' : `${numeroPe(avance)} %`
      }
    }
  ]
  const asignado = sumaPorMoneda(presupuestos.data ?? [], 'allocated_amount')
  const ejecutado = sumaPorMoneda(presupuestos.data ?? [], 'executed_amount')
  const ejecutadoEn = (moneda: string) => ejecutado.sumas.find((s) => s.moneda === moneda)?.total ?? null
  return (
    <div className="space-y-3 pt-3 text-sm">
      <RegistrosSimples
        objeto="program_budget"
        titulo={t('fichaPrograma.presupuesto.titulo')}
        filtros={filtros}
        fijos={fijos}
        iniciales={iniciales}
        columnas={columnas}
        campos={CAMPOS}
        proyecto={texto(programa, 'project')}
        textoNuevo={t('fichaPrograma.presupuesto.nuevo')}
        textoVacio={t('fichaPrograma.presupuesto.vacio')}
        ayuda={<p className="text-sg-caption text-sg-text-muted">{t('fichaPrograma.presupuesto.ayuda')}</p>}
        alCambiar={() => void cliente.invalidateQueries({ queryKey: ['record', 'social_program', programa.id] })}
      />
      <p className="text-sg-caption text-sg-text-muted">{t('fichaPrograma.presupuesto.ayuda')}</p>
      {asignado.sumas.length > 0 ? (
        <section aria-label={t('fichaPrograma.presupuesto.totales')} className="space-y-2">
          <h3 className="font-medium">{t('fichaPrograma.presupuesto.totales')}</h3>
          <Table aria-label={t('fichaPrograma.presupuesto.totales')}>
            <thead>
              <tr>
                <Th scope="col">{t('fichaPrograma.presupuesto.columnas.moneda')}</Th>
                <Th scope="col">{t('fichaPrograma.presupuesto.columnas.asignado')}</Th>
                <Th scope="col">{t('fichaPrograma.presupuesto.columnas.ejecutado')}</Th>
                <Th scope="col">{t('fichaPrograma.presupuesto.columnas.avance')}</Th>
              </tr>
            </thead>
            <tbody>
              {asignado.sumas.map(({ moneda, total }) => {
                const enEjecucion = ejecutadoEn(moneda)
                const avance = enEjecucion === null ? null : porcentaje(enEjecucion, total)
                return (
                  <tr key={moneda}>
                    <Th scope="row">
                      {moneda} {moneda === monedaDelPrograma ? t('fichaPrograma.presupuesto.delPrograma') : ''}
                    </Th>
                    <Td className="tabular-nums">{montoPe(total, moneda)}</Td>
                    <Td className="tabular-nums">{enEjecucion === null ? '—' : montoPe(enEjecucion, moneda)}</Td>
                    <Td className="tabular-nums">{avance === null ? '—' : `${numeroPe(avance)} %`}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          {asignado.sumas.some((s) => s.moneda !== monedaDelPrograma) ? (
            <p className="text-sg-caption text-sg-warning">{t('fichaPrograma.presupuesto.otrasMonedas', { moneda: monedaDelPrograma || '—' })}</p>
          ) : null}
          {asignado.invalidos + ejecutado.invalidos > 0 ? <p className="text-sg-caption text-sg-warning">{t('fichaPrograma.presupuesto.invalidos')}</p> : null}
        </section>
      ) : null}
    </div>
  )
}
