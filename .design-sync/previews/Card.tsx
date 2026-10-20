import { Button, Card, CardBody, CardHeader, CardTitle } from 'sgspe-kit'

export const Tarjeta = () => (
  <div className="max-w-md p-4">
    <Card>
      <CardHeader>
        <CardTitle>Programa de agua segura</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-sg-text-secondary">Cuatro localidades del área de influencia directa, con la junta de usuarios como contraparte.</p>
        <div className="mt-3">
          <Button size="sm" variant="secondary">
            Abrir programa
          </Button>
        </div>
      </CardBody>
    </Card>
  </div>
)
