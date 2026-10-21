// P-01 · el mismo inicio para el agente de campo: sus bloques, sin cifras que no lee (U-01)
import { Button, SituacionDePlazo } from '../../kit/index'
import { Camera, MapPin, Plus } from 'lucide-react'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { Seccion } from '../piezas'

export function P01Agente() {
  const l = useL()
  return (
    <Marco
      activa="inicio"
      persona="Agente de campo (demo)"
      ocultas={['territorio', 'compromisos', 'riesgos', 'programas', 'reportes', 'admin']}
      insignias={{ tareas: 1 }}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold">{l('Buenos días, Agente de campo', 'Good morning, Agente de campo')}</h1>
          <p className="text-sg-body text-sg-text-secondary">{l('Hoy: 2 visitas y 1 tarea vencida.', 'Today: 2 visits and 1 overdue task.')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            <Camera aria-hidden className="mr-1 size-4" />
            {l('Foto con ubicación', 'Geotagged photo')}
          </Button>
          <Button size="sm">
            <Plus aria-hidden className="mr-1 size-4" />
            {l('Registrar interacción', 'Log an interaction')}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Seccion titulo={l('Lo que me toca hoy', 'My work today')}>
          <ul className="divide-y divide-sg-border-subtle">
            <li className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <a className="block text-sg-body font-medium">{l('Levantar fotos del tramo con sedimento', 'Photograph the silted stretch')}</a>
                <p className="text-sg-body-sm text-sg-text-secondary">
                  {l('Venció el 19 oct. · canal principal de Huaylla Alto', 'Due 19 Oct · Huaylla Alto main canal')}
                </p>
              </div>
              <SituacionDePlazo valor="VENCIDO" />
            </li>
          </ul>
        </Seccion>
        <Seccion titulo={l('Visitas de hoy', "Today's visits")}>
          <ul className="space-y-3">
            {[
              ['10:00', l('Encuesta de línea base en Rumichaca', 'Baseline survey in Rumichaca'), 'Caserío Rumichaca'],
              ['15:00', l('Observación de la faena comunal', 'Observe the community work day'), 'Caserío Quishuar']
            ].map(([h, t, lugar]) => (
              <li key={t} className="flex gap-3">
                <span className="w-14 shrink-0 text-sg-h3 font-semibold tabular-nums">{h}</span>
                <div>
                  <a className="block text-sg-body font-medium">{t}</a>
                  <p className="flex items-center gap-1 text-sg-body-sm text-sg-text-secondary">
                    <MapPin aria-hidden className="size-3.5" /> {lugar}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>
        <Seccion titulo={l('Para tomar en mis proyectos', 'Up for grabs in my projects')} descripcion="Proyecto Wayra Ejemplo">
          <ul className="divide-y divide-sg-border-subtle">
            {[
              l('Registrar asistencia de la asamblea de Pucará Chico', 'Log attendance at the Pucará Chico assembly'),
              l('Georreferenciar la nueva captación', 'Geolocate the new water intake')
            ].map((t) => (
              <li key={t} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sg-body">{t}</span>
                <Button size="sm" variant="secondary">
                  {l('Tomar', 'Take')}
                </Button>
              </li>
            ))}
          </ul>
        </Seccion>
        <Seccion titulo={l('Por sincronizar', 'Waiting to sync')}>
          <p className="text-sg-body text-sg-text-secondary">{l('Todo lo capturado está en el servidor.', 'Everything you captured is on the server.')}</p>
        </Seccion>
      </div>
    </Marco>
  )
}
