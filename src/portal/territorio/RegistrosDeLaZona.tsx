import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTROL } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga, esProhibido, NoDisponible } from '../componentes/Estados'
import { EnlaceDeFicha } from '../componentes/RegistroVinculado'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { OBJETOS_DE_LA_ZONA, OBJETOS_SIN_PERIODO, useRegistrosDeLaZona, type ObjetoConsultableDeZona, type ObjetoDeZona } from './consultas'

// los registros de un objeto asociados a una zona, por su relación territorial o por su geometría (spec F6 §3.1): la tabla de
// registros del lugar de S12, S13 y S14. solo se ofrecen los objetos que la cuenta lee; cada registro lleva a su ficha. los
// grupos de interés y los riesgos no tienen fecha: se piden sin el periodo y se dice
export { OBJETOS_DE_LA_ZONA }

const nombreDe = (r: Registro): string =>
  [texto(r, 'code'), texto(r, 'title') || texto(r, 'name') || texto(r, 'description').slice(0, 80)].filter(Boolean).join(' · ') || r.id

export function RegistrosDeLaZona({ zona, id, periodo = {} }: { zona: ObjetoDeZona; id: string; periodo?: { periodStart?: string; periodEnd?: string } }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const legibles = OBJETOS_DE_LA_ZONA.filter((o) => can(o, 'READ'))
  const [elegido, setElegido] = useState<ObjetoConsultableDeZona | null>(null)
  const [pagina, setPagina] = useState(0)
  const objeto = elegido && legibles.includes(elegido) ? elegido : (legibles[0] ?? null)
  // page solo desde la segunda: la primera es la de por defecto
  const consulta = useRegistrosDeLaZona(zona, id, objeto, { ...periodo, page: pagina || undefined })
  const titulo = t('fichaTerritorial.registros.titulo')
  if (!objeto) return <p className="pt-3 text-sm text-sg-text-muted">{t('fichaTerritorial.registros.sinObjetos')}</p>
  const sinPeriodo = OBJETOS_SIN_PERIODO.includes(objeto) && Boolean(periodo.periodStart || periodo.periodEnd)
  const total = consulta.data?.totalPages ?? null
  return (
    <section aria-label={titulo} className="space-y-2 pt-3 text-sm">
      <label className="block max-w-xs space-y-1">
        <span className="block text-sg-label">{t('fichaTerritorial.registros.que')}</span>
        <select
          className={CONTROL}
          value={objeto}
          onChange={(e) => {
            setElegido(e.target.value as ObjetoConsultableDeZona)
            setPagina(0)
          }}
        >
          {legibles.map((o) => (
            <option key={o} value={o}>
              {t(`fichaTerritorial.registros.objetos.${o}`)}
            </option>
          ))}
        </select>
      </label>
      {sinPeriodo ? <p className="text-sg-caption text-sg-text-muted">{t('fichaTerritorial.registros.sinPeriodo')}</p> : null}
      {consulta.isPending ? <Cargando /> : null}
      {consulta.isError && esProhibido(consulta.error) ? <NoDisponible enLista /> : null}
      {consulta.isError && !esProhibido(consulta.error) ? <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} /> : null}
      {consulta.data ? (
        <>
          {/* el filtro de la zona usa un campo que la cuenta no lee: la lista puede estar incompleta, nunca se da por entera */}
          {consulta.data.available === false ? (
            <Alert tone="warning">{t('fichaTerritorial.registros.incompleta', { campos: (consulta.data.missingFields ?? []).join(', ') })}</Alert>
          ) : null}
          <Table aria-label={titulo}>
            <thead>
              <tr>
                <Th scope="col">{t('fichaTerritorial.registros.registro')}</Th>
                <Th scope="col">{t('fichaTerritorial.registros.estado')}</Th>
              </tr>
            </thead>
            <tbody>
              {consulta.data.content.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <EnlaceDeFicha objeto={objeto} registro={r}>
                      {nombreDe(r)}
                    </EnlaceDeFicha>
                  </Td>
                  <Td>
                    <EstadoChip objeto={objeto} estado={r.state} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {consulta.data.content.length === 0 && consulta.data.available !== false ? (
            <p className="text-sg-text-muted">{t('fichaTerritorial.registros.vacio')}</p>
          ) : null}
          {total !== null && total > 1 ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
                {t('fichaTerritorial.registros.anterior')}
              </Button>
              <span>{t('fichaTerritorial.registros.pagina', { n: pagina + 1, total })}</span>
              <Button size="sm" variant="secondary" disabled={pagina + 1 >= total} onClick={() => setPagina(pagina + 1)}>
                {t('fichaTerritorial.registros.siguiente')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
