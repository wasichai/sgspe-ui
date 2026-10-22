import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Campo, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { ConDefiniciones } from '../componentes/LecturaConEstados'
import { codigoDelError } from '../datos/http'
import { campoDe, useDefinicion, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { CLASIFICACIONES_RESTRINGIDAS, TAMANO_MAXIMO, useRegistrarEvidencia, type Vinculo } from './api'
import { leerExif, type DatosDeCaptura } from './exif'

// el alta de una evidencia (S45 «Subir evidencia», S32 acta y fotos de una entrega): archivo, tipo, clasificación y los datos
// descriptivos; la fecha y la ubicación de una foto salen de su EXIF (api.md §4.9). no es un <form>: se usa dentro de otros
// formularios (la entrega de S32) y un formulario anidado se enviaría con el de afuera (revisión del plan 2.3, Tarea 7). los
// errores se dicen junto a su control y lo demás en un aviso; nada se envía con un dato obligatorio vacío ni con un archivo de
// más de 20 MB (P52). con una clasificación restringida el archivo viaja con un nombre neutro (P59) y el formulario lo avisa
// los tipos de archivo de evidence.file (plan 3.1: PDF, imágenes, CSV, texto, DOCX, XLSX, ODT y ODS). el servidor los comprueba
// por sus bytes: esto solo orienta el selector de archivos
const TIPOS_ADMITIDOS = [
  'application/pdf',
  'image/*',
  'text/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet'
].join(',')

const esquema = (conMotivo: boolean) =>
  z.object({
    evidence_type: z.string().min(1),
    classification: z.string().min(1),
    title: z.string(),
    document_date: z.string(),
    author: z.string(),
    people_identifiable: z.boolean(),
    photo_consent_given: z.boolean(),
    motivo: conMotivo ? z.string().trim().min(1) : z.string()
  })
type Valores = z.infer<ReturnType<typeof esquema>>

const VACIO: Valores = {
  evidence_type: '',
  classification: '',
  title: '',
  document_date: '',
  author: '',
  people_identifiable: false,
  photo_consent_given: false,
  motivo: ''
}

export interface FormularioDeEvidenciaProps {
  vinculos?: Vinculo[]
  // el tipo que se propone (FOTO para una foto de entrega, ACTA DE ENTREGA para el acta, FORMULARIO para el cargo de una queja)
  tipoInicial?: string
  // la clasificación que se propone: DATOS PERSONALES para el cargo o la carta firmados de una QCS (ASM-098), que pueden vincularse a
  // una QCS confidencial solo si son restringidos (EVIDENCE_NOT_RESTRICTED)
  clasificacionInicial?: string
  // el vínculo con un objeto requiresReason exige motivo
  conMotivo?: boolean
  // el proyecto de la evidencia, si es de un proyecto
  proyecto?: string
  // la evidencia a la que esta reemplaza: una versión nueva (RF-DOC-001)
  reemplaza?: string
  alRegistrar: (evidencia: Registro) => void
  alCancelar?: () => void
}

export function FormularioDeEvidencia(props: FormularioDeEvidenciaProps) {
  const definicion = useDefinicion('evidence')
  return <ConDefiniciones definiciones={[definicion]}>{() => <Formulario {...props} />}</ConDefiniciones>
}

function Formulario({
  vinculos,
  tipoInicial = '',
  clasificacionInicial = '',
  conMotivo = false,
  proyecto,
  reemplaza,
  alRegistrar,
  alCancelar
}: FormularioDeEvidenciaProps) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion('evidence')
  const alta = useRegistrarEvidencia()
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [captura, setCaptura] = useState<DatosDeCaptura>({})
  const [faltaArchivo, setFaltaArchivo] = useState(false)
  const { register, handleSubmit, control, formState, reset } = useForm<Valores>({
    resolver: zodResolver(esquema(conMotivo)),
    defaultValues: { ...VACIO, evidence_type: tipoInicial, classification: clasificacionInicial }
  })
  const personas = useWatch({ control, name: 'people_identifiable' })
  const clasificacion = useWatch({ control, name: 'classification' })
  const muyGrande = archivo !== null && archivo.size > TAMANO_MAXIMO
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const lee = (campo: string) => campoDe(definicion.data, campo) !== undefined

  // lo que el servidor dijo de un campo: la subida, sobre `file`; el registro, sobre attributes.<campo> o `reason`
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(alta.error)).map(([campo, texto]) => [campo.replace(/^attributes\./, ''), texto]))
  // FILE_TOO_LARGE es también el de las importaciones de F2: aquí se dice con el tope de la evidencia
  if (codigoDelError(alta.error) === 'FILE_TOO_LARGE') delServidor.file = t('evidencias.archivoMuyGrande')
  const conocidos = ['file', 'evidence_type', 'classification', 'title', 'document_date', 'author', 'reason']
  const alPie = alta.error && !Object.keys(delServidor).some((c) => conocidos.includes(c))
  const error = (campo: keyof Valores, servidor: string = campo) =>
    delServidor[servidor] ?? (formState.errors[campo] ? (campo === 'motivo' ? t('comun.motivoFalta') : t('evidencias.opcionFalta')) : undefined)

  const elegir = async (elegido: File | null) => {
    setArchivo(elegido)
    setFaltaArchivo(false)
    // el error de la subida anterior (FILE_TOO_LARGE, EVIDENCE_FILE_IN_USE) era de otro archivo
    alta.limpiarError()
    setCaptura(elegido ? await leerExif(elegido) : {})
  }

  const enviar = handleSubmit(
    async (v) => {
      if (!archivo) {
        setFaltaArchivo(true)
        return
      }
      if (muyGrande) return
      const registrada = await alta.registrar({
        archivo,
        atributos: {
          evidence_type: v.evidence_type,
          classification: v.classification,
          title: v.title.trim(),
          document_date: v.document_date,
          author: v.author.trim(),
          people_identifiable: v.people_identifiable,
          photo_consent_given: v.people_identifiable ? v.photo_consent_given : null,
          captured_at: captura.capturadoEn,
          project: proyecto,
          replaces: reemplaza
        },
        ubicacion: captura.ubicacion,
        vinculos,
        motivo: conMotivo ? v.motivo.trim() : undefined
      })
      if (!registrada) return
      reset({ ...VACIO, evidence_type: tipoInicial, classification: clasificacionInicial })
      setArchivo(null)
      setCaptura({})
      alta.nuevaAccion()
      alRegistrar(registrada)
    },
    () => {
      if (!archivo) setFaltaArchivo(true)
    }
  )

  return (
    <div role="group" aria-label={t('evidencias.subirTitulo')} className="space-y-3">
      <p className="text-sg-caption text-sg-text-muted">{t('evidencias.subirAyuda')}</p>
      <Campo
        etiqueta={t('evidencias.archivo')}
        error={delServidor.file ?? (faltaArchivo ? t('evidencias.archivoFalta') : muyGrande ? t('evidencias.archivoMuyGrande') : undefined)}
      >
        {(p) => <input {...p} type="file" accept={TIPOS_ADMITIDOS} onChange={(e) => void elegir(e.target.files?.[0] ?? null)} />}
      </Campo>
      {captura.capturadoEn ? <p className="text-sg-caption">{t('evidencias.capturada', { fecha: fechaYHoraPe(new Date(captura.capturadoEn)) })}</p> : null}
      {captura.ubicacion ? (
        <p className="text-sg-caption">{t('evidencias.conUbicacion', { lat: captura.ubicacion[1].toFixed(5), lon: captura.ubicacion[0].toFixed(5) })}</p>
      ) : null}
      <Campo etiqueta={t('evidencias.tipo')} error={error('evidence_type')}>
        {(p) => <SelectNativo {...p} {...register('evidence_type')} opciones={opciones('evidence_type')} />}
      </Campo>
      <Campo etiqueta={t('evidencias.clasificacion')} error={error('classification')}>
        {(p) => <SelectNativo {...p} {...register('classification')} opciones={opciones('classification')} />}
      </Campo>
      {CLASIFICACIONES_RESTRINGIDAS.includes(clasificacion) ? <p className="text-sg-caption">{t('evidencias.nombreNeutro')}</p> : null}
      {lee('title') ? (
        <Campo etiqueta={t('evidencias.tituloDelDocumento')} error={error('title')}>
          {(p) => <Input {...p} {...register('title')} maxLength={300} />}
        </Campo>
      ) : null}
      {lee('document_date') ? (
        <Controller
          control={control}
          name="document_date"
          render={({ field }) => (
            <CampoFecha
              etiqueta={t('evidencias.fechaDelDocumento')}
              error={error('document_date')}
              valor={field.value || null}
              alCambiar={(v) => field.onChange(v ?? '')}
            />
          )}
        />
      ) : null}
      {lee('author') ? (
        <Campo etiqueta={t('evidencias.autor')} error={error('author')}>
          {(p) => <Input {...p} {...register('author')} maxLength={200} />}
        </Campo>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('people_identifiable')} />
        {t('evidencias.personas')}
      </label>
      {personas ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('photo_consent_given')} />
          {t('evidencias.consentimiento')}
        </label>
      ) : null}
      {conMotivo ? (
        <Campo etiqueta={t('comun.motivoObligatorio')} error={error('motivo', 'reason')}>
          {(p) => <Textarea {...p} {...register('motivo')} maxLength={500} />}
        </Campo>
      ) : null}
      {alPie ? <Alert tone="danger">{mensaje(alta.error)}</Alert> : null}
      <div className="flex justify-end gap-2">
        {alCancelar ? (
          <Button type="button" variant="secondary" onClick={alCancelar} disabled={alta.enCurso}>
            {t('comun.cancelar')}
          </Button>
        ) : null}
        <Button type="button" onClick={() => void enviar()} disabled={alta.enCurso} aria-busy={alta.enCurso}>
          {alta.enCurso ? t('evidencias.registrando') : t('evidencias.subir')}
        </Button>
      </div>
    </div>
  )
}
