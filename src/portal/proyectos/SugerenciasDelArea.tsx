import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando, esIlegible, esProhibido, NoDisponible } from '../componentes/Estados'
import { codigoDelError } from '../datos/http'
import { useCrear, useDefinicion } from '../datos/registros'
import { NS } from '../i18n'
import { useSugerencias, type Sugerencia } from '../territorio/consultas'

// «Sugerencias del cálculo» de S10 (screens.md S10, spec F6 §3.7, caso 1 y 9 de gis.md §5.3): el cálculo propone y la persona
// decide fila por fila (decisión 15 del plan 6.3). aceptar crea el miembro con spatially_suggested, la condición elegida
// (PROVISIONAL por defecto) y una justificación propuesta que se puede cambiar; nada se escribe sin esa acción.
// alreadyMember null: no se sabe si ya es miembro y no se ofrece aceptar
export function SugerenciasDelArea({ area, editable }: { area: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const [abierta, setAbierta] = useState(false)
  const [buffer, setBuffer] = useState('')
  const valor = Number(buffer)
  const valido = buffer.trim() === '' || (Number.isInteger(valor) && valor >= 1 && valor <= 20000)
  const consulta = useSugerencias(area, buffer.trim() === '' || !valido ? null : valor, abierta && valido)
  const [aceptando, setAceptando] = useState<Sugerencia | null>(null)
  if (!abierta)
    return (
      <Button variant="secondary" size="sm" onClick={() => setAbierta(true)}>
        {t('sugerencias.titulo')}
      </Button>
    )
  const relacionDe = (r: string) => t(`sugerencias.relaciones.${r}`, { defaultValue: t('sugerencias.relaciones.otra') })
  return (
    <section aria-label={t('sugerencias.titulo')} className="space-y-3 rounded-sg-lg border border-sg-border p-4 text-sm">
      <h2 className="font-medium">{t('sugerencias.titulo')}</h2>
      <p className="text-sg-caption text-sg-text-muted">{t('sugerencias.ayuda')}</p>
      <div className="max-w-[220px]">
        <Campo etiqueta={t('sugerencias.buffer')} error={valido ? undefined : t('sugerencias.bufferFuera')}>
          {(p) => <Input {...p} inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value)} />}
        </Campo>
      </div>
      {consulta.isPending && valido ? <Cargando /> : null}
      {/* un 404 sin código es un backend sin el plan 6.2a: «No disponible», como un 403, y no un error */}
      {consulta.isError ? (
        esProhibido(consulta.error) || (esIlegible(consulta.error) && !codigoDelError(consulta.error)) ? (
          <NoDisponible enLista />
        ) : (
          <Alert tone="danger">{mensaje(consulta.error)}</Alert>
        )
      ) : null}
      {consulta.data ? (
        <>
          {consulta.data.available === false ? <Alert tone="notice">{t('sugerencias.incompleto')}</Alert> : null}
          <Table aria-label={t('sugerencias.titulo')}>
            <thead>
              <tr>
                {(['lugar', 'tipo', 'relacion', 'accion'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`sugerencias.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consulta.data.suggestions.map((s) => (
                <tr key={`${s.object}-${s.recordId}`}>
                  <Td>{s.name ?? '—'}</Td>
                  <Td>{t(`sugerencias.tipos.${s.object}`)}</Td>
                  <Td>{relacionDe(s.relation)}</Td>
                  <Td>
                    {s.alreadyMember === true ? (
                      <span className="text-sg-text-muted">{t('sugerencias.yaEsMiembro')}</span>
                    ) : s.alreadyMember === null ? (
                      <span className="text-sg-text-muted">{t('sugerencias.noSePuedeSaber')}</span>
                    ) : editable ? (
                      <Button size="sm" variant="secondary" aria-label={t('sugerencias.aceptar', { nombre: s.name ?? '' })} onClick={() => setAceptando(s)}>
                        {t('sugerencias.aceptarCorto')}
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {consulta.data.suggestions.length === 0 ? <p className="text-sg-text-muted">{t('sugerencias.vacio')}</p> : null}
        </>
      ) : null}
      {aceptando ? (
        <Aceptar key={`${aceptando.object}-${aceptando.recordId}`} area={area} sugerencia={aceptando} alTerminar={() => setAceptando(null)} />
      ) : null}
    </section>
  )
}

function Aceptar({ area, sugerencia, alTerminar }: { area: string; sugerencia: Sugerencia; alTerminar: () => void }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const definicion = useDefinicion('area_of_influence_member')
  const crear = useCrear('area_of_influence_member')
  const condiciones = definicion.data?.fields.find((f) => f.name === 'member_condition')?.enumOptions ?? ['INCLUIDO', 'PROVISIONAL']
  const relacion = t(`sugerencias.relaciones.${sugerencia.relation}`, { defaultValue: t('sugerencias.relaciones.otra') }).toLowerCase()
  const [condicion, setCondicion] = useState('PROVISIONAL')
  const [justificacion, setJustificacion] = useState(t('sugerencias.justificacionPropuesta', { relacion }))
  const nombre = sugerencia.name ?? ''
  const agregar = () =>
    crear.mutate(
      {
        atributos: {
          area_of_influence: area,
          [sugerencia.object]: sugerencia.recordId,
          member_condition: condicion,
          rationale: justificacion,
          spatially_suggested: true
        }
      },
      {
        onSuccess: () => {
          void cliente.invalidateQueries({ queryKey: ['member-suggestions', area] })
          alTerminar()
        }
      }
    )
  return (
    <fieldset aria-label={t('sugerencias.agregarComo', { nombre })} className="space-y-2 rounded-sg-md border border-sg-border p-3">
      <legend className="px-1 font-medium">{t('sugerencias.agregarComo', { nombre })}</legend>
      <Campo etiqueta={t('sugerencias.condicion')}>
        {(p) => <SelectNativo {...p} vacio={false} value={condicion} onChange={(e) => setCondicion(e.target.value)} opciones={condiciones} />}
      </Campo>
      <Campo etiqueta={t('sugerencias.justificacion')}>
        {(p) => <Textarea {...p} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />}
      </Campo>
      {crear.isError ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={agregar} disabled={crear.isPending || justificacion.trim() === ''} aria-busy={crear.isPending}>
          {crear.isPending ? t('sugerencias.agregando') : t('sugerencias.agregar')}
        </Button>
        <Button size="sm" variant="secondary" onClick={alTerminar}>
          {t('sugerencias.cancelar')}
        </Button>
      </div>
    </fieldset>
  )
}
