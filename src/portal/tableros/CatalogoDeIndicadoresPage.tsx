import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { DeLista } from '../componentes/LecturaConEstados'
import { esMontoValido, normalizarMonto } from '../componentes/Monto'
import { atributo, texto, useActualizar, usePuedeEditar, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'

// el catálogo indicator (dashboards.md §10): cada KPI con su frecuencia, su meta y su medio de verificación, cargado por
// load_indicators.py. quien tiene UPDATE (usePuedeEditar) edita la meta y la frecuencia; el código no cambia (IndicatorWriteGuard)
// y el resto lo documenta el script. una meta vacía es «sin meta»
const FRECUENCIAS = ['Semanal', 'Mensual', 'Trimestral', 'Anual']

const metaDe = (indicador: Registro): string => {
  const valor = atributo(indicador, 'target_value')
  return valor === null || valor === undefined || valor === '' ? '' : String(valor)
}

export function CatalogoDeIndicadoresPage() {
  const { t } = useTranslation(NS)
  const indicadores = useTodos('indicator', { sort: 'code', dir: 'asc' })
  const edita = usePuedeEditar('indicator')
  const [editando, setEditando] = useState<Registro | null>(null)
  const [guardado, setGuardado] = useState(false)
  const titulo = t('tablerosF8.catalogo.titulo')
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <Link to="/dashboards/monitoring" className="text-sm text-sg-primary-text underline">
        {t('tablerosF8.catalogo.volver')}
      </Link>
      <h1 className="text-sg-h1 font-semibold">{titulo}</h1>
      <p className="text-sm text-sg-text-secondary">{t('tablerosF8.catalogo.ayuda')}</p>
      {guardado ? (
        <p role="status" className="text-sm text-sg-success">
          {t('tablerosF8.catalogo.guardado')}
        </p>
      ) : null}
      <DeLista consulta={indicadores}>
        {(lista) => (
          <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
            <Table aria-label={titulo}>
              <thead>
                <tr>
                  {(['codigo', 'nombre', 'frecuencia', 'meta', 'medio'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`tablerosF8.catalogo.columnas.${c}`)}
                    </Th>
                  ))}
                  {edita ? <Th scope="col">{t('tablerosF8.catalogo.columnas.acciones')}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-sg-mono text-sm">{texto(i, 'code')}</Td>
                    <Td className="text-sm">{texto(i, 'name')}</Td>
                    <Td className="text-sm">{texto(i, 'frequency') || '—'}</Td>
                    <Td className="text-sm tabular-nums">{metaDe(i) ? numeroPe(Number(metaDe(i))) : t('tablerosF8.catalogo.sinMeta')}</Td>
                    <Td className="text-sm">{texto(i, 'verification_means') || '—'}</Td>
                    {edita ? (
                      <Td className="text-sm">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={t('tablerosF8.catalogo.editar', { indicador: texto(i, 'name') })}
                          onClick={() => {
                            setGuardado(false)
                            setEditando(i)
                          }}
                        >
                          {t('comun.editar')}
                        </Button>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </DeLista>
      {editando ? (
        <EditarMeta
          indicador={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null)
            setGuardado(true)
          }}
        />
      ) : null}
    </section>
  )
}

function EditarMeta({ indicador, alCerrar, alGuardar }: { indicador: Registro; alCerrar: () => void; alGuardar: () => void }) {
  const { t } = useTranslation(NS)
  const actualizar = useActualizar('indicator')
  const releer = useReleer()
  const [meta, setMeta] = useState(metaDe(indicador))
  const [frecuencia, setFrecuencia] = useState(texto(indicador, 'frequency'))
  const [intentado, setIntentado] = useState(false)
  const metaInvalida = meta.trim() !== '' && !esMontoValido(meta)
  const guardar = () => {
    setIntentado(true)
    if (metaInvalida) return
    actualizar.mutate(
      { registro: indicador, cambios: { target_value: meta.trim() === '' ? null : normalizarMonto(meta), frequency: frecuencia.trim() || null } },
      { onSuccess: alGuardar }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-sg-h3 font-semibold">{t('tablerosF8.catalogo.editar', { indicador: texto(indicador, 'name') })}</DialogTitle>
        <DialogDescription className="font-sg-mono text-sg-caption text-sg-text-muted">{texto(indicador, 'code')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <Campo etiqueta={t('tablerosF8.catalogo.meta')} error={intentado && metaInvalida ? t('tablerosF8.catalogo.metaInvalida') : undefined}>
            {(p) => <Input {...p} inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('tablerosF8.catalogo.frecuencia')}>
            {(p) => <Input {...p} list="frecuencias-de-indicador" maxLength={40} value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} />}
          </Campo>
          <datalist id="frecuencias-de-indicador">
            {FRECUENCIAS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {actualizar.isError ? (
            <AvisoDeConflicto
              error={actualizar.error}
              releer={() => releer(['record', 'indicator', indicador.id], ['records', 'indicator'])}
              alRecargar={() => actualizar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={guardar} disabled={actualizar.isPending} aria-busy={actualizar.isPending}>
            {actualizar.isPending ? t('comun.guardando') : t('comun.guardar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
