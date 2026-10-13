import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { texto, useRegistros, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { useAsistente } from './Asistente'
import { useCorrida, useEstadoDeIa } from './contrato'
import { FalloDeCorrida } from './FalloDeCorrida'
import { MarcaDeIa } from './MarcaDeIa'
import { partirMarcadores, personasCitadas } from './marcadores'
import { TextoDeIa, useNombresDePersonas } from './TextoDeIa'

// el resumen ejecutivo del proyecto en S08 (AI-04, screens.md «Resumen ejecutivo y borrador de sección»): no es un dato; solo
// informa y no se acepta mientras no lo use una sección de entregable (F8, decisión 18 del plan). cuenta solo lo que la persona
// lee y no menciona posturas (lo garantiza el servidor). sin IA, la tarjeta no aparece
export function ResumenEjecutivo({ proyecto }: { proyecto: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const estado = useEstadoDeIa()
  const escribe = useEscribeEnProyecto(proyecto.id)
  const asistente = useAsistente()
  const corrida = useCorrida()
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null)
  const lee = can('ai_suggestion', 'READ')
  const activa = estado.data?.enabled === true
  const resumenes = useRegistros(
    'ai_suggestion',
    { project: proyecto.id, target_object: 'project', suggestion_kind: 'RESUMEN EJECUTIVO', sort: 'created_at', dir: 'desc', size: 1 },
    lee && activa
  )
  const ultimo = resumenes.data?.content[0]
  const contenido = texto(ultimo, 'suggested_value')
  const { nombres } = useNombresDePersonas(personasCitadas(contenido))
  if (!estado.data || !activa) return null
  const genera = escribe && estado.data.useCases.includes('AI-04')
  const documentos = asistente !== null && estado.data.useCases.includes('AI-06')
  if (!lee && !genera && !documentos) return null
  // lo que se copia es lo que se ve: las personas como las dice la tarjeta y los reservados con su texto
  const comoSeVe = () =>
    partirMarcadores(contenido)
      .map((s) => (s.tipo === 'texto' ? s.texto : s.tipo === 'persona' ? (nombres.get(s.id)?.visible ?? '') : t(`ia.marcadores.${s.clase}`)))
      .join('')
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoSeVe())
      setCopiado('si')
    } catch {
      setCopiado('no')
    }
  }
  return (
    <section aria-label={t('accionesIa.resumen.titulo')} className="space-y-2 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-ai-soft p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MarcaDeIa clase="resumen" />
          <h2 className="text-sg-h3 font-semibold">{t('accionesIa.resumen.titulo')}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {genera ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!estado.data.providerAvailable || corrida.isPending}
              aria-busy={corrida.isPending}
              onClick={() => corrida.mutate({ caso: 'AI-04', objetivo: { object: 'project', recordId: proyecto.id } })}
            >
              {corrida.isPending ? t('accionesIa.resumen.generando') : ultimo ? t('accionesIa.resumen.generarDeNuevo') : t('accionesIa.resumen.generar')}
            </Button>
          ) : null}
          {ultimo ? (
            <Button size="sm" variant="ghost" onClick={() => void copiar()}>
              {t('accionesIa.resumen.copiar')}
            </Button>
          ) : null}
          {documentos ? (
            <Button size="sm" variant="ghost" onClick={() => asistente?.abrir({ modo: 'documentos', proyecto: proyecto.id })}>
              {t('accionesIa.resumen.documentos')}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-sg-caption text-sg-text-secondary">{t('accionesIa.resumen.ayuda')}</p>
      {genera && !estado.data.providerAvailable ? <p className="text-sg-caption text-sg-warning">{t('accionesIa.proveedorCaido')}</p> : null}
      {lee ? (
        resumenes.isPending ? (
          <Cargando compacto />
        ) : resumenes.isError && !resumenes.data ? (
          <FalloDeLectura error={resumenes.error} alReintentar={() => void resumenes.refetch()} />
        ) : ultimo ? (
          <>
            <p className="text-sg-caption text-sg-text-muted">
              {t('accionesIa.resumen.redactado', { fecha: ultimo.createdAt ? fechaYHoraPe(new Date(ultimo.createdAt)) : '—' })}
            </p>
            <TextoDeIa texto={contenido} markdown />
          </>
        ) : (
          <p className="text-sg-text-secondary">{t('accionesIa.resumen.vacio')}</p>
        )
      ) : null}
      {corrida.isError ? (
        <FalloDeCorrida
          error={corrida.error}
          alReintentar={genera ? () => corrida.mutate({ caso: 'AI-04', objetivo: { object: 'project', recordId: proyecto.id } }) : null}
        />
      ) : null}
      {copiado ? (
        <p role="status" className="text-sg-caption">
          {copiado === 'si' ? t('accionesIa.resumen.copiado') : t('accionesIa.resumen.noCopiado')}
        </p>
      ) : null}
    </section>
  )
}
