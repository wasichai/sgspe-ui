import { Button, ContenedorDePagina, EncabezadoDePagina, Vacio } from 'sgspe-kit'

export const PaginaCompleta = () => (
  <ContenedorDePagina>
    <EncabezadoDePagina titulo="Riesgos" conteo="0 riesgos" primaria={<Button>Identificar riesgo</Button>} />
    <Vacio titulo="Aún no hay riesgos registrados">
      <p>Identifique los riesgos sociales del proyecto para evaluarlos y seguir sus mitigaciones.</p>
    </Vacio>
  </ContenedorDePagina>
)
