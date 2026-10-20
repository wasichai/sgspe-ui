import { Badge, Table, Td, Th } from 'sgspe-kit'

export const EnUnaTabla = () => (
  <div className="p-4">
    <Table>
      <thead>
        <tr>
          <Th>Grupo de interés</Th>
          <Th>Tipo</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Td>Comunidad campesina de Huancapampa</Td>
          <Td>
            <Badge>Comunidad</Badge>
          </Td>
        </tr>
        <tr>
          <Td>Junta de usuarios de riego del valle</Td>
          <Td>
            <Badge>Organización social</Badge>
          </Td>
        </tr>
      </tbody>
    </Table>
  </div>
)
