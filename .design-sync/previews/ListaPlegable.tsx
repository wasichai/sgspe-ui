import { ListaPlegable } from 'sgspe-kit'

const comunidades = ['Huancapampa', "Q'ollpa", 'San Juan de Ccochaccasa', 'Santa Rosa', 'Pucará', 'Chuñuhuasi', 'Antaccasa']

export const Comunidades = () => (
  <div className="max-w-sm p-4">
    <ListaPlegable titulo="Comunidades del área de influencia" elementos={comunidades.map((c) => ({ clave: c, contenido: c }))} limite={4} />
  </div>
)
