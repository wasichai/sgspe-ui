import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { CONTROL } from '../componentes/Campo'
import { Cargando, ErrorDeCarga, esProhibido, NoDisponible } from '../componentes/Estados'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { diaPe, NS, numeroPe } from '../i18n'
import { OBJETOS_DE_CALOR, type Concentracion, type ObjetoDeCalor } from '../territorio/consultas'
import type { CapaDeCalor } from './Mapa'
import { RAMPA_DE_CALOR } from './estilos'

// el mapa de calor de S12 (spec F6 §3.1 y §3.7): conteos por localidad o comunidad, nunca por punto (RQ-GIS-015). el selector va en
// el grupo Gestión del control de capas y solo ofrece los objetos que la cuenta lee; la tabla es su alternativa accesible
export function SelectorDeCalor({ valor, alCambiar }: { valor: ObjetoDeCalor | null; alCambiar: (v: ObjetoDeCalor | null) => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const legibles = OBJETOS_DE_CALOR.filter((o) => can(o, 'READ'))
  if (legibles.length === 0) return null
  return (
    <label className="block space-y-1">
      <span className="block text-sg-label">{t('sig.calor.titulo')}</span>
      <select className={CONTROL} value={valor ?? ''} onChange={(e) => alCambiar((e.target.value || null) as ObjetoDeCalor | null)}>
        <option value="">{t('sig.calor.ninguno')}</option>
        {legibles.map((o) => (
          <option key={o} value={o}>
            {t(`sig.calor.objetos.${o}`)}
          </option>
        ))}
      </select>
    </label>
  )
}

// la capa del mapa: un punto por celda con punto, pesado por su conteo
export function capaDeCalor(c: Concentracion | undefined): CapaDeCalor | null {
  if (!c) return null
  const celdas = c.cells.filter((x) => x.point && x.count > 0)
  if (celdas.length === 0) return null
  return {
    datos: {
      type: 'FeatureCollection',
      features: celdas.map((x) => ({
        type: 'Feature',
        geometry: x.point!,
        properties: { __id: x.id, __object: x.object, count: x.count, name: x.name }
      }))
    },
    maximo: Math.max(...celdas.map((x) => x.count)),
    colores: RAMPA_DE_CALOR
  }
}

export function TablaDeCalor({ objeto, consulta }: { objeto: ObjetoDeCalor; consulta: UseQueryResult<Concentracion> }) {
  const { t } = useTranslation(NS)
  const titulo = t('sig.calor.tabla')
  const datos = consulta.data
  return (
    <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <h2 className="font-medium">
        {titulo} · {t(`sig.calor.objetos.${objeto}`)}
      </h2>
      <div className="flex items-center gap-2 text-sg-caption text-sg-text-muted" aria-hidden>
        {t('sig.calor.menos')}
        <span className="inline-block h-2 w-32 rounded-sg-sm" style={{ backgroundImage: `linear-gradient(to right, ${RAMPA_DE_CALOR.join(', ')})` }} />
        {t('sig.calor.mas')}
      </div>
      {consulta.isPending ? <Cargando /> : null}
      {consulta.isError && esProhibido(consulta.error) ? <NoDisponible enLista /> : null}
      {consulta.isError && !esProhibido(consulta.error) ? <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} /> : null}
      {datos ? (
        <>
          <NotaDeConfidenciales oculta={datos.confidentialHidden} />
          <p className="text-sg-caption text-sg-text-muted">{t('sig.calor.periodo', { desde: diaPe(datos.periodStart), hasta: diaPe(datos.periodEnd) })}</p>
          {datos.truncated ? (
            <p role="status" className="text-sg-caption text-sg-text-muted">
              {t('sig.calor.truncado')}
            </p>
          ) : null}
          {datos.available === false ? (
            <p role="status" className="text-sg-caption text-sg-text-muted">
              {t('sig.calor.incompleto')}
            </p>
          ) : null}
          <Table aria-label={titulo}>
            <thead>
              <tr>
                <Th scope="col">{t('sig.calor.localidad')}</Th>
                <Th scope="col">{t('sig.calor.cantidad')}</Th>
              </tr>
            </thead>
            <tbody>
              {[...datos.cells]
                .sort((a, b) => b.count - a.count)
                .map((c) => (
                  <tr key={`${c.object}:${c.id}`}>
                    <Td>{c.name || t('territorio.sinNombre')}</Td>
                    <Td className="tabular-nums">{numeroPe(c.count)}</Td>
                  </tr>
                ))}
            </tbody>
          </Table>
          {datos.cells.length === 0 ? <p className="text-sg-text-muted">{t('sig.calor.sinCeldas')}</p> : null}
          <p className="text-sg-caption text-sg-text-muted">{t('sig.calor.sinLocalidad')}</p>
        </>
      ) : null}
    </section>
  )
}
