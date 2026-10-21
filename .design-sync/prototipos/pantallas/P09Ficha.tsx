// P-09 · ficha de registro (compromiso): la primaria es la siguiente acción; lo destructivo, en «Más acciones» (U-02, U-03)
import type { ReactNode } from 'react'
import { Monto, PanelDeDecision, PanelDeTrazabilidad, SituacionDePlazo, Tabs } from '../../kit/index'
import { useL } from '../idioma'
import { Marco, MigasDelProyecto, PestanasDelProyecto } from '../marco'
import { CabeceraDeFicha, Seccion } from '../piezas'

export function P09() {
  const l = useL()
  const enlace = (t: string) => <a className="text-sg-primary-text hover:underline">{t}</a>
  const dato = (e: string, v: ReactNode) => (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{e}</dt>
      <dd className="text-sg-body">{v}</dd>
    </div>
  )
  return (
    <Marco activa="compromisos" proyecto="DEMO-T1 · Proyecto Wayra Ejemplo" persona="Gestión de compromisos (demo)">
      <MigasDelProyecto modulo={l('Compromisos', 'Commitments')} registro="DEMO-C-03" />
      <PestanasDelProyecto
        activa="commitments"
        conteos={{ stakeholders: [85], engagements: [100], commitments: [12, 1], attention: [11, 3], risks: [5], programs: [1], documents: [4] }}
      />
      <div className="mt-4">
        <CabeceraDeFicha
          volver={<a className="font-medium text-sg-primary-text hover:underline">{l('‹ Volver a Compromisos (7)', '‹ Back to Commitments (7)')}</a>}
          antetitulo={l('Compromiso · DEMO-C-03 · No material · Ambiental', 'Commitment · DEMO-C-03 · Non-material · Environmental')}
          titulo={l('Segundo monitoreo participativo de agua en la época seca', 'Second participatory water monitoring in the dry season')}
          chips={
            <>
              <SituacionDePlazo valor="POR VENCER" />
              <span>{l('Vence el 31 oct. 2026', 'Due 31 Oct 2026')}</span>
              <span>·</span>
              <Monto valor="8000" moneda="PEN" />
            </>
          }
          secundarias={[l('Informar riesgo de retraso', 'Report delay risk'), l('Editar', 'Edit')]}
          mas={[
            { etiqueta: l('Ver en el mapa', 'View on map') },
            { etiqueta: l('Bloquear', 'Block') },
            { etiqueta: l('Cancelar el compromiso…', 'Cancel commitment…'), destructiva: true }
          ]}
          primaria={{ etiqueta: l('Registrar cumplimiento', 'Record fulfilment'), deshabilitada: true }}
          bloqueo={
            <>
              {l('Falta una entrega con conformidad. ', 'A delivery with sign-off is missing. ')}
              <a className="font-medium underline">{l('Registrar entrega', 'Log a delivery')}</a>
            </>
          }
        />
      </div>
      <div className="mt-4">
        <PanelDeDecision
          objeto="commitment"
          estado="in_progress"
          desde="2026-10-02T15:30:00Z"
          por="coordinacion@sgspe.test"
          siguiente={{
            etiqueta: l('Registrar cumplimiento', 'Record fulfilment'),
            falta: l('Falta una entrega con conformidad y con quiénes la dieron', 'A delivery with sign-off and who gave it is missing')
          }}
          responsable="compromisos.demo@sgspe.test"
          vencimiento="2026-10-31"
          situacion="POR VENCER"
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Tabs
          label={l('Secciones del compromiso', 'Commitment sections')}
          tabs={[
            {
              id: 'r',
              label: l('Resumen', 'Summary'),
              render: () => (
                <div className="space-y-4 pt-3">
                  <Seccion titulo={l('Qué se prometió', 'What was promised')}>
                    <p className="text-sg-body">
                      {l(
                        'Repetir el muestreo participativo en los puntos de junio, con el laboratorio de la universidad y los comités de agua y de regantes de la microcuenca Ichuyacu.',
                        'Repeat the participatory sampling at the June points, with the university lab and the Ichuyacu water and irrigation committees.'
                      )}
                    </p>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                      {dato(l('Para', 'For'), l('Comités de agua de Ichuyacu', 'Ichuyacu water committees'))}
                      {dato(l('Beneficiarios', 'Beneficiaries'), l('14 · 5 mujeres, 9 varones', '14 · 5 women, 9 men'))}
                      {dato(l('Prioridad', 'Priority'), l('Muy alta', 'Very high'))}
                    </dl>
                  </Seccion>
                  <Seccion titulo={l('Cómo se acordó', 'How it was agreed')}>
                    <dl className="grid gap-3 sm:grid-cols-3">
                      {dato(l('Cómo se pidió', 'Requested by'), l('Acuerdo en reunión', 'Agreed in a meeting'))}
                      {dato(l('Fecha del acuerdo', 'Agreed on'), '26 jun. 2026')}
                      {dato(l('Formalidad', 'Formality'), l('Formal', 'Formal'))}
                    </dl>
                    <button type="button" className="mt-3 text-sg-body-sm font-medium text-sg-primary-text">
                      {l('Mostrar los 3 campos sin dato', 'Show the 3 empty fields')}
                    </button>
                  </Seccion>
                </div>
              )
            },
            { id: 'e', label: l('Entregas · 0', 'Deliveries · 0'), render: () => null },
            { id: 'h', label: l('Hitos', 'Milestones'), render: () => null },
            { id: 'v', label: l('Evidencias · 0', 'Evidence · 0'), render: () => null },
            { id: 'a', label: l('Actividad', 'Activity'), render: () => null }
          ]}
        />
        <PanelDeTrazabilidad
          deDondeViene={[
            {
              clave: 'i',
              titulo: l('Interacción', 'Interaction'),
              contenido: enlace(l('Entrega de los resultados del muestreo de junio', 'Delivery of the June sampling results'))
            }
          ]}
          queGenero={[{ clave: 't', titulo: l('Tareas', 'Tasks'), contenido: enlace(l('Ejecutar compromiso DEMO-C-03', 'Carry out commitment DEMO-C-03')) }]}
          vacios={{ loSustenta: l('Aún sin evidencias.', 'No evidence yet.') }}
        />
      </div>
    </Marco>
  )
}
