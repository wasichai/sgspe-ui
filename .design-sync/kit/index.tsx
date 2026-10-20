// entrada de design-sync: lo que el agente de Claude Design usa para armar pantallas de SGSPE
export { VistaSgspe } from './VistaSgspe'

// primitivos de @wasichai/ui (los mismos de /admin)
export {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  PageSizePagination,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  cn
} from '@wasichai/ui'

// componentes presentacionales del portal
export { AvisoDeConflicto, BotonRecargar } from '../../src/portal/componentes/AvisoDeConflicto'
export { Campo, SelectNativo } from '../../src/portal/componentes/Campo'
export { Correo } from '../../src/portal/componentes/Correo'
export { Dia } from '../../src/portal/componentes/Dia'
export { Drawer } from '../../src/portal/componentes/Drawer'
export { EstadoChip } from '../../src/portal/componentes/EstadoChip'
export { Cargando, ErrorDeCarga, NoDisponible, NoEsDeSusProyectos, Reservado, Restringido, Vacio } from '../../src/portal/componentes/Estados'
export { FiltroDeLista } from '../../src/portal/componentes/FiltroDeLista'
export { FormularioPorPasos } from '../../src/portal/componentes/FormularioPorPasos'
export { Huella } from '../../src/portal/componentes/Huella'
export { Insignia } from '../../src/portal/componentes/Insignia'
export { KpiCard } from '../../src/portal/componentes/KpiCard'
export { ListaEnTarjetas } from '../../src/portal/componentes/ListaEnTarjetas'
export { ListaPlegable } from '../../src/portal/componentes/ListaPlegable'
export { Monto } from '../../src/portal/componentes/Monto'
export { NotaDeConfidenciales } from '../../src/portal/componentes/NotaDeConfidenciales'
export { ContenedorDePagina, EncabezadoDePagina, MasAcciones } from '../../src/portal/componentes/Pagina'
export { PanelDeDecision } from '../../src/portal/componentes/PanelDeDecision'
export { PanelDeTrazabilidad } from '../../src/portal/componentes/PanelDeTrazabilidad'
export { Pasos } from '../../src/portal/componentes/Pasos'
export { PestanasDesplazables } from '../../src/portal/componentes/PestanasDesplazables'
export { SituacionDePlazo } from '../../src/portal/componentes/SituacionDePlazo'
export { VistasDelModulo } from '../../src/portal/componentes/VistasDelModulo'
