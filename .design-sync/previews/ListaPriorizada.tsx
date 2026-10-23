import { ListaPriorizada } from 'sgspe-kit'

export const LoQueMeToca = () => (
  <div className="grid max-w-4xl gap-3 p-4 md:grid-cols-2">
    <ListaPriorizada
      titulo="Vencen esta semana"
      total={9}
      verTodos={{ a: '/commitments?situation=POR+VENCER' }}
      entradas={[
        {
          clave: 'c1',
          titulo: 'COM-0142 · Acceso al centro de salud',
          a: '/r/commitment/c1',
          motivo: 'Venció hace 3 días',
          cuando: '20/10/2026',
          tono: 'peligro'
        },
        { clave: 'c2', titulo: 'COM-0138 · Reparación del canal de riego', a: '/r/commitment/c2', motivo: 'Vence mañana', cuando: '24/10/2026', tono: 'aviso' },
        {
          clave: 'c3',
          titulo: 'COM-0131 · Becas para el instituto técnico',
          a: '/r/commitment/c3',
          motivo: 'Vence en 5 días',
          cuando: '28/10/2026',
          tono: 'neutro'
        }
      ]}
    />
    <ListaPriorizada
      titulo="Quejas fuera de plazo"
      total={null}
      verTodos={{ a: '/attention?situation=VENCIDO' }}
      entradas={[
        {
          clave: 'q1',
          titulo: 'QCS-0077 · Polvo en la vía de Pampacocha',
          a: '/r/grievance/q1',
          motivo: 'Sin respuesta en el plazo legal',
          cuando: '12 días hábiles',
          tono: 'peligro'
        }
      ]}
    />
    <ListaPriorizada titulo="Esperan su decisión" total={0} entradas={[]} vacio="Nada espera su decisión hoy." />
    <ListaPriorizada
      titulo="Riesgos por revisar"
      total={5}
      limite={2}
      entradas={[
        { clave: 'r1', titulo: 'RSK-0031 · Bloqueo de la vía de acceso', a: '/r/social_risk/r1', motivo: 'Revisión vencida', tono: 'peligro' },
        { clave: 'r2', titulo: 'RSK-0027 · Uso del agua del canal', a: '/r/social_risk/r2', motivo: 'Revisión esta semana', tono: 'aviso' },
        { clave: 'r3', titulo: 'RSK-0019 · Empleo local en la obra', a: '/r/social_risk/r3', motivo: 'Revisión en 10 días', tono: 'neutro' },
        { clave: 'r4', titulo: 'RSK-0015 · Ruido de la planta', a: '/r/social_risk/r4', motivo: 'Revisión en 12 días', tono: 'neutro' },
        { clave: 'r5', titulo: 'RSK-0011 · Paso de ganado', a: '/r/social_risk/r5', motivo: 'Revisión en 20 días', tono: 'neutro' }
      ]}
    />
  </div>
)
