import { ApiError, useAuth } from '@wasichai/core'
import { DocumentView } from '@wasichai/documents'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { fechaYHoraPe, NS } from '../i18n'
import { rutaDeImpresion, useDocumentosEmitidos, useEmitirDocumento, useTiposDeDocumento, type DocumentoEmitido } from './api'

// los documentos emitidos de un registro (RQ-REP-029, wasichai-documents). en F3 solo los tiene la interacción: la «Minuta de
// reunión» (meeting-minutes, MR-) y la «Lista de asistentes» (attendance-list, LA-) que emite AUT-05 al aprobar el acta. el
// «Acta de entrega» de una entrega espera a UPS-23 (plan 3.1, decisión 2): wasichai-documents congelaría sus campos
// restringidos, así que el portal no lo ofrece. cada uno con su número, su fecha y su estado
// (VALID o ARCHIVED); abrirlo lo dibuja con DocumentView de @wasichai/documents, congelado como se emitió, y la página
// imprimible está en /admin. emitir a mano se ofrece a quien cambia el registro (el servidor pide READ; la interfaz es más
// estricta) y solo si el objeto tiene tipos. sin el módulo (404) no se dibuja nada. las plantillas no imprimen campos
// restringidos (ASM-090). el servidor exige además (IssueDocumentFilter, P62) la asignación vigente al proyecto del registro
// y, sin EDIT_ANY, haberlo creado; la ficha no sabe quién lo creó, así que cada 403 (ACTION_REQUIRED, NOT_ASSIGNED,
// NOT_OWN_RECORD, OBJECT_NOT_READABLE) se dice con el texto propio de la emisión. escribe es la guarda de UI de quien abre la
// ficha (useEscribeEnProyecto del proyecto del registro): sin asignación vigente no se ofrece emitir
const NEGATIVAS = ['ACTION_REQUIRED', 'NOT_ASSIGNED', 'NOT_OWN_RECORD', 'OBJECT_NOT_READABLE'] as const

export function DocumentosEmitidos({ objeto, registroId, escribe }: { objeto: string; registroId: string; escribe?: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const documentos = useDocumentosEmitidos(objeto, registroId)
  const emite = escribe !== false && can(objeto, 'UPDATE')
  const tipos = useTiposDeDocumento(objeto, emite)
  const emitir = useEmitirDocumento(objeto, registroId)
  const mensaje = useMensajeDeError()
  const [tipo, setTipo] = useState('')
  const [abierto, setAbierto] = useState<DocumentoEmitido | null>(null)
  if (documentos.isError && !documentos.data && documentos.error instanceof ApiError && documentos.error.status === 404) return null
  return (
    <section aria-label={t('evidencias.emitidos.titulo')} className="space-y-3 pt-3">
      <h2 className="text-sg-h3 font-semibold">{t('evidencias.emitidos.titulo')}</h2>
      <p className="text-sg-caption text-sg-text-muted">{t('evidencias.emitidos.restringidos')}</p>
      {documentos.isPending ? (
        <Cargando compacto />
      ) : documentos.isError && !documentos.data ? (
        <FalloDeLectura error={documentos.error} alReintentar={() => void documentos.refetch()} />
      ) : documentos.data.length === 0 ? (
        <Vacio titulo={t('evidencias.emitidos.vacio')} />
      ) : (
        <Table aria-label={t('evidencias.emitidos.titulo')}>
          <thead>
            <tr>
              <Th scope="col">{t('evidencias.emitidos.numero')}</Th>
              <Th scope="col">{t('evidencias.emitidos.emitido')}</Th>
              <Th scope="col">{t('evidencias.emitidos.estado')}</Th>
            </tr>
          </thead>
          <tbody>
            {documentos.data.map((d) => (
              <tr key={d.id}>
                <Td className="text-sm">
                  <button
                    type="button"
                    className="text-sg-primary-text underline"
                    aria-label={t('evidencias.emitidos.abrir', { numero: d.number })}
                    onClick={() => setAbierto(d)}
                  >
                    {d.number}
                  </button>
                </Td>
                <Td className="text-sm">{d.issuedAt ? fechaYHoraPe(new Date(d.issuedAt)) : '—'}</Td>
                <Td className="text-sm">{t(`evidencias.emitidos.estados.${d.status}`, { defaultValue: d.status })}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {emite && tipos.data && tipos.data.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo etiqueta={t('evidencias.emitidos.tipo')}>
            {(p) => (
              <SelectNativo
                {...p}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value)
                  emitir.reset()
                }}
                opciones={tipos.data.map((x) => ({ valor: x.name, etiqueta: x.label }))}
              />
            )}
          </Campo>
          <Button size="sm" disabled={!tipo || emitir.isPending} aria-busy={emitir.isPending} onClick={() => emitir.mutate(tipo)}>
            {emitir.isPending ? t('evidencias.emitidos.emitiendo') : t('evidencias.emitidos.emitir')}
          </Button>
        </div>
      ) : null}
      {tipos.isError && !tipos.data ? <FalloDeLectura error={tipos.error} alReintentar={() => void tipos.refetch()} /> : null}
      {emitir.isError ? (
        <Alert tone="danger">{mensaje(emitir.error, Object.fromEntries(NEGATIVAS.map((c) => [c, t(`evidencias.emitidos.errores.${c}`)])))}</Alert>
      ) : null}
      {emitir.isSuccess ? (
        <p role="status" className="text-sm text-sg-success">
          {t('evidencias.emitidos.emitidoListo', { numero: emitir.data.number })}
        </p>
      ) : null}
      <Drawer titulo={abierto?.number ?? ''} abierto={abierto !== null} alCerrar={() => setAbierto(null)}>
        {abierto ? (
          <div className="space-y-3">
            <a href={rutaDeImpresion(abierto)} target="_blank" rel="noopener noreferrer" className="text-sm text-sg-primary-text underline">
              {t('evidencias.emitidos.imprimir')}
            </a>
            <DocumentView snapshot={abierto.snapshot} />
          </div>
        ) : null}
      </Drawer>
    </section>
  )
}
