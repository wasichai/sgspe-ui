import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { ChipDeEstado, EstadoChip } from '../componentes/EstadoChip'
import { useMensajeDeError } from '../componentes/errores'
import { Consulta, NoEsDeSusProyectos, Vacio } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { Seccion } from '../componentes/Seccion'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { guardarArchivo, usePedir } from '../datos/http'
import { rotuloDeOpcion } from '../datos/opciones'
import { atributo, texto, useRegistro, useTodos, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { pedirPantallaCompleta, Presentador } from '../presentaciones/Presentador'
import {
  accionDelNivel,
  estaPendiente,
  nivelesPosibles,
  pideLista,
  PUBLICOS,
  rutaDeLaPresentacion,
  usePedirPresentacion,
  usePedirVideo,
  usePresentaciones,
  type ArchivoDePresentacion,
  type NivelDePresentacion,
  type Presentacion,
  type Publico
} from './contrato'
import { rutaDeEntregable } from './tipos'

// las presentaciones de un entregable emitido (deliverables.md §16, ADR-0031, api.md §4.12): pedir una de una versión para un
// público y un nivel, ver su estado (se consulta cada 5 s mientras alguna se compone), bajar el PDF de láminas, pedir y bajar el
// MP4, y presentar en el navegador con el Player de Remotion. EXTERNO y PUBLICO piden la lista de verificación al ver o bajar, no
// al pedir (ASM-147), una vez por presentación mientras la página está abierta: cada descarga la lleva confirmada a export_log.
// el PDF es la referencia y la copia sin conexión: la página lo dice siempre. pedir exige CREATE sobre deliverable_presentation,
// la acción de descarga del nivel y la asignación vigente; bajar y presentar, la acción del nivel
const LISTA = ['laminas', 'fotos', 'mapas'] as const

type Accion = { tipo: 'bajar'; archivo: Exclude<ArchivoDePresentacion, 'spec'> } | { tipo: 'presentar' }

export function PresentacionesPage() {
  const { t } = useTranslation(NS)
  const { projectId, deliverableId = '' } = useParams()
  const entregable = useRegistro('deliverable', deliverableId)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <Link to={rutaDeEntregable(deliverableId, projectId)} className="text-sm text-sg-primary-text underline">
        {t('presentaciones.pagina.volver')}
      </Link>
      <Consulta consulta={entregable} noExiste={<NoEsDeSusProyectos />}>
        {(e) => <Presentaciones entregable={e} />}
      </Consulta>
    </section>
  )
}

function Presentaciones({ entregable }: { entregable: Registro }) {
  const { t } = useTranslation(NS)
  const versiones = useTodos('deliverable_version', { deliverable: entregable.id, sort: 'version_number', dir: 'desc' })
  const codigo = texto(entregable, 'document_code')
  return (
    <div className="space-y-4">
      <EncabezadoDePagina
        ficha
        antetitulo={[codigo, texto(entregable, 'title')].filter(Boolean).join(' · ')}
        titulo={t('presentaciones.pagina.titulo')}
        descripcion={t('presentaciones.pagina.ayuda')}
        chips={<EstadoChip objeto="deliverable" estado={entregable.state} />}
      />
      <Alert tone="notice">{t('presentaciones.pagina.sinConexion')}</Alert>
      <DeLista consulta={versiones}>
        {(lista) =>
          lista.length === 0 ? (
            <Vacio titulo={t('presentaciones.pagina.sinVersiones')} />
          ) : (
            <>
              <PedirPresentacion entregable={entregable} versiones={lista} />
              <ListaDePresentaciones entregable={entregable} codigo={codigo} />
            </>
          )
        }
      </DeLista>
    </div>
  )
}

function PedirPresentacion({ entregable, versiones }: { entregable: Registro; versiones: Registro[] }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const mensaje = useMensajeDeError()
  const escribe = useEscribeEnProyecto(texto(entregable, 'project') || undefined)
  const pedir = usePedirPresentacion(entregable.id)
  const numeroDe = (v: Registro) => String(atributo(v, 'version_number') ?? '')
  const [numero, setNumero] = useState(() => numeroDe(versiones[0]))
  const [publico, setPublico] = useState<Publico>('DIRECCION')
  const [nivel, setNivel] = useState<NivelDePresentacion | ''>('')
  const [pedida, setPedida] = useState(false)
  const version = versiones.find((v) => numeroDe(v) === numero) ?? versiones[0]
  // los niveles que el público admite sobre el de la versión y que quien pide puede bajar
  const niveles = nivelesPosibles(texto(version, 'disclosure_level'), publico).filter((n) => can('deliverable', accionDelNivel(n)))
  const elegido = nivel && niveles.includes(nivel) ? nivel : niveles[0]
  const titulo = t('presentaciones.pedir.titulo')
  if (!can('deliverable_presentation', 'CREATE') || !escribe)
    return (
      <Seccion titulo={titulo}>
        <p className="text-sm text-sg-text-secondary">{t('presentaciones.pedir.sinPermiso')}</p>
      </Seccion>
    )
  // otra elección es otra acción: una clave nueva y sin el error ni el aviso de la anterior
  const cambiar = (fijar: () => void) => {
    fijar()
    setPedida(false)
    pedir.nuevaAccion()
  }
  const enviar = () => {
    if (!elegido) return
    pedir.mutate({ numero: Number(numeroDe(version)), publico, nivel: elegido }, { onSuccess: () => setPedida(true) })
  }
  return (
    <Seccion titulo={titulo} descripcion={t('presentaciones.pedir.ayuda')}>
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        <Campo etiqueta={t('presentaciones.pedir.version')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={numeroDe(version)}
              onChange={(e) => cambiar(() => setNumero(e.target.value))}
              opciones={versiones.map((v) => ({
                valor: numeroDe(v),
                etiqueta: t('presentaciones.pedir.versionOpcion', {
                  numero: numeroDe(v),
                  revision: texto(v, 'revision') || '—',
                  nivel: rotuloDeOpcion(texto(v, 'disclosure_level'))
                })
              }))}
            />
          )}
        </Campo>
        <Campo etiqueta={t('presentaciones.pedir.publico')} ayuda={t(`presentaciones.publicos.${publico}.ayuda`)}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={publico}
              onChange={(e) => cambiar(() => setPublico(e.target.value as Publico))}
              opciones={PUBLICOS.map((x) => ({ valor: x, etiqueta: t(`presentaciones.publicos.${x}.nombre`) }))}
            />
          )}
        </Campo>
        <Campo etiqueta={t('presentaciones.pedir.nivel')} ayuda={niveles.length === 0 ? t('presentaciones.pedir.sinNiveles') : undefined}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              disabled={niveles.length === 0}
              value={elegido ?? ''}
              onChange={(e) => cambiar(() => setNivel(e.target.value as NivelDePresentacion))}
              opciones={niveles}
            />
          )}
        </Campo>
        <div className="flex flex-wrap items-center gap-3 md:col-span-3">
          <Button type="submit" disabled={!elegido || pedir.isPending} aria-busy={pedir.isPending}>
            {pedir.isPending ? t('presentaciones.pedir.pidiendo') : t('presentaciones.pedir.boton')}
          </Button>
          {pedida ? (
            <p role="status" className="text-sm text-sg-success">
              {t('presentaciones.pedir.hecho')}
            </p>
          ) : null}
        </div>
        {pedir.isError ? (
          <div className="md:col-span-3">
            <Alert tone="danger">{mensaje(pedir.error)}</Alert>
          </div>
        ) : null}
      </form>
    </Seccion>
  )
}

function ListaDePresentaciones({ entregable, codigo }: { entregable: Registro; codigo: string }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const mensaje = useMensajeDeError()
  const presentaciones = usePresentaciones(entregable.id)
  // las presentaciones cuya lista ya se confirmó en esta visita
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [porConfirmar, setPorConfirmar] = useState<{ presentacion: Presentacion; accion: Accion } | null>(null)
  const [presentando, setPresentando] = useState<Presentacion | null>(null)
  const [fallo, setFallo] = useState<unknown>(null)
  const publicoDe = (p: Presentacion) => (p.audience ? t(`presentaciones.publicos.${p.audience}.nombre`, { defaultValue: p.audience }) : '—')
  const etiquetaDe = (p: Presentacion) =>
    t('presentaciones.presentador.titulo', { codigo: codigo || '—', publico: publicoDe(p), nivel: rotuloDeOpcion(p.level ?? '') })
  const hacer = (p: Presentacion, accion: Accion, confirmada: boolean) => {
    setFallo(null)
    if (accion.tipo === 'presentar') {
      pedirPantallaCompleta()
      setPresentando(p)
      return
    }
    const extension = accion.archivo === 'video' ? 'mp4' : 'pdf'
    void pedir
      .archivo(rutaDeLaPresentacion(p.id, accion.archivo, confirmada))
      .then((a) => guardarArchivo(a, `${codigo || 'presentacion'}-${(p.audience ?? '').toLowerCase()}-${(p.level ?? '').toLowerCase()}.${extension}`))
      .catch(setFallo)
  }
  // lo que pide la lista de verificación la muestra primero; lo demás (INTERNO, o ya confirmada) va directo
  const pedirAccion = (p: Presentacion, accion: Accion) => {
    if (pideLista(p.level ?? '') && !confirmadas.has(p.id)) setPorConfirmar({ presentacion: p, accion })
    else hacer(p, accion, pideLista(p.level ?? ''))
  }
  const titulo = t('presentaciones.lista.titulo')
  return (
    <Seccion titulo={titulo}>
      <DeLista consulta={presentaciones}>
        {(lista) =>
          lista.length === 0 ? (
            <Vacio titulo={t('presentaciones.lista.vacio')} />
          ) : (
            <>
              {lista.some((p) => estaPendiente(p.status) || estaPendiente(p.videoStatus)) && !presentaciones.isError ? (
                <p role="status" className="text-sm text-sg-text-secondary">
                  {t('presentaciones.lista.consultando')}
                </p>
              ) : null}
              {presentaciones.isError ? (
                <Alert tone="warning">
                  {t('presentaciones.lista.sinActualizar')}
                  <Button size="sm" variant="secondary" className="ml-2" onClick={() => void presentaciones.refetch()}>
                    {t('comun.reintentar')}
                  </Button>
                </Alert>
              ) : null}
              <div className="overflow-x-auto">
                <Table aria-label={titulo}>
                  <thead>
                    <tr>
                      {(['version', 'publico', 'nivel', 'estado', 'laminas', 'pedida', 'acciones'] as const).map((c) => (
                        <Th key={c} scope="col">
                          {t(`presentaciones.lista.columnas.${c}`)}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p) => (
                      <FilaDePresentacion
                        key={p.id}
                        entregable={entregable}
                        presentacion={p}
                        publico={publicoDe(p)}
                        alPedirAccion={(accion) => pedirAccion(p, accion)}
                      />
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )
        }
      </DeLista>
      {fallo ? <Alert tone="danger">{mensaje(fallo)}</Alert> : null}
      {porConfirmar ? (
        <ListaDeVerificacion
          nivel={porConfirmar.presentacion.level ?? ''}
          alCancelar={() => setPorConfirmar(null)}
          alConfirmar={() => {
            const { presentacion, accion } = porConfirmar
            setConfirmadas((antes) => new Set(antes).add(presentacion.id))
            setPorConfirmar(null)
            hacer(presentacion, accion, true)
          }}
        />
      ) : null}
      {presentando ? (
        <Presentador
          presentacion={presentando.id}
          etiqueta={etiquetaDe(presentando)}
          listaConfirmada={pideLista(presentando.level ?? '')}
          alCerrar={() => setPresentando(null)}
        />
      ) : null}
    </Seccion>
  )
}

function FilaDePresentacion({
  entregable,
  presentacion: p,
  publico,
  alPedirAccion
}: {
  entregable: Registro
  presentacion: Presentacion
  publico: string
  alPedirAccion: (accion: Accion) => void
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const mensaje = useMensajeDeError()
  const escribe = useEscribeEnProyecto(texto(entregable, 'project') || undefined)
  const otraVez = usePedirPresentacion(entregable.id)
  const video = usePedirVideo(entregable.id)
  const nivel = p.level ?? ''
  const baja = can('deliverable', accionDelNivel(nivel))
  const pide = baja && escribe && can('deliverable_presentation', 'CREATE')
  const pideVideo = pide && can('deliverable_presentation', 'UPDATE')
  const lista = p.status === 'LISTO'
  const motivo = (codigo: string | null) => t(`presentaciones.fallas.${codigo ?? 'otro'}`, { defaultValue: t('presentaciones.fallas.otro') })
  const error = otraVez.error ?? video.error
  return (
    <tr>
      <Td className="text-sm tabular-nums">{p.versionNumber ?? '—'}</Td>
      <Td className="text-sm">{publico}</Td>
      <Td className="text-sm">{nivel ? rotuloDeOpcion(nivel) : '—'}</Td>
      <Td className="text-sm">
        <div className="space-y-1">
          {p.status ? <ChipDeEstado objeto="deliverable_presentation" estado={p.status} etiqueta={rotuloDeOpcion(p.status)} /> : '—'}
          {p.status === 'FALLIDO' ? <p className="text-sg-caption text-sg-danger">{t('presentaciones.fallo', { motivo: motivo(p.failureCode) })}</p> : null}
        </div>
      </Td>
      <Td className="text-sm tabular-nums">{p.slideCount ?? '—'}</Td>
      <Td className="text-sm">{p.requestedAt ? fechaYHoraPe(new Date(p.requestedAt)) : '—'}</Td>
      <Td className="text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {lista && baja ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => alPedirAccion({ tipo: 'presentar' })}>
                {t('presentaciones.acciones.presentar')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => alPedirAccion({ tipo: 'bajar', archivo: 'content' })}>
                {t('presentaciones.acciones.bajarPdf')}
              </Button>
              {p.videoStatus === 'LISTO' ? (
                <Button size="sm" variant="ghost" onClick={() => alPedirAccion({ tipo: 'bajar', archivo: 'video' })}>
                  {t('presentaciones.acciones.bajarVideo')}
                </Button>
              ) : null}
            </>
          ) : null}
          {lista && estaPendiente(p.videoStatus) ? (
            <span className="text-sg-caption text-sg-text-secondary">
              {p.videoStatus === 'EN COLA' ? t('presentaciones.video.enCola') : t('presentaciones.video.enProceso')}
            </span>
          ) : null}
          {lista && p.videoStatus === 'FALLIDO' ? (
            <span className="text-sg-caption text-sg-danger">{t('presentaciones.video.fallido', { motivo: motivo(p.videoFailureCode) })}</span>
          ) : null}
          {lista && pideVideo && (p.videoStatus === null || p.videoStatus === 'FALLIDO') ? (
            <Button size="sm" variant="ghost" disabled={video.isPending} onClick={() => video.mutate({ presentacion: p.id })}>
              {t('presentaciones.acciones.pedirVideo')}
            </Button>
          ) : null}
          {p.status === 'FALLIDO' && pide && p.versionNumber !== null && p.audience && nivel ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={otraVez.isPending}
              onClick={() => otraVez.mutate({ numero: p.versionNumber as number, publico: p.audience as Publico, nivel: nivel as NivelDePresentacion })}
            >
              {t('presentaciones.acciones.otraVez')}
            </Button>
          ) : null}
          {lista && !baja ? <span className="text-sg-caption text-sg-text-muted">{t('presentaciones.acciones.sinDescarga')}</span> : null}
        </div>
        {error ? <p className="text-sg-caption text-sg-danger">{mensaje(error)}</p> : null}
      </Td>
    </tr>
  )
}

function ListaDeVerificacion({ nivel, alCancelar, alConfirmar }: { nivel: string; alCancelar: () => void; alConfirmar: () => void }) {
  const { t } = useTranslation(NS)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const alternar = (clave: string) => {
    const siguiente = new Set(marcadas)
    if (siguiente.has(clave)) siguiente.delete(clave)
    else siguiente.add(clave)
    setMarcadas(siguiente)
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCancelar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('presentaciones.verificacion.titulo', { nivel: rotuloDeOpcion(nivel) })}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('presentaciones.verificacion.ayuda')}</DialogDescription>
        <fieldset className="mt-4 space-y-2 text-sm">
          {LISTA.map((c) => (
            <div key={c} className="flex items-start gap-2">
              <input type="checkbox" id={`verificacion-${c}`} className="mt-1" checked={marcadas.has(c)} onChange={() => alternar(c)} />
              <label htmlFor={`verificacion-${c}`}>{t(`presentaciones.verificacion.${c}`)}</label>
            </div>
          ))}
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCancelar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={alConfirmar} disabled={!LISTA.every((c) => marcadas.has(c))}>
            {t('presentaciones.verificacion.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
