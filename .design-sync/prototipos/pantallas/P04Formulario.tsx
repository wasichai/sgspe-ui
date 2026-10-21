// P-04 · formulario complejo: registrar una QCS en pasos, con «Qué pasará» fijo y fechas propias del portal (U-07, U-30)
import { Campo, FormularioPorPasos, Input, SelectNativo, Textarea } from '../../kit/index'
import { useL } from '../idioma'
import { Marco, MigasDelProyecto, PestanasDelProyecto } from '../marco'
import { CampoFecha, Seccion } from '../piezas'

export function P04() {
  const l = useL()
  return (
    <Marco activa="qcs" proyecto="DEMO-T1 · Proyecto Wayra Ejemplo" persona="Atención de QCS (demo)">
      <MigasDelProyecto modulo={l('Quejas y solicitudes', 'Grievances and requests')} registro={l('Registrar', 'Log')} />
      <PestanasDelProyecto
        activa="attention"
        conteos={{ stakeholders: [85], engagements: [100], commitments: [12], attention: [11, 3], risks: [5], programs: [1], documents: [4] }}
      />
      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FormularioPorPasos
          titulo={l('Registrar queja, consulta o solicitud', 'Log a grievance, inquiry or request')}
          descripcion={l(
            'Registre lo que se planteó y por dónde llegó. El tratamiento se decide después.',
            'Record what was raised and how it arrived. Handling is decided later.'
          )}
          pasos={[l('Qué se plantea', 'What is raised'), l('Cómo llegó y quién', 'How it arrived and who'), l('Revisión', 'Review')]}
          actual={1}
          visitados={1}
          alIr={() => {}}
          alAnterior={() => {}}
          alCancelar={() => {}}
          alGuardarYSalir={() => {}}
          alEnviar={(e) => e.preventDefault()}
        >
          <div className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="text-sg-h3 font-semibold">{l('Canal y fecha', 'Channel and date')}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta={l('Canal', 'Channel')}>
                  {(p) => (
                    <SelectNativo
                      {...p}
                      defaultValue="reunion"
                      opciones={[
                        { valor: 'reunion', etiqueta: l('Reunión o asamblea', 'Meeting or assembly') },
                        { valor: 'oficina', etiqueta: l('Oficina de relaciones', 'Relations office') },
                        { valor: 'telefono', etiqueta: l('Teléfono', 'Phone') }
                      ]}
                    />
                  )}
                </Campo>
                <CampoFecha etiqueta={l('Recibida el', 'Received on')} valor="20/10/2026" hora="10:15" ayuda={l('Hora de Lima', 'Lima time')} />
              </div>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="text-sg-h3 font-semibold">{l('Quién la plantea', 'Who raises it')}</legend>
              <div className="flex gap-6 text-sg-body">
                <label className="flex items-center gap-2">
                  <input type="radio" name="quien" defaultChecked /> {l('Una persona identificada', 'An identified person')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="quien" /> {l('Anónima', 'Anonymous')}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta={l('Persona', 'Person')}
                  ayuda={l('Dato restringido: solo lo leen quienes atienden QCS.', 'Restricted: only grievance handlers can read it.')}
                >
                  {(p) => <Input {...p} defaultValue="Marcelina Huaroc Anccasi" />}
                </Campo>
                <Campo etiqueta={l('Grupo de interés (opcional)', 'Stakeholder (optional)')}>
                  {(p) => <Input {...p} placeholder={l('Buscar por nombre', 'Search by name')} />}
                </Campo>
              </div>
              <label className="flex items-start gap-2 text-sg-body">
                <input type="checkbox" className="mt-1" />
                <span>
                  {l('Confidencial', 'Confidential')}
                  <span className="block text-sg-body-sm text-sg-text-secondary">
                    {l(
                      'Fuera de listas, tableros y reportes; la leen solo la gestión de QCS, su responsable y quien la recibe.',
                      'Hidden from lists, dashboards and reports; only grievance management, its owner and the receiver can read it.'
                    )}
                  </span>
                </span>
              </label>
            </fieldset>
            <Campo etiqueta={l('Lugar donde ocurrió (opcional)', 'Where it happened (optional)')}>
              {(p) => <Textarea {...p} rows={2} defaultValue={l('Sector Ccollpa, cerca del canal principal', 'Ccollpa sector, near the main canal')} />}
            </Campo>
          </div>
        </FormularioPorPasos>
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Seccion titulo={l('Qué pasará al registrar', 'What happens when you log it')}>
            <ul className="space-y-2 text-sg-body-sm text-sg-text-secondary">
              <li>{l('Se registra como queja QUE-2026-012, en estado «Recibida».', 'It is logged as grievance QUE-2026-012, status “Received”.')}</li>
              <li>{l('El acuse vence el 27/10/2026 (5 días hábiles, sin feriados).', 'Acknowledgement due 27/10/2026 (5 business days, no holidays).')}</li>
              <li>{l('La resolución vence el 19/11/2026 (30 días calendario).', 'Resolution due 19/11/2026 (30 calendar days).')}</li>
              <li>
                {l('Se crea la tarea «Acusar recibo» para Atención de QCS (demo).', 'An “Acknowledge receipt” task is created for Atención de QCS (demo).')}
              </li>
            </ul>
          </Seccion>
          <p className="text-sg-caption text-sg-text-muted">
            {l('El borrador se guarda en este navegador al pasar de paso.', 'The draft is saved in this browser at each step.')}
          </p>
        </aside>
      </div>
    </Marco>
  )
}
