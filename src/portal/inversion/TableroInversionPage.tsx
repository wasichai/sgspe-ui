import { Table, Td, Th } from '@wasichai/ui'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { SelectNativo } from '../componentes/Campo'
import { montoPe } from '../componentes/Monto'
import { desglose, useTablero, type FilaDeDesglose, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { anioEnLima } from '../datos/inversion'
import { texto, useTodos } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ConsultaDeTablero, FiltrosDeTablero, indicadorDe, useFiltrosDeTablero, Zona } from '../tableros/comunes'
import { BeneficiariosPorFuente, CampanasFrenteAlTope, cifraDe } from './cifras'

// el tablero de inversión social (screens.md §12, dashboards.md §5.10, spec F5 §3.9): GET /api/sgspe/dashboards/investment en una
// llamada con los filtros del tablero (la campaña es explorationCampaign, el filtro común, que FiltrosDeTablero ofrece con
// conCampana dentro de un proyecto) y los propios de inversión (program y year, en la URL; el programa se elige dentro de un
// proyecto). los cuatro KPI-INV en su orden. los montos se dicen en su moneda y nunca se suman entre monedas (ASM-063):
// las barras de programas van en una figura por moneda. un programa por aprobar no muestra ejecución. un indicador que la cuenta no
// lee dice «no disponible», nunca cero; 400 TOO_MANY_RECORDS es «acote los filtros»
const POR_APROBAR = ['draft', 'pending_approval']
const FILTROS = ['program', 'year'] as const

function useFiltrosDeInversion(): FiltrosDeIndicador {
  const base = useFiltrosDeTablero()
  const [busqueda] = useSearchParams()
  return useMemo(() => {
    const filtros: FiltrosDeIndicador = { ...base }
    for (const clave of FILTROS) {
      const valor = busqueda.get(clave)
      if (valor) filtros[clave] = valor
    }
    return filtros
  }, [base, busqueda])
}

export function TableroInversionPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeInversion()
  const tablero = useTablero('investment', filtros)
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('tableroInversion.titulo')}</h1>
        <Link to={proyecto ? `/projects/${encodeURIComponent(proyecto)}/programs` : '/programs'} className="text-sm text-sg-primary-text underline">
          {t('tableroInversion.irAProgramas')}
        </Link>
      </div>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} conCampana />
      <FiltrosDeInversion proyecto={proyecto} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          const titulo = (code: string, zona: 'campanas' | 'programas' | 'consolidado' | 'beneficiarios') =>
            ind(code)?.label || t(`tableroInversion.zonas.${zona}`)
          return (
            <div className="space-y-4">
              <Zona titulo={titulo('KPI-INV-01', 'campanas')} indicador={ind('KPI-INV-01')}>
                {(i) => <CampanasFrenteAlTope indicador={i} />}
              </Zona>
              <Zona titulo={titulo('KPI-INV-02', 'programas')} indicador={ind('KPI-INV-02')}>
                {(i) => <ProgramasPorAnio indicador={i} />}
              </Zona>
              <Zona titulo={titulo('KPI-INV-03', 'consolidado')} indicador={ind('KPI-INV-03')}>
                {(i) => <Consolidado indicador={i} />}
              </Zona>
              <Zona titulo={titulo('KPI-INV-04', 'beneficiarios')} indicador={ind('KPI-INV-04')}>
                {(i) => <BeneficiariosPorPrograma indicador={i} />}
              </Zona>
            </div>
          )
        }}
      </ConsultaDeTablero>
    </section>
  )
}

// el programa del proyecto del contexto y el año presupuestal (los cinco anteriores y los cinco siguientes al de hoy en
// Lima, dentro de 2000 a 2100): se escriben en la URL, como los demás filtros del tablero
function FiltrosDeInversion({ proyecto }: { proyecto?: string }) {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const programas = useTodos('social_program', { project: proyecto }, proyecto !== undefined)
  const hoy = anioEnLima()
  const anios = Array.from({ length: 11 }, (_, i) => String(hoy - 5 + i)).filter((a) => Number(a) >= 2000 && Number(a) <= 2100)
  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    fijar(siguiente, { replace: true })
  }
  const control = (clave: (typeof FILTROS)[number], etiqueta: string, opciones: { valor: string; etiqueta: string }[]) => (
    <label className="space-y-1">
      <span className="block text-sg-label">{etiqueta}</span>
      <SelectNativo value={busqueda.get(clave) ?? ''} onChange={(e) => cambiar(clave, e.target.value)} opciones={opciones} />
    </label>
  )
  return (
    <div role="group" aria-label={t('tableroInversion.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
      {proyecto
        ? control(
            'program',
            t('tableroInversion.programa'),
            (programas.data ?? []).map((p) => ({ valor: p.id, etiqueta: `${texto(p, 'code')} · ${texto(p, 'name')}` }))
          )
        : null}
      {control(
        'year',
        t('tableroInversion.anio'),
        anios.map((a) => ({ valor: a, etiqueta: a }))
      )}
    </div>
  )
}

const moneda = (f: FilaDeDesglose): string => (typeof f.currency === 'string' && f.currency ? f.currency : '—')

// KPI-INV-02: por programa, año y moneda, lo asignado y lo ejecutado registrado (decisión 4); una figura por moneda, con su tabla
function ProgramasPorAnio({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const filas = desglose(indicador, 'program')
  const monedas = [...new Set(filas.map(moneda))]
  if (filas.length === 0) return <p className="text-sm text-sg-text-muted">{t('tableroInversion.programas.sinFilas')}</p>
  return (
    <div className="space-y-4">
      {monedas.map((m) => (
        <ProgramasDeUnaMoneda key={m} moneda={m} filas={filas.filter((f) => moneda(f) === m)} />
      ))}
    </div>
  )
}

function ProgramasDeUnaMoneda({ moneda: enMoneda, filas }: { moneda: string; filas: FilaDeDesglose[] }) {
  const { t } = useTranslation(NS)
  const titulo = t('tableroInversion.programas.deMoneda', { moneda: enMoneda })
  const porAprobar = (f: FilaDeDesglose) => POR_APROBAR.includes(String(f.state ?? ''))
  const nombre = (f: FilaDeDesglose) => `${f.label ?? f.key} ${String(f.year ?? '')}`.trim()
  const opciones = useMemo(
    () => ({
      grid: { left: 60, right: 16, top: 24, bottom: 48 },
      legend: {},
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: filas.map(nombre) },
      yAxis: { type: 'value' },
      series: [
        { type: 'bar', name: t('tableroInversion.programas.asignado'), data: filas.map((f) => cifraDe(f.allocated)) },
        { type: 'bar', name: t('tableroInversion.programas.ejecutado'), data: filas.map((f) => (porAprobar(f) ? null : cifraDe(f.executed))) }
      ]
    }),
    [JSON.stringify(filas), t]
  )
  return (
    <div className="space-y-2">
      <Grafico
        etiqueta={titulo}
        opciones={opciones}
        datos={{
          columnas: [t('tableroInversion.programas.programa'), t('tableroInversion.programas.asignado'), t('tableroInversion.programas.ejecutado')],
          filas: filas.map((f) => [
            nombre(f),
            montoPe(f.allocated, enMoneda),
            porAprobar(f) ? t('tableroInversion.programas.porAprobar') : montoPe(f.executed, enMoneda)
          ])
        }}
      />
      <Table aria-label={t('tableroInversion.programas.tablaDeMoneda', { moneda: enMoneda })}>
        <thead>
          <tr>
            <Th scope="col">{t('tableroInversion.programas.programa')}</Th>
            <Th scope="col">{t('tableroInversion.programas.anio')}</Th>
            <Th scope="col">{t('tableroInversion.programas.asignado')}</Th>
            <Th scope="col">{t('tableroInversion.programas.ejecutado')}</Th>
            <Th scope="col">{t('tableroInversion.programas.avance')}</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            // el avance lo da el servidor (`percent`, InvestmentKpis.programs del plan 5.2b)
            const avance = cifraDe(f.percent)
            return (
              <tr key={f.key}>
                <Td className="text-sm">{f.label ?? f.key}</Td>
                <Td className="text-sm tabular-nums">{String(f.year ?? '—')}</Td>
                <Td className="text-sm tabular-nums">{montoPe(f.allocated, enMoneda)}</Td>
                <Td className="text-sm tabular-nums">{porAprobar(f) ? t('tableroInversion.programas.porAprobar') : montoPe(f.executed, enMoneda)}</Td>
                <Td className="text-sm tabular-nums">{porAprobar(f) || avance === null ? '—' : `${numeroPe(avance)} %`}</Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}

// KPI-INV-03: el desglose `project` de InvestmentKpis (plan 5.2b), una fila por proyecto y moneda con lo ejecutado del periodo y sus
// fuentes frente al presupuesto y al tope; cada fila en su moneda, nunca sumadas entre monedas. las otras monedas y los programas
// excluidos por localidad llegan como avisos del indicador (Zona los dice)
function Consolidado({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const filas = desglose(indicador, 'project')
  if (filas.length === 0) return <p className="text-sm text-sg-text-muted">{t('tableroInversion.consolidado.sinFilas')}</p>
  const columnas = ['executed', 'commitments', 'contributions', 'programs', 'budget', 'cap'] as const
  const encabezado = {
    executed: 'total',
    commitments: 'compromisos',
    contributions: 'aportes',
    programs: 'programas',
    budget: 'presupuesto',
    cap: 'tope'
  } as const
  return (
    <Table aria-label={t('tableroInversion.consolidado.tabla')}>
      <thead>
        <tr>
          <Th scope="col">{t('tableroInversion.consolidado.proyecto')}</Th>
          <Th scope="col">{t('tableroInversion.consolidado.moneda')}</Th>
          {columnas.map((c) => (
            <Th key={c} scope="col">
              {t(`tableroInversion.consolidado.${encabezado[c]}`)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.key}>
            <Th scope="row">{f.label ?? String(f.project ?? f.key)}</Th>
            <Td>{moneda(f)}</Td>
            {columnas.map((c) => (
              <Td key={c} className="tabular-nums">
                {montoPe(f[c], moneda(f))}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// KPI-INV-04: por programa, la meta y los alcanzados de sus grupos, y aparte las otras fuentes (no se suman)
function BeneficiariosPorPrograma({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const filas = desglose(indicador, 'program')
  const conteo = (valor: unknown) => {
    const n = cifraDe(valor)
    return n === null ? '—' : numeroPe(n)
  }
  return (
    <div className="space-y-3">
      {filas.length > 0 ? (
        <Table aria-label={t('tableroInversion.beneficiarios.tabla')}>
          <thead>
            <tr>
              <Th scope="col">{t('tableroInversion.beneficiarios.programa')}</Th>
              <Th scope="col">{t('tableroInversion.beneficiarios.meta')}</Th>
              <Th scope="col">{t('tableroInversion.beneficiarios.alcanzados')}</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.key}>
                <Td className="text-sm">{f.label ?? f.key}</Td>
                <Td className="text-sm tabular-nums">{conteo(f.target)}</Td>
                <Td className="text-sm tabular-nums">{conteo(f.reached)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <BeneficiariosPorFuente indicador={indicador} />
    </div>
  )
}
