import { Button, Vacio } from 'sgspe-kit'

export const ConAccion = () => (
  <div className="max-w-xl p-4">
    <Vacio titulo="Aún no hay compromisos en este proyecto">
      <p>Los compromisos nacen de un acta o de un acuerdo. Regístrelos para darles responsable y plazo.</p>
      <div className="mt-3">
        <Button>Nuevo compromiso</Button>
      </div>
    </Vacio>
  </div>
)

export const SinResultados = () => (
  <div className="max-w-xl p-4">
    <Vacio titulo="Ningún compromiso coincide con los filtros">
      <p>Quite el filtro de plazo o de estado para ver más.</p>
    </Vacio>
  </div>
)
