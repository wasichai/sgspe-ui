import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Campo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { Vacio } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { tamanoPe } from '../datos/archivos'
import { guardarArchivo, usePedir } from '../datos/http'
import { fechaPe, NS } from '../i18n'
import { hallazgosDe, marcaDe, rutaDeLaPlantilla, usePlantillas, useSubirPlantilla, type Hallazgo, type PlantillaSubida } from './contrato'
import { Seccion } from '../componentes/Seccion'

// S64 · Plantillas de entregables (screens.md, api.md §4.12, ASM-135): solo para la administración (isAdmin o MANAGE_METADATA
// sobre deliverable; decisión 20 del plan). una plantilla no se edita ni se borra: subir otra con la misma clave la reemplaza para
// los borradores siguientes. lo que la plantilla puede traer lo fija TemplateStyles del backend: aquí se copia como texto fijo
export const MARCADORES = ['titulo', 'proyecto', 'preparado_para', 'suscrito_por', 'direccion_autora', 'fecha', 'codigo', 'revision', 'nivel', 'mapa_portada']
export const ESTILOS_REQUERIDOS = ['Normal', 'Title', 'heading 1', 'heading 2', 'heading 3', 'caption', 'List Paragraph']
export const FUENTES_PERMITIDAS = ['Carlito', 'Caladea', 'Liberation Sans', 'Liberation Serif']
// spring.webflux.multipart.max-disk-usage-per-part: lo que sube el navegador (ASM-138)
export const TOPE_DE_PLANTILLA = 20 * 1024 * 1024
const CLAVE = /^[a-z0-9][a-z0-9-]{0,63}$/
// la marca del PDF (ASM-140, BrandLogo del backend): PNG o JPEG de hasta 2 MB (nunca SVG) y el acento RRGGBB. los 4000 px por
// lado los juzga el servidor, que lee la cabecera de la imagen
export const TOPE_DE_LOGO = 2 * 1024 * 1024
const TIPOS_DE_LOGO = ['image/png', 'image/jpeg']
const EXTENSION_DE_LOGO = /\.(png|jpe?g)$/i
const ACENTO = /^[0-9A-F]{6}$/
// el acento escrito, sin '#' ni espacios y en mayúsculas: '' si está vacío
const acentoDe = (texto: string) => texto.trim().replace(/^#/, '').toUpperCase()
// el tipo del navegador manda; sin tipo (algunos sistemas no lo dan), la extensión
const esLogoAdmitido = (logo: File) => (logo.type ? TIPOS_DE_LOGO.includes(logo.type) : EXTENSION_DE_LOGO.test(logo.name))

// sin nombre en Content-Disposition, la extensión sale del tipo del archivo: se aceptan .dotx y .docx (menor 1 de la revisión)
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const extensionDe = (blob: Blob) => (blob.type.split(';')[0].trim() === DOCX ? '.docx' : '.dotx')

type Traducir = ReturnType<typeof useTranslation>['t']
const textoDeHallazgo = (t: Traducir, hallazgo: Hallazgo) => {
  const texto = t(`plantillas.codigos.${hallazgo.code}`, { defaultValue: t('plantillas.codigos.otro') })
  return hallazgo.detail ? `${texto}: ${hallazgo.detail}` : texto
}

function TextoDeHallazgo({ hallazgo }: { hallazgo: Hallazgo }) {
  const { t } = useTranslation(NS)
  return <>{textoDeHallazgo(t, hallazgo)}</>
}

// el rechazo de la marca en su campo: con su detalle, o el texto del código de comun.codigos si no lo trae
const textoEnCampo = (t: Traducir, hallazgos: Hallazgo[]) =>
  hallazgos.length === 0 ? undefined : hallazgos.map((h) => (h.detail ? textoDeHallazgo(t, h) : t(`comun.codigos.${h.code}`))).join(' ')

// la muestra del acento: un cuadro del color, con su nombre para el lector de pantalla
function MuestraDeAcento({ color, nombre }: { color: string; nombre: string }) {
  return (
    <span
      role="img"
      aria-label={nombre}
      className="inline-block size-4 shrink-0 rounded-sg-sm border border-sg-border-strong"
      style={{ backgroundColor: `#${color}` }}
    />
  )
}

export function PlantillasPage() {
  const { t } = useTranslation(NS)
  const { isAdmin, can } = useAuth()
  const administra = isAdmin || can('deliverable', 'MANAGE_METADATA')
  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <Link to="/reports" className="text-sm text-sg-primary-text underline">
        {t('plantillas.volver')}
      </Link>
      <h1 className="text-sg-h1 font-semibold">{t('plantillas.titulo')}</h1>
      {administra ? <Plantillas /> : <Alert tone="notice">{t('plantillas.soloAdministracion')}</Alert>}
    </section>
  )
}

function Plantillas() {
  const { t } = useTranslation(NS)
  const plantillas = usePlantillas()
  const pedir = usePedir()
  const mensaje = useMensajeDeError()
  const [subiendo, setSubiendo] = useState(false)
  const [fallo, setFallo] = useState<unknown>(null)
  const descargar = (id: string, clave: string) => {
    setFallo(null)
    return pedir
      .archivo(rutaDeLaPlantilla(id))
      .then((a) => guardarArchivo(a, `${clave}${extensionDe(a.blob)}`))
      .catch(setFallo)
  }
  const titulo = t('plantillas.titulo')
  return (
    <div className="space-y-4">
      <p className="text-sm text-sg-text-secondary">{t('plantillas.ayuda')}</p>
      <Button size="sm" onClick={() => setSubiendo(true)}>
        {t('plantillas.subir')}
      </Button>
      <DeLista consulta={plantillas}>
        {(lista) =>
          lista.length === 0 ? (
            <Vacio titulo={t('plantillas.vacio')} />
          ) : (
            <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
              <Table aria-label={titulo}>
                <thead>
                  <tr>
                    {(['clave', 'nombre', 'huella', 'fecha', 'logo', 'acento', 'avisos', 'acciones'] as const).map((c) => (
                      <Th key={c} scope="col">
                        {t(`plantillas.columnas.${c}`)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id}>
                      <Td className="font-sg-mono text-sm">{p.templateKey}</Td>
                      <Td className="text-sm">{p.name ?? '—'}</Td>
                      <Td className="break-all font-sg-mono text-sg-caption">{p.sha256 ?? '—'}</Td>
                      <Td className="text-sm">{p.createdAt ? fechaPe(new Date(p.createdAt)) : '—'}</Td>
                      <Td className="text-sm">{p.hasLogo ? t('plantillas.conLogo') : t('plantillas.sinLogo')}</Td>
                      <Td className="text-sm">
                        {p.accentColor ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MuestraDeAcento color={p.accentColor} nombre={t('plantillas.muestraDeAcento', { color: `#${p.accentColor}` })} />
                            <span className="font-sg-mono">{`#${p.accentColor}`}</span>
                          </span>
                        ) : (
                          <span className="text-sg-text-muted">{t('plantillas.acentoBase')}</span>
                        )}
                      </Td>
                      <Td className="text-sm">
                        {p.warnings.length === 0 ? (
                          '—'
                        ) : (
                          <ul className="space-y-0.5 text-sg-warning">
                            {p.warnings.map((w, i) => (
                              <li key={i}>
                                <TextoDeHallazgo hallazgo={w} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td className="text-sm">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('plantillas.descargar', { clave: p.templateKey })}
                          onClick={() => void descargar(p.id, p.templateKey)}
                        >
                          {t('plantillas.descargarCorto')}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </DeLista>
      {fallo ? <Alert tone="danger">{mensaje(fallo)}</Alert> : null}
      <Seccion titulo={t('plantillas.reglas.titulo')} className="text-sm">
        <p>{t('plantillas.reglas.ayuda')}</p>
        <h3 className="font-medium">{t('plantillas.reglas.marcadores')}</h3>
        <ul className="flex flex-wrap gap-2 font-sg-mono text-sg-caption">
          {MARCADORES.map((m) => (
            <li key={m}>{`{{${m}}}`}</li>
          ))}
        </ul>
        <h3 className="font-medium">{t('plantillas.reglas.estilos')}</h3>
        <ul className="flex flex-wrap gap-2 font-sg-mono text-sg-caption">
          {ESTILOS_REQUERIDOS.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <h3 className="font-medium">{t('plantillas.reglas.fuentes')}</h3>
        <ul className="flex flex-wrap gap-2 text-sg-caption">
          {FUENTES_PERMITIDAS.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="text-sg-caption text-sg-text-muted">{t('plantillas.reglas.prohibido')}</p>
      </Seccion>
      {subiendo ? <SubirPlantilla alCerrar={() => setSubiendo(false)} /> : null}
    </div>
  )
}

function SubirPlantilla({ alCerrar }: { alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const subir = useSubirPlantilla()
  const mensaje = useMensajeDeError()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [acentoEscrito, setAcentoEscrito] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [aceptada, setAceptada] = useState<PlantillaSubida | null>(null)
  const faltaArchivo = !archivo
    ? t('plantillas.subida.faltaArchivo')
    : archivo.size > TOPE_DE_PLANTILLA
      ? t('plantillas.subida.muyGrande', { tamano: tamanoPe(archivo.size) })
      : undefined
  const claveInvalida = CLAVE.test(clave) ? undefined : t('plantillas.subida.claveInvalida')
  // el tipo y el peso del logo se dicen al elegirlo; el acento, al intentar
  const logoInvalido = !logo
    ? undefined
    : !esLogoAdmitido(logo)
      ? t('plantillas.subida.logoTipo')
      : logo.size > TOPE_DE_LOGO
        ? t('plantillas.subida.logoGrande', { tamano: tamanoPe(logo.size) })
        : undefined
  const acento = acentoDe(acentoEscrito)
  const acentoValido = ACENTO.test(acento)
  const acentoInvalido = acento && !acentoValido ? t('plantillas.subida.acentoInvalido') : undefined
  const rechazo = subir.isError ? hallazgosDe(subir.error) : null
  const marca = marcaDe(rechazo?.violaciones ?? [])
  const enviar = () => {
    setIntentado(true)
    if (faltaArchivo || claveInvalida || logoInvalido || acentoInvalido || !archivo) return
    subir.mutate({ archivo, clave, nombre, logo, acento }, { onSuccess: setAceptada })
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('plantillas.subida.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('plantillas.subida.ayuda')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <Campo etiqueta={t('plantillas.subida.archivo')} error={intentado ? faltaArchivo : undefined}>
            {(p) => (
              <input
                {...p}
                type="file"
                accept=".dotx,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.template,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            )}
          </Campo>
          <Campo etiqueta={t('plantillas.subida.clave')} ayuda={t('plantillas.subida.claveAyuda')} error={intentado ? claveInvalida : undefined}>
            {(p) => <Input {...p} maxLength={64} value={clave} onChange={(e) => setClave(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('plantillas.subida.nombre')}>
            {(p) => <Input {...p} maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('plantillas.subida.logo')} ayuda={t('plantillas.subida.logoAyuda')} error={logoInvalido ?? textoEnCampo(t, marca.logo)}>
            {(p) => <input {...p} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />}
          </Campo>
          <Campo
            etiqueta={t('plantillas.subida.acento')}
            ayuda={t('plantillas.subida.acentoAyuda')}
            error={(intentado ? acentoInvalido : undefined) ?? textoEnCampo(t, marca.acento)}
          >
            {(p) => (
              <div className="flex items-center gap-2">
                {/* la paleta del navegador y el valor escrito son el mismo dato: cada uno sigue al otro */}
                <input
                  type="color"
                  aria-label={t('plantillas.subida.acentoPaleta')}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-sg-md border border-sg-border-strong bg-sg-surface p-1"
                  value={`#${acentoValido ? acento.toLowerCase() : '000000'}`}
                  onChange={(e) => setAcentoEscrito(e.target.value.replace(/^#/, '').toUpperCase())}
                />
                <Input
                  {...p}
                  className="font-sg-mono"
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  value={acentoEscrito}
                  onChange={(e) => setAcentoEscrito(e.target.value)}
                />
              </div>
            )}
          </Campo>
          {acentoValido ? (
            <div className="flex items-center gap-2 rounded-sg-md border border-sg-border bg-sg-surface px-3 py-2">
              <MuestraDeAcento color={acento} nombre={t('plantillas.subida.vistaPrevia', { color: `#${acento}` })} />
              <span className="text-sg-h3 font-semibold" style={{ color: `#${acento}` }}>
                {t('plantillas.subida.tituloDeEjemplo')}
              </span>
            </div>
          ) : null}
          {aceptada ? (
            <div role="status" className="space-y-1 text-sm">
              <p className="text-sg-success">{t('plantillas.subida.aceptada')}</p>
              {aceptada.warnings.length > 0 ? (
                <ul aria-label={t('plantillas.subida.avisos')} className="space-y-0.5 text-sg-warning">
                  {aceptada.warnings.map((w, i) => (
                    <li key={i}>
                      <TextoDeHallazgo hallazgo={w} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {rechazo ? (
            <Alert tone="danger" title={t('plantillas.subida.rechazada')}>
              {marca.resto.length > 0 ? (
                <ul aria-label={t('plantillas.subida.problemas')} className="space-y-0.5">
                  {marca.resto.map((v, i) => (
                    <li key={i}>
                      <TextoDeHallazgo hallazgo={v} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : subir.isError ? (
            <Alert tone="danger">{mensaje(subir.error)}</Alert>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {aceptada ? t('plantillas.subida.listo') : t('comun.cancelar')}
          </Button>
          {aceptada ? null : (
            <Button onClick={enviar} disabled={subir.isPending} aria-busy={subir.isPending}>
              {subir.isPending ? t('plantillas.subida.subiendo') : t('plantillas.subida.confirmar')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
