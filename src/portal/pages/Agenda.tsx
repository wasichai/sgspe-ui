import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Seccion } from '../componentes/Seccion'
import { useMisAsignaciones, vigenciaDeAsignacion } from '../contexto/proyectos'
import { ahoraEnLima, hoyEnLima, ZONA_DE_LIMA } from '../datos/fechas'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, estados, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// «Agenda de la semana», lo tercero del inicio (P-01 del rediseño de UX, DD-01): de hoy a siete días, las visitas de campo que la
// persona lidera (leader_user_id) y las interacciones programadas en sus proyectos con asignación vigente (una interacción no tiene
// responsable en el modelo: se ofrece la del proyecto), en el orden en que ocurren. cada lectura solo si la cuenta lee su objeto;
// sin nada en la semana, el bloque no se dibuja. el servidor lee un día como su comienzo en Lima (api.md §3.4)
const DIAS = 7
const VISITA_ABIERTA = ['planned', 'in_progress']
const INTERACCION_PROGRAMADA = ['planned', 'scheduled']

const sumarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

interface Cita {
  clave: string
  // AAAA-MM-DD o AAAA-MM-DDTHH:mm, en Lima: ordena y da el día
  cuando: string
  hora: string | null
  tipo: 'visita' | 'interaccion'
  titulo: string
  lugar: string
  ruta: string | null
}

export function Agenda() {
  const { t, i18n } = useTranslation(NS)
  const { user, can } = useAuth()
  const yo = user?.id ?? ''
  const hoy = hoyEnLima()
  const hasta = sumarDias(hoy, DIAS)
  const asignaciones = useMisAsignaciones()
  const vigentes = [...new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(atributo(a, 'project'))))]
  const leeVisitas = can('field_visit', 'READ')
  const leeInteracciones = can('engagement', 'READ')
  const visitas = useTodos(
    'field_visit',
    {
      leader_user_id: yo,
      state: estados(VISITA_ABIERTA),
      range_field: 'planned_start_date',
      range_from: hoy,
      range_to: hasta,
      sort: 'planned_start_date',
      dir: 'asc'
    },
    leeVisitas && Boolean(yo)
  )
  const interacciones = useTodos(
    'engagement',
    {
      project: vigentes,
      state: estados(INTERACCION_PROGRAMADA),
      range_field: 'scheduled_at',
      range_from: hoy,
      range_to: hasta,
      sort: 'scheduled_at',
      dir: 'asc'
    },
    leeInteracciones && vigentes.length > 0
  )
  const deVisita = (r: Registro): Cita => ({
    clave: `field_visit-${r.id}`,
    cuando: texto(r, 'planned_start_date'),
    hora: null,
    tipo: 'visita',
    titulo: texto(r, 'title') || r.id,
    lugar: '',
    ruta: rutaDeFicha('field_visit', r)
  })
  const deInteraccion = (r: Registro): Cita => {
    const enLima = ahoraEnLima(new Date(texto(r, 'scheduled_at')))
    return {
      clave: `engagement-${r.id}`,
      cuando: enLima,
      hora: enLima.slice(11, 16),
      tipo: 'interaccion',
      titulo: texto(r, 'title') || r.id,
      lugar: texto(r, 'place'),
      ruta: rutaDeFicha('engagement', r)
    }
  }
  const citas = [...(leeVisitas ? (visitas.data ?? []).map(deVisita) : []), ...(leeInteracciones ? (interacciones.data ?? []).map(deInteraccion) : [])]
    .filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.cuando))
    .sort((a, b) => a.cuando.localeCompare(b.cuando))
  if (citas.length === 0) return null
  const idioma = i18n.language?.startsWith('en') ? 'en-US' : 'es-PE'
  const formato = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: ZONA_DE_LIMA })
  const diaDe = (cuando: string) => new Date(`${cuando.slice(0, 10)}T12:00:00-05:00`)
  return (
    <Seccion titulo={t('miDia.agenda.titulo')} descripcion={t('miDia.agenda.descripcion')}>
      <ul className="space-y-3">
        {citas.map((c) => (
          <li key={c.clave} className="flex gap-3">
            <span className="w-14 shrink-0 text-center">
              <span className="block text-sg-caption uppercase text-sg-text-muted">{formato({ weekday: 'short' }).format(diaDe(c.cuando))}</span>
              <span className="block text-sg-h3 font-semibold tabular-nums">{formato({ day: 'numeric' }).format(diaDe(c.cuando))}</span>
            </span>
            <div className="min-w-0">
              {c.ruta ? (
                <Link
                  to={c.ruta}
                  className="block text-sg-body font-medium text-sg-text no-underline hover:text-sg-primary-text hover:underline focus-visible:underline"
                >
                  {c.titulo}
                </Link>
              ) : (
                <span className="block text-sg-body font-medium">{c.titulo}</span>
              )}
              <p className="text-sg-body-sm text-sg-text-secondary">
                {[t(`miDia.agenda.${c.tipo === 'visita' ? 'visita' : 'interaccion'}`), c.hora, c.lugar].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Seccion>
  )
}
