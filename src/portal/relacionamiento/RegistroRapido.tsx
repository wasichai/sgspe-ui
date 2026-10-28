import type { ObjectDefinition } from '@wasichai/core'
import { Button, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { DeLista } from '../componentes/LecturaConEstados'
import { EleccionDeGrupos } from '../componentes/EleccionDeGrupos'
import { hoyEnLima } from '../datos/fechas'
import { nuevaClave } from '../datos/http'
import { texto, useTodos } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ErrorDeGuardado } from './ErrorDeGuardado'
import { GuardadoParcial, useGuardarInteraccion, type Participante } from './guardarInteraccion'
import { ConmutadorDeModo } from './ConmutadorDeModo'
import { LugaresDelPunto } from '../territorio/LugaresDelPunto'
import { useUbicacionDelTelefono, type Punto } from './ubicacion'
import { rotuloDeOpcion, rotuloEnIdioma } from '../datos/opciones'
import { EN_OPCIONES } from '../datos/opcionesEnIngles'
import { conHecho } from '../componentes/AvisoDeExito'
import { AvisoDeBorrador } from '../componentes/AvisoDeBorrador'
import { AvisoAlSalir, useSalidaPermitida } from '../componentes/FormularioPorPasos'
import { descartarBorrador, leerBorrador, useBorradorLocal } from '../datos/borrador'
import { useClavesDelBorrador, useTraspaso, type ClaveDeConteo } from './traspaso'

// el modo rápido de campo de S24 (screens.md §6, S55): una sola pantalla con el tipo, la ubicación del teléfono, los
// grupos presentes, contadores por sexo y ámbito (objetivos de 44 px) y una nota; guarda la interacción como realizada
// ahora. cada contador es una fila de grupo sin nombres (represented_people_count ≥ 1), nunca datos personales
type Clave = ClaveDeConteo
// lo que el borrador del modo rápido guarda además de los grupos presentes (tercera pasada de UX, 2.4)
interface ValoresRapidos {
  tipo: string
  nota: string
  conteos: Record<Clave, number>
  ubicacion: Punto | null
  lugares: { locality?: string; community?: string }
}

export function RegistroRapido({ definicion, definicionDeParticipante }: { definicion: ObjectDefinition; definicionDeParticipante: ObjectDefinition }) {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { territory } = useContextFilters()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const guardar = useGuardarInteraccion()
  const grupos = useTodos('stakeholder', { project: projectId })
  // una clave de idempotencia por registro: al guardarlo se renueva, para que el siguiente sea otra acción
  const [clave, setClave] = useState(nuevaClave)
  // el borrador de este navegador (tercera pasada de UX, 2.4) y lo que trae el conmutador desde el asistente (2.5): el traspaso
  // gana en lo que trae; el borrador, en lo demás (la nota). en el campo es donde más fácil se pierde lo cargado
  const claves = useClavesDelBorrador(projectId, busqueda.get('field_visit'))
  const traspaso = useTraspaso()
  const [recuperado] = useState(() => leerBorrador<ValoresRapidos>(claves.rapido))
  const [avisoDeBorrador, setAvisoDeBorrador] = useState(recuperado !== null && traspaso === null)
  const previo = recuperado?.valores
  const [tipo, setTipo] = useState(() => traspaso?.tipo || previo?.tipo || '')
  const [nota, setNota] = useState(() => previo?.nota ?? '')
  // abierto desde un grupo de interés (S16) o una visita de campo (S26): trae sus grupos y la visita
  const presentesDeInicio = () => busqueda.get('stakeholders')?.split(',').filter(Boolean) ?? []
  const [presentes, setPresentes] = useState<string[]>(() =>
    traspaso && traspaso.grupos.length > 0 ? traspaso.grupos : [...new Set([...(recuperado?.elegidos?.presentes ?? []), ...presentesDeInicio()])]
  )
  const [conteos, setConteos] = useState<Record<Clave, number>>(() =>
    traspaso && Object.keys(traspaso.conteos).length > 0 ? traspaso.conteos : (previo?.conteos ?? {})
  )
  const [ubicacion, setUbicacion] = useState<Punto | null>(() => traspaso?.punto ?? previo?.ubicacion ?? null)
  // lo que «Usar estos lugares» reemplaza: solo lo que locate propone; lo demás conserva el chip de territorio
  const [lugares, setLugares] = useState<{ locality?: string; community?: string }>(() => previo?.lugares ?? {})
  const salida = useSalidaPermitida()
  const telefono = useUbicacionDelTelefono()
  const sexos = definicionDeParticipante.fields.find((f) => f.name === 'sex')?.enumOptions ?? []
  const ambitos = definicionDeParticipante.fields.find((f) => f.name === 'participant_scope')?.enumOptions ?? []
  const total = Object.values(conteos).reduce((s, n) => s + n, 0)
  const sumar = (clave: Clave, n: number) => setConteos({ ...conteos, [clave]: Math.max(0, (conteos[clave] ?? 0) + n) })
  // algo cargado que no estaba al abrir: es lo que se guarda como borrador y lo que pide confirmar al salir
  const deInicio = presentesDeInicio()
  const conCambios =
    tipo !== '' || nota.trim() !== '' || total > 0 || ubicacion !== null || presentes.length !== deInicio.length || presentes.some((g) => !deInicio.includes(g))
  const borrador = useBorradorLocal<ValoresRapidos>(
    claves.rapido,
    { valores: { tipo, nota, conteos, ubicacion, lugares }, elegidos: { presentes } },
    conCambios
  )
  const limpiar = () => {
    setTipo('')
    setNota('')
    setPresentes(presentesDeInicio())
    setConteos({})
    setUbicacion(null)
    setLugares({})
  }

  const enviar = () => {
    // el día es el de Lima y el instante, UTC: a las 23:30 de Lima ya es el día siguiente en UTC
    const ahora = new Date()
    const participantes: Participante[] = Object.entries(conteos)
      .filter(([, n]) => n > 0)
      .map(([clave, n]) => {
        const [sex, participant_scope] = clave.split('|')
        return { sex, participant_scope, represented_people_count: n, attended: true }
      })
    guardar.mutate(
      {
        proyecto: projectId,
        atributos: {
          engagement_type: tipo,
          // el título se lee como lo escribiría una persona: «Asamblea · 6 oct. 2026», no el valor de la opción y la fecha ISO, que
          // quedaban así en la ficha y en las listas (tercera pasada de UX). va en español, como el resto de lo que se guarda
          title: `${rotuloEnIdioma(tipo, 'es', EN_OPCIONES)} · ${diaPe(hoyEnLima(ahora))}`,
          description: nota,
          held_at: ahora.toISOString(),
          locality: lugares.locality ?? (territory?.kind === 'locality' ? territory.id : ''),
          community: lugares.community ?? (territory?.kind === 'community' ? territory.id : ''),
          field_visit: busqueda.get('field_visit') ?? ''
        },
        ubicacion: ubicacion ? { type: 'Point', coordinates: ubicacion } : null,
        grupos: presentes,
        temas: [],
        participantes,
        preguntas: [],
        transicion: 'register_held_unplanned',
        clave
      },
      {
        onSuccess: (i) => {
          // React Router navega en una transición: si se vuelve atrás antes de que se confirme la ficha, esta pantalla sigue
          // montada; sin limpiar, lo escrito quedaría con una clave nueva y otro «Guardar» duplicaría la interacción
          setClave(nuevaClave())
          // registrada, ni este borrador ni el del asistente tienen ya nada que recuperar
          borrador.descartar()
          descartarBorrador(claves.asistente)
          limpiar()
          salida.current = true
          navegar(`/projects/${encodeURIComponent(projectId)}/engagements/${encodeURIComponent(i.id)}`, {
            state: conHecho(null, t('relacionamiento.registro.hecho', { titulo: texto(i, 'title') }))
          })
        }
      }
    )
  }

  return (
    <section className="mx-auto max-w-md space-y-4" aria-label={t('relacionamiento.registro.rapido')}>
      <div className="flex items-center justify-between">
        <h1 className="text-sg-h2 font-semibold">{t('relacionamiento.registro.rapido')}</h1>
        <ConmutadorDeModo rapido traspaso={{ tipo, grupos: presentes, conteos, punto: ubicacion }} />
      </div>
      {avisoDeBorrador && recuperado ? (
        <AvisoDeBorrador
          guardado={recuperado.guardado}
          alDescartar={() => {
            borrador.descartar()
            limpiar()
            setAvisoDeBorrador(false)
          }}
        />
      ) : null}
      <Campo etiqueta={t('relacionamiento.registro.tipo')}>
        {(p) => (
          <SelectNativo
            {...p}
            className="h-11"
            opciones={definicion.fields.find((f) => f.name === 'engagement_type')?.enumOptions ?? []}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          />
        )}
      </Campo>
      <div className="space-y-1">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full"
          disabled={telefono.ubicando}
          aria-busy={telefono.ubicando}
          onClick={() => telefono.leer(setUbicacion)}
        >
          {t('relacionamiento.registro.usarUbicacion')}
        </Button>
        {telefono.ubicando ? (
          <p role="status" className="text-sg-caption text-sg-text-muted">
            {t('relacionamiento.visita.obteniendoUbicacion')}
          </p>
        ) : null}
        {ubicacion ? (
          <p className="text-sg-caption">{t('relacionamiento.registro.ubicacion', { lat: ubicacion[1].toFixed(5), lon: ubicacion[0].toFixed(5) })}</p>
        ) : null}
        <LugaresDelPunto punto={ubicacion} alUsar={({ locality, community }) => setLugares({ locality: locality?.id, community: community?.id })} />
        {telefono.sinUbicacion ? <p className="text-sg-caption text-sg-warning">{t('relacionamiento.registro.sinUbicacion')}</p> : null}
      </div>
      <DeLista consulta={grupos}>
        {(todos) => <EleccionDeGrupos etiqueta={t('relacionamiento.registro.grupos')} grupos={todos} elegidos={presentes} alCambiar={setPresentes} grande />}
      </DeLista>
      <fieldset className="space-y-2">
        <legend className="text-sg-label font-medium">{t('relacionamiento.ficha.asistentes')}</legend>
        {sexos.flatMap((sexo) =>
          ambitos.map((ambito) => {
            const clave: Clave = `${sexo}|${ambito}`
            const etiqueta = `${rotuloDeOpcion(sexo)} · ${rotuloDeOpcion(ambito)}`
            return (
              <div key={clave} className="flex items-center justify-between gap-2 text-sm">
                <span>{etiqueta}</span>
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-11"
                    aria-label={t('relacionamiento.registro.menos', { etiqueta })}
                    onClick={() => sumar(clave, -1)}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center tabular-nums" aria-label={etiqueta}>
                    {conteos[clave] ?? 0}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-11"
                    aria-label={t('relacionamiento.registro.mas', { etiqueta })}
                    onClick={() => sumar(clave, 1)}
                  >
                    +
                  </Button>
                </span>
              </div>
            )
          })
        )}
        <p role="status" className="font-medium">
          {t('relacionamiento.registro.totales', {
            total: numeroPe(total),
            f: numeroPe(
              Object.entries(conteos)
                .filter(([k]) => k.startsWith('FEMENINO'))
                .reduce((s, [, n]) => s + n, 0)
            ),
            m: numeroPe(
              Object.entries(conteos)
                .filter(([k]) => k.startsWith('MASCULINO'))
                .reduce((s, [, n]) => s + n, 0)
            )
          })}
        </p>
      </fieldset>
      <Campo etiqueta={t('relacionamiento.registro.nota')}>{(p) => <Textarea {...p} value={nota} onChange={(e) => setNota(e.target.value)} />}</Campo>
      <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.registro.fotoDespues')}</p>
      {guardar.isError ? <ErrorDeGuardado error={guardar.error} proyecto={projectId} /> : null}
      <Button
        type="button"
        className="h-11 w-full"
        disabled={!tipo || total === 0 || guardar.isPending || guardar.error instanceof GuardadoParcial}
        onClick={enviar}
      >
        {guardar.isPending ? t('relacionamiento.registro.guardando') : t('relacionamiento.registro.guardarRealizada')}
      </Button>
      <AvisoAlSalir conCambios={conCambios} conBorrador salidaPermitida={salida} />
    </section>
  )
}
