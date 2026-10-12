import { Alert, Button } from '@wasichai/ui'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BotonRecargar, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { esConflictoDeVersion, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { campoDe, useActualizar, useDefinicion, type Geometria, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useRevisarGeometria } from './consultas'

// el dibujo baja con MapLibre solo al abrir el editor
const Dibujo = lazy(() => import('../mapa/Dibujo').then((m) => ({ default: m.Dibujo })))

const TIPOS = new Set(['POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON'])

// la edición de una geometría con su revisión previa (spec F6 §3.6, gis.md §6.6; decisión 19 del plan 6.3): POST geometry-checks
// dice si es válida, por qué no, la reparación propuesta con su cambio de área, si el tipo coincide y si cae fuera de zona o de
// región. se guarda por la API genérica (If-Match) solo con una elección explícita: si es válida, su forma normalizada (el tipo
// del campo: un Polygon en un MULTIPOLYGON se guarda como el MultiPolygon de normalized, enmienda 13.1), y si no lo es, la
// reparación; un tipo que no coincide no se guarda y fuera de zona o de región pide confirmar
export function EditorDeGeometria({
  objeto,
  registro,
  campos,
  proyecto,
  alTerminar
}: {
  objeto: 'community' | 'locality'
  registro: Registro
  campos: string[]
  proyecto?: string
  alTerminar: () => void
}) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(objeto)
  const [campo, setCampo] = useState(campos[0])
  if (definicion.isPending) return <Cargando />
  const meta = campoDe(definicion.data, campo)?.geometry as { type?: string; srid?: number } | undefined
  return (
    <div className="space-y-3 text-sm">
      <p className="text-sg-caption text-sg-text-muted">{t('edicionDeGeometria.ayuda')}</p>
      {campos.length > 1 ? (
        <Campo etiqueta={t('edicionDeGeometria.cual')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              opciones={campos.map((c) => ({ valor: c, etiqueta: t(`edicionDeGeometria.campos.${c}`) }))}
            />
          )}
        </Campo>
      ) : null}
      <Edicion
        key={campo}
        objeto={objeto}
        registro={registro}
        campo={campo}
        tipo={meta?.type ?? 'POLYGON'}
        srid={meta?.srid ?? 4326}
        proyecto={proyecto}
        alTerminar={alTerminar}
      />
    </div>
  )
}

function Edicion({
  objeto,
  registro,
  campo,
  tipo,
  srid,
  proyecto,
  alTerminar
}: {
  objeto: string
  registro: Registro
  campo: string
  tipo: string
  srid: number
  proyecto?: string
  alTerminar: () => void
}) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const releer = useReleer()
  const revisar = useRevisarGeometria()
  const guardar = useActualizar(objeto)
  const [geometria, setGeometria] = useState<Geometria | null>(registro.geometries?.[campo] ?? null)
  const [confirmada, setConfirmada] = useState(false)
  const revision = revisar.data
  const fuera = revision ? revision.typeMatches && (revision.zone.outOfZone || revision.zone.outOfRegion) : false
  const cambiar = (otra: Geometria | null) => {
    setGeometria(otra)
    setConfirmada(false)
    // otro dibujo deja sin efecto la revisión anterior
    revisar.reset()
    guardar.reset()
  }
  const guardarCon = (forma: Geometria) => guardar.mutate({ registro, cambios: {}, geometrias: { [campo]: forma } }, { onSuccess: alTerminar })
  const bloqueado = (fuera && !confirmada) || guardar.isPending
  const area = (ha: number | null) => (ha === null ? '—' : numeroPe(ha))
  return (
    <div className="space-y-3">
      <div className="h-72">
        <Suspense fallback={<Cargando />}>
          <Dibujo etiqueta={t(`edicionDeGeometria.campos.${campo}`)} tipo={tipo} srid={srid} valor={geometria} alCambiar={cambiar} />
        </Suspense>
      </div>
      <Button
        variant="secondary"
        disabled={!geometria || revisar.isPending}
        aria-busy={revisar.isPending}
        onClick={() => geometria && revisar.mutate({ geometry: geometria, object: objeto, field: campo, ...(proyecto ? { project: proyecto } : {}) })}
      >
        {revisar.isPending ? t('edicionDeGeometria.revisando') : t('edicionDeGeometria.revisar')}
      </Button>
      {!geometria ? <p className="text-sg-caption text-sg-text-muted">{t('edicionDeGeometria.sinDibujo')}</p> : null}
      {/* un 400 de wasichai sobre object, field, geometry o project, un 403 o un 404: se dice con su detalle (enmienda 13.3) */}
      {revisar.isError ? <Alert tone="danger">{mensaje(revisar.error)}</Alert> : null}
      {revision ? (
        <div className="space-y-2" aria-live="polite">
          {!revision.typeMatches ? (
            <Alert tone="danger">
              {t('edicionDeGeometria.tipo', { tipo: TIPOS.has(tipo) ? t(`edicionDeGeometria.tipos.${tipo}`) : t('edicionDeGeometria.otroTipo') })}
            </Alert>
          ) : revision.valid ? (
            <Alert tone="success">{t('edicionDeGeometria.valida')}</Alert>
          ) : (
            <Alert tone="warning" title={t('edicionDeGeometria.invalida')}>
              {/* el motivo ya viene en español del servidor: se dice tal cual (enmienda 13.2) */}
              {revision.reason ? <p>{t('edicionDeGeometria.motivo', { motivo: revision.reason })}</p> : null}
              {revision.repaired ? (
                <p>{t('edicionDeGeometria.reparacion', { antes: area(revision.areaHaBefore), despues: area(revision.areaHaAfter) })}</p>
              ) : (
                <p>{t('edicionDeGeometria.sinReparacion')}</p>
              )}
            </Alert>
          )}
          {fuera && revision.zone.outOfZone ? <p className="text-sg-warning">{t('edicionDeGeometria.fueraDeZona')}</p> : null}
          {fuera && revision.zone.outOfRegion ? <p className="text-sg-warning">{t('edicionDeGeometria.fueraDeRegion')}</p> : null}
          {fuera ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} />
              {t('edicionDeGeometria.confirmarUbicacion')}
            </label>
          ) : null}
          {revision.typeMatches && revision.valid && revision.normalized ? (
            <Button disabled={bloqueado} aria-busy={guardar.isPending} onClick={() => revision.normalized && guardarCon(revision.normalized)}>
              {guardar.isPending ? t('edicionDeGeometria.guardando') : t('edicionDeGeometria.guardar')}
            </Button>
          ) : null}
          {revision.typeMatches && !revision.valid && revision.repaired ? (
            <Button disabled={bloqueado} aria-busy={guardar.isPending} onClick={() => revision.repaired && guardarCon(revision.repaired)}>
              {guardar.isPending ? t('edicionDeGeometria.guardando') : t('edicionDeGeometria.guardarReparacion')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {guardar.isError ? (
        <Alert tone="danger">
          {mensaje(guardar.error)}
          {/* 412: otra persona cambió el registro; se relee y el dibujo se conserva para guardarlo con la versión nueva */}
          {esConflictoDeVersion(guardar.error) ? (
            <BotonRecargar releer={() => releer(['record', objeto, registro.id])} alRecargar={() => guardar.reset()} />
          ) : null}
        </Alert>
      ) : null}
      <Button variant="secondary" onClick={alTerminar}>
        {t('edicionDeGeometria.cancelar')}
      </Button>
    </div>
  )
}
