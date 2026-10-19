import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { texto, useCrear, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { usePlantillas, useTiposDeEntregable } from './contrato'
import { PARAMETROS, rutaDeEntregable, T1 } from './tipos'
import { opcion } from '../datos/opciones'

// «Nuevo entregable» de S49 (screens.md): el tipo (de los que registra el backend, GET /api/sgspe/deliverable-types), código, título, periodo, corte, el alcance que pide el tipo (PARAMETROS: la
// comunidad en T2; el estudio y un AIDS aprobado en T1, que el pedido del borrador exige), las organizaciones y la plantilla
// (vacía: la base de SGSPE). deliverable es requiresReason: el alta lleva motivo. el listener del backend crea las secciones del
// tipo en la misma transacción; al terminar se abre S50
type Alcance = { comunidad: Registro | null; estudio: string; area: string; preparadoPara: Registro | null; suscritoPor: Registro | null }

export function NuevoEntregable({ proyecto, alCerrar }: { proyecto: string; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const { scope } = useContextFilters()
  const crear = useCrear('deliverable')
  const plantillas = usePlantillas()
  // los tipos que el backend registra (decisión 1 del plan), no una lista del portal
  const tipos = useTiposDeEntregable()
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const [tipo, setTipo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [corte, setCorte] = useState('')
  const [plantilla, setPlantilla] = useState('')
  const [motivo, setMotivo] = useState('')
  const [alcance, setAlcance] = useState<Alcance>({ comunidad: null, estudio: '', area: '', preparadoPara: null, suscritoPor: null })
  const [intentado, setIntentado] = useState(false)
  const pide = PARAMETROS[tipo] ?? []
  const estudios = useTodos('study', { project: proyecto }, pide.includes('study'))
  const areas = useTodos('area_of_influence', { project: proyecto, area_type: 'AIDS' }, pide.includes('area_of_influence'))
  const aprobadas = (areas.data ?? []).filter((a) => a.state === 'approved')
  const faltas: Record<string, string> = {
    ...(tipo ? {} : { tipo: t('entregables.nuevo.faltaTipo') }),
    ...(codigo.trim() ? {} : { codigo: t('entregables.nuevo.faltaCodigo') }),
    ...(titulo.trim() ? {} : { titulo: t('entregables.nuevo.faltaTitulo') }),
    ...(desde ? {} : { desde: t('entregables.nuevo.faltaDesde') }),
    ...(hasta ? {} : { hasta: t('entregables.nuevo.faltaHasta') }),
    ...(desde && hasta && hasta < desde ? { hasta: t('entregables.nuevo.periodoAlReves') } : {}),
    ...(pide.includes('cutoff_date') && !corte ? { corte: t('entregables.nuevo.faltaCorte') } : {}),
    ...(pide.includes('community') && !alcance.comunidad ? { comunidad: t('entregables.nuevo.faltaComunidad') } : {}),
    ...(pide.includes('study') && !alcance.estudio ? { estudio: t('entregables.nuevo.faltaEstudio') } : {}),
    ...(pide.includes('area_of_influence') && !alcance.area ? { area: t('entregables.nuevo.faltaArea') } : {}),
    ...(motivo.trim() ? {} : { motivo: t('comun.motivoFalta') })
  }
  const deServidor = crear.isError ? erroresDeCampo(crear.error) : {}
  const error = (clave: string, campo?: string) => (intentado ? faltas[clave] : undefined) ?? (campo ? deServidor[campo] : undefined)
  const crearlo = () => {
    setIntentado(true)
    if (Object.keys(faltas).length > 0) return
    crear.mutate(
      {
        atributos: {
          project: proyecto,
          deliverable_type: tipo,
          document_code: codigo.trim(),
          title: titulo.trim(),
          period_start_date: desde,
          period_end_date: hasta,
          ...(pide.includes('cutoff_date') ? { cutoff_date: corte } : {}),
          ...(pide.includes('community') ? { community: alcance.comunidad?.id } : {}),
          ...(pide.includes('study') ? { study: alcance.estudio } : {}),
          ...(pide.includes('area_of_influence') ? { area_of_influence: alcance.area } : {}),
          ...(alcance.preparadoPara ? { prepared_for_organization: alcance.preparadoPara.id } : {}),
          ...(alcance.suscritoPor ? { prepared_by_organization: alcance.suscritoPor.id } : {}),
          ...(plantilla ? { template_key: plantilla } : {})
        },
        motivo: motivo.trim()
      },
      { onSuccess: (r) => navegar(rutaDeEntregable(r.id, scope.kind === 'project' ? proyecto : null)) }
    )
  }
  const organizacion = (clave: 'preparadoPara' | 'suscritoPor', etiqueta: string) => (
    <div className="space-y-1">
      <p className="text-sg-body-sm font-medium">{etiqueta}</p>
      {alcance[clave] ? (
        <p className="flex items-center gap-2 text-sm">
          {texto(alcance[clave], 'name')}
          <Button size="sm" variant="ghost" onClick={() => setAlcance({ ...alcance, [clave]: null })}>
            {t('comun.quitar')}
          </Button>
        </p>
      ) : (
        <BuscadorDeRegistro
          objeto="organization"
          etiqueta={etiqueta}
          rotulo={(r) => texto(r, 'name')}
          alElegir={(r) => setAlcance({ ...alcance, [clave]: r })}
        />
      )}
    </div>
  )
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="text-sg-h3 font-semibold">{t('entregables.nuevo.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('entregables.nuevo.ayuda')}</DialogDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Campo etiqueta={t('entregables.nuevo.tipo')} error={error('tipo', 'deliverable_type')}>
            {(p) => <SelectNativo {...p} opciones={(tipos.data ?? []).map((x) => x.type)} value={tipo} onChange={(e) => setTipo(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('entregables.nuevo.codigo')} error={error('codigo', 'document_code')}>
            {(p) => <Input {...p} value={codigo} onChange={(e) => setCodigo(e.target.value)} />}
          </Campo>
          <div className="md:col-span-2">
            <Campo etiqueta={t('entregables.nuevo.tituloDelDocumento')} error={error('titulo', 'title')}>
              {(p) => <Input {...p} value={titulo} onChange={(e) => setTitulo(e.target.value)} />}
            </Campo>
          </div>
          <Campo etiqueta={t('entregables.nuevo.desde')} error={error('desde', 'period_start_date')}>
            {(p) => <Input {...p} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('entregables.nuevo.hasta')} error={error('hasta', 'period_end_date')}>
            {(p) => <Input {...p} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />}
          </Campo>
          {pide.includes('cutoff_date') ? (
            <Campo etiqueta={t('entregables.nuevo.corte')} error={error('corte', 'cutoff_date')}>
              {(p) => <Input {...p} type="date" value={corte} onChange={(e) => setCorte(e.target.value)} />}
            </Campo>
          ) : null}
          {pide.includes('community') ? (
            <div className="space-y-1 md:col-span-2">
              <p className="text-sg-body-sm font-medium">{t('entregables.nuevo.comunidad')}</p>
              {alcance.comunidad ? (
                <p className="flex items-center gap-2 text-sm">
                  {texto(alcance.comunidad, 'name')}
                  <Button size="sm" variant="ghost" onClick={() => setAlcance({ ...alcance, comunidad: null })}>
                    {t('comun.quitar')}
                  </Button>
                </p>
              ) : (
                <BuscadorDeRegistro
                  objeto="community"
                  etiqueta={t('entregables.nuevo.buscarComunidad')}
                  rotulo={(r) => texto(r, 'name')}
                  invalido={Boolean(error('comunidad', 'community'))}
                  alElegir={(r) => setAlcance({ ...alcance, comunidad: r })}
                />
              )}
              {error('comunidad', 'community') ? <p className="text-sg-caption text-sg-danger">{error('comunidad', 'community')}</p> : null}
            </div>
          ) : null}
          {pide.includes('study') ? (
            <Campo etiqueta={t('entregables.nuevo.estudio')} error={error('estudio', 'study')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  opciones={(estudios.data ?? []).map((s) => ({ valor: s.id, etiqueta: texto(s, 'name') || s.id }))}
                  value={alcance.estudio}
                  onChange={(e) => setAlcance({ ...alcance, estudio: e.target.value })}
                />
              )}
            </Campo>
          ) : null}
          {pide.includes('area_of_influence') ? (
            <Campo etiqueta={t('entregables.nuevo.area')} error={error('area', 'area_of_influence')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  opciones={aprobadas.map((a) => ({ valor: a.id, etiqueta: `${opcion(a, 'area_type')} · v${texto(a, 'version_number')}` }))}
                  value={alcance.area}
                  onChange={(e) => setAlcance({ ...alcance, area: e.target.value })}
                />
              )}
            </Campo>
          ) : null}
          {organizacion('preparadoPara', t('entregables.nuevo.preparadoPara'))}
          {organizacion('suscritoPor', t('entregables.nuevo.suscritoPor'))}
          <Campo etiqueta={t('entregables.nuevo.plantilla')} ayuda={t('entregables.nuevo.plantillaAyuda')}>
            {(p) => (
              <select
                {...p}
                className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
                value={plantilla}
                onChange={(e) => setPlantilla(e.target.value)}
              >
                <option value="">{t('entregables.nuevo.plantillaBase')}</option>
                {(plantillas.data ?? []).map((x) => (
                  <option key={x.id} value={x.templateKey}>
                    {x.name ? `${x.name} (${x.templateKey})` : x.templateKey}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <div className="md:col-span-2">
            <Campo etiqueta={t('comun.motivoObligatorio')} error={error('motivo')}>
              {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
            </Campo>
          </div>
          {tipo === T1 ? <p className="text-sg-caption text-sg-text-muted md:col-span-2">{t('entregables.nuevo.ayudaT1')}</p> : null}
        </div>
        {crear.isError && Object.keys(deServidor).length === 0 ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={crearlo} disabled={crear.isPending} aria-busy={crear.isPending}>
            {crear.isPending ? t('entregables.nuevo.creando') : t('entregables.nuevo.crear')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
