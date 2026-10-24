import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando, Restringido, ThConExplicacion, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { descriptorDe, tamanoPe } from '../datos/archivos'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, type Registro } from '../datos/registros'
import { diaPe, fechaPe, NS } from '../i18n'
import { MOTIVO_EN_TODAS } from '../transiciones/reglas'
import { useDescargarEvidencia, useDesvincularEvidencia, useEvidenciasDe, useNombreDeEvidencia, usePuedeDescargar, useVincularEvidencia } from './api'
import { FormularioDeEvidencia } from './FormularioDeEvidencia'
import { opcion } from '../datos/opciones'

// la pestaña Evidencias de una ficha (S29, S33, S23) y «Qué generó»: las evidencias que sustentan el registro (su vínculo
// evidence_<objeto>), con su descarga (DOWNLOAD_RESTRICTED para CONFIDENCIAL y DATOS PERSONALES, RF-DOC-003), subir una nueva
// ya vinculada, vincular una existente y desvincular. escribe es la guarda de UI de quien abre la ficha (useEscribeEnProyecto
// del proyecto del registro); además se piden los permisos de evidence y del objeto (security.md §5.6: vincular pide UPDATE
// sobre los dos). un vínculo con un objeto requiresReason lleva motivo. el nombre de una evidencia sin título es el de su
// archivo solo para quien la descarga (P59, useNombreDeEvidencia). una QCS propone subir su cargo o su carta firmados (ASM-098): el
// botón dice eso (textoSubir) y el formulario propone el tipo y la clasificación (DATOS PERSONALES)

export function EvidenciasDelRegistro({
  objeto,
  registro,
  escribe,
  tipoInicial,
  clasificacionInicial,
  textoSubir
}: {
  objeto: string
  registro: Registro
  escribe: boolean
  tipoInicial?: string
  clasificacionInicial?: string
  textoSubir?: string
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const evidencias = useEvidenciasDe(objeto, registro.id)
  const descargar = useDescargarEvidencia()
  const puedeDescargar = usePuedeDescargar()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const mensaje = useMensajeDeError()
  const explicacion = useId()
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState<Registro | null>(null)
  const conMotivo = MOTIVO_EN_TODAS.includes(objeto)
  const proyecto = atributo<string>(registro, 'project') ?? (objeto === 'project' ? registro.id : undefined)
  const sube = escribe && can('evidence', 'CREATE') && can('evidence', 'UPDATE') && can(objeto, 'UPDATE')
  const vincula = escribe && can('evidence', 'UPDATE') && can(objeto, 'UPDATE')
  const vinculo = { object: objeto, recordId: registro.id }
  // sin leer la clasificación, la ayuda no insinúa cuál es
  const ayudaDeRestringida = (e: Registro) =>
    'classification' in e.attributes ? t('evidencias.restringidaAyuda') : t('evidencias.restringidaSinClasificacion')

  return (
    <section aria-label={t('evidencias.titulo')} className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('evidencias.titulo')}</h2>
        {/* secundaria: la primaria de la ficha que la contiene es su siguiente acción (P-09 y DD-02, una sola primaria) */}
        {sube ? (
          <Button size="sm" variant="secondary" onClick={() => setSubiendo(true)}>
            {textoSubir ?? t('evidencias.subir')}
          </Button>
        ) : null}
      </div>
      {descargar.isError ? <Alert tone="danger">{mensaje(descargar.error)}</Alert> : null}
      {evidencias.isPending ? (
        <Cargando compacto />
      ) : evidencias.isError && !evidencias.data ? (
        <FalloDeLectura error={evidencias.error} alReintentar={() => void evidencias.refetch()} />
      ) : evidencias.data.content.length === 0 ? (
        <Vacio titulo={t('evidencias.vacia')} />
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label={t('evidencias.titulo')}>
            <thead>
              <tr>
                <Th scope="col">{t('evidencias.columnas.evidencia')}</Th>
                <Th scope="col">{t('evidencias.columnas.tipo')}</Th>
                {/* la explicación «su rol no la lee» solo existe si alguna celda la usa, y no entra en el nombre de la columna
                    (ThConExplicacion): una clasificación leída no se anuncia como restringida */}
                {evidencias.data.content.some((e) => !('classification' in e.attributes)) ? (
                  <ThConExplicacion explicacion={explicacion} tipo="restringido" soloLectores>
                    {t('evidencias.columnas.clasificacion')}
                  </ThConExplicacion>
                ) : (
                  <Th scope="col">{t('evidencias.columnas.clasificacion')}</Th>
                )}
                <Th scope="col">{t('evidencias.columnas.tamano')}</Th>
                <Th scope="col">{t('evidencias.columnas.fecha')}</Th>
                <Th scope="col">{t('evidencias.columnas.acciones')}</Th>
              </tr>
            </thead>
            <tbody>
              {evidencias.data.content.map((e) => {
                const nombre = nombreDeEvidencia(e)
                const ruta = rutaDeFicha('evidence', e)
                const descriptor = descriptorDe(atributo(e, 'file'))
                const fecha = atributo<string>(e, 'document_date')
                return (
                  <tr key={e.id}>
                    <Td className="text-sm">
                      {ruta ? (
                        <Link to={ruta} className="text-sg-primary-text underline">
                          {nombre}
                        </Link>
                      ) : (
                        nombre
                      )}
                      {atributo(e, 'people_identifiable') === true && atributo(e, 'photo_consent_given') !== true ? (
                        <span className="block text-sg-caption text-sg-warning">{t('evidencias.sinConsentimiento')}</span>
                      ) : null}
                    </Td>
                    <Td className="text-sm">{opcion(e, 'evidence_type') || '—'}</Td>
                    <Td className="text-sm">{'classification' in e.attributes ? opcion(e, 'classification') : <Restringido describedPor={explicacion} />}</Td>
                    <Td className="text-sm tabular-nums">{descriptor ? tamanoPe(descriptor.size) : '—'}</Td>
                    <Td className="text-sm">{fecha ? diaPe(fecha) : e.createdAt ? fechaPe(new Date(e.createdAt)) : '—'}</Td>
                    <Td className="space-x-2 whitespace-nowrap text-sm">
                      {puedeDescargar(e) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={t('evidencias.descargar', { nombre })}
                          disabled={descargar.isPending}
                          onClick={() => descargar.mutate(e)}
                        >
                          {descargar.isPending && descargar.variables?.id === e.id ? t('evidencias.descargando') : t('evidencias.descargarBoton')}
                        </Button>
                      ) : (
                        <span className="text-sg-caption text-sg-text-muted" title={ayudaDeRestringida(e)}>
                          {t('evidencias.restringida')}
                          <span className="sr-only">: {ayudaDeRestringida(e)}</span>
                        </span>
                      )}
                      {vincula ? (
                        <Button size="sm" variant="secondary" aria-label={t('evidencias.desvincular', { nombre })} onClick={() => setQuitando(e)}>
                          {t('evidencias.desvincularBoton')}
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
      {vincula ? <VincularExistente vinculo={vinculo} conMotivo={conMotivo} /> : null}
      <Drawer titulo={textoSubir ?? t('evidencias.subirTitulo')} abierto={subiendo} alCerrar={() => setSubiendo(false)}>
        <FormularioDeEvidencia
          vinculos={[vinculo]}
          conMotivo={conMotivo}
          proyecto={proyecto}
          tipoInicial={tipoInicial}
          clasificacionInicial={clasificacionInicial}
          alRegistrar={() => setSubiendo(false)}
          alCancelar={() => setSubiendo(false)}
        />
      </Drawer>
      {quitando ? <Desvincular evidencia={quitando} vinculo={vinculo} conMotivo={conMotivo} alCerrar={() => setQuitando(null)} /> : null}
    </section>
  )
}

function VincularExistente({ vinculo, conMotivo }: { vinculo: { object: string; recordId: string }; conMotivo: boolean }) {
  const { t } = useTranslation(NS)
  const vincular = useVincularEvidencia()
  const mensaje = useMensajeDeError()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const [elegida, setElegida] = useState<Registro | null>(null)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const faltaMotivo = conMotivo && motivo.trim() === ''
  const confirmar = () => {
    setIntentado(true)
    if (!elegida || faltaMotivo) return
    vincular.mutate(
      { evidencia: elegida.id, vinculo, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          setElegida(null)
          setMotivo('')
          setIntentado(false)
        }
      }
    )
  }
  return (
    <details className="rounded-sg-md border border-sg-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-sg-primary-text">{t('evidencias.vincularExistente')}</summary>
      <div className="mt-2 space-y-2">
        {elegida ? (
          <p className="text-sm">
            {nombreDeEvidencia(elegida)}{' '}
            <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setElegida(null)}>
              {t('comun.quitar')}
            </button>
          </p>
        ) : (
          <BuscadorDeRegistro
            objeto="evidence"
            etiqueta={t('evidencias.buscar')}
            rotulo={nombreDeEvidencia}
            alElegir={(r) => {
              setElegida(r)
              vincular.reset()
            }}
          />
        )}
        {conMotivo ? (
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
        ) : null}
        {vincular.isError ? <Alert tone="danger">{mensaje(vincular.error)}</Alert> : null}
        {vincular.isSuccess ? (
          <p role="status" className="text-sm text-sg-success">
            {t('evidencias.vinculada')}
          </p>
        ) : null}
        <Button size="sm" onClick={confirmar} disabled={!elegida || vincular.isPending} aria-busy={vincular.isPending}>
          {t('evidencias.vincular')}
        </Button>
      </div>
    </details>
  )
}

function Desvincular({
  evidencia,
  vinculo,
  conMotivo,
  alCerrar
}: {
  evidencia: Registro
  vinculo: { object: string; recordId: string }
  conMotivo: boolean
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const desvincular = useDesvincularEvidencia()
  const mensaje = useMensajeDeError()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const faltaMotivo = conMotivo && motivo.trim() === ''
  const confirmar = () => {
    setIntentado(true)
    if (faltaMotivo) return
    desvincular.mutate({ evidencia: evidencia.id, vinculo, motivo: motivo.trim() || undefined }, { onSuccess: alCerrar })
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-sg-h3 font-semibold">{t('evidencias.desvincularTitulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">
          {nombreDeEvidencia(evidencia)}. {t('evidencias.desvincularTexto')}
        </DialogDescription>
        <div className="mt-3 space-y-3">
          {conMotivo ? (
            <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}>
              {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
            </Campo>
          ) : null}
          {desvincular.isError ? <Alert tone="danger">{mensaje(desvincular.error)}</Alert> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar} disabled={desvincular.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={desvincular.isPending} aria-busy={desvincular.isPending}>
            {t('evidencias.desvincularTitulo')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
