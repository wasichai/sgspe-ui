import { EnlaceConRastro } from '../contexto/Rastro'
import type { UseQueryResult } from '@tanstack/react-query'
import { Input, Table, Tabs, Td, Th } from '@wasichai/ui'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo } from '../componentes/Campo'
import { useMensajeDeError, type MensajesPropios } from '../componentes/errores'
import { Cargando, esIlegible, esProhibido, NoDisponible, Restringido } from '../componentes/Estados'
import { rutaParaAbrir } from '../datos/fichas'
import { codigoDelError } from '../datos/http'
import { NS, numeroPe } from '../i18n'
import {
  useAnalisis,
  type ConflictoCercano,
  type DistanciaSensible,
  type Filas,
  type LocalidadEnBuffer,
  type PredioAfectado,
  type TerritorioComunalAfectado,
  type TerritorioDeConcesion,
  type Titular
} from '../territorio/consultas'

// el panel «Análisis» de S09 (screens.md S09, spec F6 §3.7, gis.md §5.3 casos 7 y 10 a 14): seis tablas que calcula SpatialGate.
// sin READ sobre el principal, «No disponible»; sin un permiso secundario (available: false), la tabla se muestra con su aviso.
// los titulares de un predio son sus derechos vigentes y solo para quien los lee (null: «Restringido», nunca vacío). un cruce
// con demasiados registros responde 400 TOO_MANY_RECORDS (no se recorta) y se dice con su texto; las listas que el servidor
// recorta en limit traen truncated y la tabla lo avisa. cada fila resalta su geometría en el mapa: enciende su capa y elige el
// registro (decisión 14 del plan 6.3); los conflictos no tienen capa en F6 y se abren por /r/

// la capa de un componente por su tipo (gis.md §2.2, Layers.kt): sondajes LYR-10; plataformas, campamento y captaciones LYR-11;
// accesos LYR-12
export const capaDeComponente = (tipo: string | null): string => (tipo === 'ACCESO' ? 'LYR-12' : tipo === 'SONDAJE' ? 'LYR-10' : 'LYR-11')
// LYR-15 son los predios de la empresa; LYR-14, los demás
const capaDePredio = (tenencia: string | null): string => (tenencia === 'PROPIEDAD DE LA EMPRESA' ? 'LYR-15' : 'LYR-14')
// LYR-03 son las ciudades; LYR-02, las demás localidades
const capaDeLocalidad = (tipo: string | null): string => (tipo === 'CIUDAD' ? 'LYR-03' : 'LYR-02')
const capaDeTerritorio = (objeto: string, tipoDeLocalidad: string | null): string | null =>
  objeto === 'locality' ? capaDeLocalidad(tipoDeLocalidad) : objeto === 'community' ? 'LYR-05' : objeto === 'community_sector' ? 'LYR-06' : null
const cifra = (v: number | null | undefined) => (v === null || v === undefined ? '—' : numeroPe(v))

type Resaltar = (objeto: string, id: string, capa: string | null) => void

export function AnalisisDelProyecto({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  // la primera pestaña dice si el backend tiene las consultas de F6 (es la misma lectura, no otra): un 404 sin código es un
  // backend sin el plan 6.2a y la pantalla sigue como en F2, sin el panel. PROJECT_NOT_FOUND trae su código y se dice en la tabla
  const primera = useAnalisis<PredioAfectado>(proyecto, 'component-parcels')
  if (primera.isError && esIlegible(primera.error) && !codigoDelError(primera.error)) return null
  return (
    <section aria-label={t('analisisDelProyecto.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('analisisDelProyecto.titulo')}</h2>
      <Tabs
        label={t('analisisDelProyecto.titulo')}
        tabs={[
          { id: 'predios', label: t('analisisDelProyecto.pestanas.predios'), render: () => <Predios proyecto={proyecto} alResaltar={alResaltar} /> },
          { id: 'comunal', label: t('analisisDelProyecto.pestanas.comunal'), render: () => <Comunal proyecto={proyecto} alResaltar={alResaltar} /> },
          { id: 'sensibles', label: t('analisisDelProyecto.pestanas.sensibles'), render: () => <Sensibles proyecto={proyecto} alResaltar={alResaltar} /> },
          { id: 'buffer', label: t('analisisDelProyecto.pestanas.buffer'), render: () => <Buffer proyecto={proyecto} alResaltar={alResaltar} /> },
          {
            id: 'concesiones',
            label: t('analisisDelProyecto.pestanas.concesiones'),
            render: () => <Concesiones proyecto={proyecto} alResaltar={alResaltar} />
          },
          { id: 'conflictos', label: t('analisisDelProyecto.pestanas.conflictos'), render: () => <Conflictos proyecto={proyecto} /> }
        ]}
      />
    </section>
  )
}

// el estado de una consulta y su tabla: cargando, «No disponible» (403), el error con su texto (TOO_MANY_RECORDS,
// WORKING_CRS_REQUIRED, PROJECT_NOT_FOUND), o la tabla con los avisos de datos incompletos y de lista recortada, y el vacío
function Resultado<T>({
  consulta,
  titulo,
  columnas,
  fila,
  mensajes
}: {
  consulta: UseQueryResult<Filas<T>>
  titulo: string
  columnas: string[]
  fila: (x: T, i: number) => ReactNode
  mensajes?: MensajesPropios
}) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  if (consulta.isPending) return <Cargando />
  if (consulta.isError) {
    if (esProhibido(consulta.error)) return <NoDisponible enLista />
    return (
      <p role="alert" className="pt-2 text-sm text-sg-danger">
        {mensaje(consulta.error, { TOO_MANY_RECORDS: t('analisisDelProyecto.demasiados'), ...mensajes })}
      </p>
    )
  }
  const { filas, disponible, recortada } = consulta.data
  return (
    <div className="space-y-2 pt-2">
      {!disponible ? <p className="text-sg-caption text-sg-warning">{t('analisisDelProyecto.incompleta')}</p> : null}
      {recortada ? <p className="text-sg-caption text-sg-warning">{t('analisisDelProyecto.recortada', { n: filas.length })}</p> : null}
      <Table aria-label={titulo}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <Th key={c} scope="col">
                {t(`analisisDelProyecto.columnas.${c}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>{filas.map(fila)}</tbody>
      </Table>
      {filas.length === 0 ? <p className="text-sm text-sg-text-muted">{t('analisisDelProyecto.vacio')}</p> : null}
    </div>
  )
}

function Ver({ nombre, alVer }: { nombre: string; alVer: () => void }) {
  const { t } = useTranslation(NS)
  return (
    <button
      type="button"
      className="text-sg-caption text-sg-primary-text underline"
      aria-label={t('analisisDelProyecto.verEnMapa', { nombre })}
      onClick={alVer}
    >
      {t('analisisDelProyecto.ver')}
    </button>
  )
}

// los titulares vigentes: null si la cuenta no lee los derechos; cada uno abre su ficha por /r/ (que dice «Registro reservado»
// si no se lee); uno sin nombre legible es «—»
function Titulares({ titulares }: { titulares: Titular[] | null }) {
  const { t } = useTranslation(NS)
  if (titulares === null) return <Restringido />
  if (titulares.length === 0) return <>{t('analisisDelProyecto.sinTitulares')}</>
  return (
    <>
      {titulares.map((h, i) => (
        <Fragment key={`${h.object}-${h.id}`}>
          {i > 0 ? ', ' : null}
          {h.name === null ? (
            '—'
          ) : (
            <EnlaceConRastro to={rutaParaAbrir(h.object, h.id)} className="text-sg-primary-text underline">
              {h.name}
            </EnlaceConRastro>
          )}
        </Fragment>
      ))}
    </>
  )
}

function Predios({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  const consulta = useAnalisis<PredioAfectado>(proyecto, 'component-parcels')
  return (
    <Resultado
      consulta={consulta}
      titulo={t('analisisDelProyecto.pestanas.predios')}
      columnas={['componente', 'predio', 'tenencia', 'titulares', 'areaHa', 'longitudM', 'mapa']}
      fila={(x, i) => (
        <tr key={`${x.component.id}-${x.parcel.id}-${i}`}>
          <Td className="font-sg-mono text-sg-caption">{x.component.code ?? '—'}</Td>
          <Td className="font-sg-mono text-sg-caption">{x.parcel.code ?? '—'}</Td>
          <Td>{x.parcel.tenureType ?? '—'}</Td>
          <Td>
            <Titulares titulares={x.holders} />
          </Td>
          <Td className="tabular-nums">{cifra(x.areaHa)}</Td>
          <Td className="tabular-nums">{cifra(x.lengthM)}</Td>
          <Td>
            <Ver
              nombre={x.parcel.code ?? t('analisisDelProyecto.sinNombre')}
              alVer={() => alResaltar('land_parcel', x.parcel.id, capaDePredio(x.parcel.tenureType))}
            />
          </Td>
        </tr>
      )}
    />
  )
}

function Comunal({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  const consulta = useAnalisis<TerritorioComunalAfectado>(proyecto, 'component-communal-land')
  return (
    <Resultado
      consulta={consulta}
      titulo={t('analisisDelProyecto.pestanas.comunal')}
      columnas={['componente', 'tipo', 'comunidad', 'areaHa', 'longitudM', 'mapa']}
      fila={(x, i) => (
        <tr key={`${x.component.id}-${x.community.id}-${i}`}>
          <Td className="font-sg-mono text-sg-caption">{x.component.code ?? '—'}</Td>
          <Td>{x.component.componentType ?? '—'}</Td>
          <Td>{x.community.name ?? '—'}</Td>
          <Td className="tabular-nums">{cifra(x.areaHa)}</Td>
          <Td className="tabular-nums">{cifra(x.lengthM)}</Td>
          <Td>
            <Ver
              nombre={x.component.code ?? t('analisisDelProyecto.sinNombre')}
              alVer={() => alResaltar('project_component', x.component.id, capaDeComponente(x.component.componentType))}
            />
          </Td>
        </tr>
      )}
    />
  )
}

// un número tecleado dentro de su rango (spec §3.1: bufferM entero de 1 a 20 000, distanceKm de 0.1 a 50); fuera de rango no se
// consulta. la consulta espera a que se deje de teclear: «1000» no pide 1, 10 y 100 por el camino
const ESPERA_MS = 400
function useNumeroEnRango(inicial: string, min: number, max: number, entero: boolean) {
  const [texto, setTexto] = useState(inicial)
  const [consultado, setConsultado] = useState(() => Number(inicial))
  const valor = Number(texto.replace(',', '.'))
  const valido = texto.trim() !== '' && Number.isFinite(valor) && (!entero || Number.isInteger(valor)) && valor >= min && valor <= max
  useEffect(() => {
    if (!valido) return
    const espera = setTimeout(() => setConsultado(valor), ESPERA_MS)
    return () => clearTimeout(espera)
  }, [valido, valor])
  return { texto, setTexto, valido, consultado }
}

function CampoNumerico({
  etiqueta,
  error,
  ayuda,
  numero,
  decimal
}: {
  etiqueta: string
  error: string
  ayuda?: string
  numero: { texto: string; setTexto: (v: string) => void; valido: boolean }
  decimal?: boolean
}) {
  return (
    <div className="max-w-[420px]">
      <Campo etiqueta={etiqueta} error={numero.valido ? undefined : error} ayuda={ayuda}>
        {(p) => (
          <Input
            {...p}
            className="max-w-[200px]"
            inputMode={decimal ? 'decimal' : 'numeric'}
            value={numero.texto}
            onChange={(e) => numero.setTexto(e.target.value)}
          />
        )}
      </Campo>
    </div>
  )
}

function Sensibles({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  const km = useNumeroEnRango('5', 0.1, 50, false)
  const consulta = useAnalisis<DistanciaSensible>(proyecto, 'sensitive-distances', { distanceKm: km.consultado }, km.valido)
  return (
    <div className="space-y-2 pt-2">
      <CampoNumerico
        etiqueta={t('analisisDelProyecto.distancia')}
        error={t('analisisDelProyecto.distanciaFuera')}
        ayuda={t('analisisDelProyecto.sensiblesAyuda')}
        numero={km}
        decimal
      />
      {km.valido ? (
        <Resultado
          consulta={consulta}
          titulo={t('analisisDelProyecto.pestanas.sensibles')}
          columnas={['componente', 'elemento', 'tipo', 'distanciaM', 'mapa']}
          mensajes={{ 'TOO_MANY_RECORDS:distanceKm': t('analisisDelProyecto.demasiadosCercanos') }}
          fila={(x, i) => (
            <tr key={`${x.component.id}-${x.feature.id}-${i}`}>
              <Td className="font-sg-mono text-sg-caption">{x.component.code ?? '—'}</Td>
              <Td>{x.feature.name ?? '—'}</Td>
              <Td>{x.feature.featureType ?? '—'}</Td>
              <Td className="tabular-nums">{cifra(x.distanceM)}</Td>
              <Td>
                <Ver nombre={x.feature.name ?? t('analisisDelProyecto.sinNombre')} alVer={() => alResaltar('environmental_feature', x.feature.id, 'LYR-08')} />
              </Td>
            </tr>
          )}
        />
      ) : null}
    </div>
  )
}

// las localidades a menos de bufferM de los componentes: solo nombre y tipo (MemberSuggestions.kt), sin recorte: con más de las
// que caben, 400 TOO_MANY_RECORDS sobre bufferM
function Buffer({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  const metros = useNumeroEnRango('500', 1, 20000, true)
  const consulta = useAnalisis<LocalidadEnBuffer>(proyecto, 'buffer-localities', { bufferM: metros.consultado }, metros.valido)
  return (
    <div className="space-y-2 pt-2">
      <CampoNumerico etiqueta={t('analisisDelProyecto.buffer')} error={t('analisisDelProyecto.bufferFuera')} numero={metros} />
      {metros.valido ? (
        <Resultado
          consulta={consulta}
          titulo={t('analisisDelProyecto.pestanas.buffer')}
          columnas={['localidad', 'tipo', 'mapa']}
          mensajes={{ 'TOO_MANY_RECORDS:bufferM': t('analisisDelProyecto.demasiadasEnBuffer') }}
          fila={(x) => (
            <tr key={x.id}>
              <Td>{x.name ?? '—'}</Td>
              <Td>{x.localityType ?? '—'}</Td>
              <Td>
                <Ver nombre={x.name ?? t('analisisDelProyecto.sinNombre')} alVer={() => alResaltar('locality', x.id, capaDeLocalidad(x.localityType))} />
              </Td>
            </tr>
          )}
        />
      ) : null}
    </div>
  )
}

function Concesiones({ proyecto, alResaltar }: { proyecto: string; alResaltar: Resaltar }) {
  const { t } = useTranslation(NS)
  const consulta = useAnalisis<TerritorioDeConcesion>(proyecto, 'concession-territories')
  return (
    <Resultado
      consulta={consulta}
      titulo={t('analisisDelProyecto.pestanas.concesiones')}
      columnas={['concesion', 'territorio', 'tipo', 'areaHa', 'mapa']}
      fila={(x, i) => (
        <tr key={`${x.concession.id}-${x.object}-${x.id}-${i}`}>
          <Td className="font-sg-mono text-sg-caption">{x.concession.code ?? x.concession.name ?? '—'}</Td>
          <Td>{x.name ?? '—'}</Td>
          <Td>
            {t(`analisisDelProyecto.objetos.${x.object}`, { defaultValue: '—' })}
            {x.object === 'locality' && x.localityType ? ` · ${x.localityType}` : null}
          </Td>
          <Td className="tabular-nums">{cifra(x.areaHa)}</Td>
          <Td>
            <Ver nombre={x.name ?? t('analisisDelProyecto.sinNombre')} alVer={() => alResaltar(x.object, x.id, capaDeTerritorio(x.object, x.localityType))} />
          </Td>
        </tr>
      )}
    />
  )
}

function Conflictos({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const km = useNumeroEnRango('5', 0.1, 50, false)
  const consulta = useAnalisis<ConflictoCercano>(proyecto, 'nearby-conflicts', { distanceKm: km.consultado }, km.valido)
  return (
    <div className="space-y-2 pt-2">
      <CampoNumerico etiqueta={t('analisisDelProyecto.distancia')} error={t('analisisDelProyecto.distanciaFuera')} numero={km} decimal />
      {km.valido ? (
        <Resultado
          consulta={consulta}
          titulo={t('analisisDelProyecto.pestanas.conflictos')}
          columnas={['registro', 'distanciaKm']}
          mensajes={{ 'TOO_MANY_RECORDS:distanceKm': t('analisisDelProyecto.demasiadosCercanos') }}
          fila={(x) => (
            <tr key={`${x.object}-${x.id}`}>
              <Td>
                {/* /r/ lee el registro como quien mira y salta a su ficha, o dice «Registro reservado» */}
                <EnlaceConRastro to={rutaParaAbrir(x.object, x.id)} className="text-sg-primary-text underline">
                  {x.label ?? t('analisisDelProyecto.sinNombre')}
                </EnlaceConRastro>
              </Td>
              <Td className="tabular-nums">{x.distanceM === null ? '—' : cifra(x.distanceM / 1000)}</Td>
            </tr>
          )}
        />
      ) : null}
    </div>
  )
}
