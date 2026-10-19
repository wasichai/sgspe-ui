import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMensajeDeError } from '../componentes/errores'
import { Vacio } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { DocumentosEmitidos } from '../documentos/DocumentosEmitidos'
import { guardarArchivo, usePedir } from '../datos/http'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { rutaDeLaVersion, seccionDelTipo, useTiposDeEntregable, type FormatoDeArchivo } from './contrato'
import { rotuloDeOpcion } from '../datos/opciones'
import { Huella } from '../componentes/Huella'
import { Persona } from '../componentes/Persona'

// las versiones emitidas de S50 (deliverables.md §8.4 y §12): cada una con su número, su revisión, su nivel, quién y cuándo, la
// huella de su PDF y las secciones asistidas por IA. las descargas, por nivel y permiso: INTERNO (PDF y DOCX) con
// DOWNLOAD_RESTRICTED, EXTERNO (solo PDF) con EXPORT; cada una queda en export_log. la constancia de AUT-12 es un documento
// emitido del entregable (DocumentosEmitidos, sin emitir a mano: decisión 14 del plan)
export function Versiones({ entregable }: { entregable: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const pedir = usePedir()
  const mensaje = useMensajeDeError()
  const versiones = useTodos('deliverable_version', { deliverable: entregable.id, sort: 'version_number', dir: 'desc' })
  const [fallo, setFallo] = useState<unknown>(null)
  // ai_assisted_sections guarda las claves, una por línea (DeliverableIssue): se dicen por su título del tipo y, si el tipo ya no
  // trae la clave (o no se pudo leer), por la clave
  const tipos = useTiposDeEntregable()
  const conIa = (v: Registro) =>
    texto(v, 'ai_assisted_sections')
      .split('\n')
      .map((clave) => clave.trim())
      .filter(Boolean)
      .map((clave) => seccionDelTipo(tipos.data, texto(entregable, 'deliverable_type'), clave)?.title ?? clave)
      .join(', ')
  const formatos = (nivel: string): FormatoDeArchivo[] =>
    nivel === 'INTERNO' ? (can('deliverable', 'DOWNLOAD_RESTRICTED') ? ['pdf', 'docx'] : []) : can('deliverable', 'EXPORT') ? ['pdf'] : []
  const descargar = (numero: number, formato: FormatoDeArchivo) => {
    setFallo(null)
    return pedir
      .archivo(rutaDeLaVersion(entregable.id, numero, formato))
      .then((a) => guardarArchivo(a, `${texto(entregable, 'document_code') || 'entregable'}-v${numero}.${formato}`))
      .catch(setFallo)
  }
  const titulo = t('entregables.versiones.titulo')
  return (
    <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      <DeLista consulta={versiones}>
        {(lista) =>
          lista.length === 0 ? (
            <Vacio titulo={t('entregables.versiones.vacio')} />
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label={titulo}>
                <thead>
                  <tr>
                    {(['numero', 'revision', 'nivel', 'emitida', 'quien', 'huella', 'conIa', 'descargas'] as const).map((c) => (
                      <Th key={c} scope="col">
                        {t(`entregables.versiones.columnas.${c}`)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((v) => {
                    const numero = Number(atributo(v, 'version_number'))
                    const nivel = texto(v, 'disclosure_level')
                    return (
                      <tr key={v.id}>
                        <Td className="text-sm tabular-nums">{numero}</Td>
                        <Td className="text-sm">{texto(v, 'revision')}</Td>
                        <Td className="text-sm">{rotuloDeOpcion(nivel)}</Td>
                        <Td className="text-sm">{texto(v, 'issued_at') ? fechaYHoraPe(new Date(texto(v, 'issued_at'))) : '—'}</Td>
                        <Td className="text-sm">
                          <Persona correo={texto(v, 'issued_by_user_email')} />
                        </Td>
                        <Td>{texto(v, 'pdf_sha256') ? <Huella valor={texto(v, 'pdf_sha256')} /> : '—'}</Td>
                        <Td className="text-sm">{conIa(v) || '—'}</Td>
                        <Td className="text-sm">
                          <div className="flex flex-wrap gap-1">
                            {formatos(nivel).map((f) => (
                              <Button key={f} size="sm" variant="ghost" onClick={() => void descargar(numero, f)}>
                                {t('entregables.versiones.descargar', { formato: f.toUpperCase(), numero })}
                              </Button>
                            ))}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )
        }
      </DeLista>
      {fallo ? <Alert tone="danger">{mensaje(fallo)}</Alert> : null}
      <DocumentosEmitidos objeto="deliverable" registroId={entregable.id} escribe={false} />
    </section>
  )
}
