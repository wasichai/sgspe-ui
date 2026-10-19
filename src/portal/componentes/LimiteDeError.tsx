import { Component, type ReactNode } from 'react'

// si un trozo cargado bajo demanda (el chunk de MapLibre o el de ECharts) no baja, o su inicialización lanza (sin WebGL,
// por ejemplo), dice por qué en lugar de tirar la pantalla entera: lo que lo acompaña (la lista o la tabla "Ver datos",
// su alternativa accesible) sigue funcionando. alFallar avisa al padre para que, si quiere, muestre esa alternativa. con
// alternativa, la dibuja en lugar del mensaje (el panel del asistente dice su fallo dentro de su propio drawer)
export class LimiteDeError extends Component<{ mensaje: string; alternativa?: ReactNode; alFallar?: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  componentDidCatch() {
    this.props.alFallar?.()
  }
  render() {
    if (this.state.fallo && this.props.alternativa !== undefined) return this.props.alternativa
    return this.state.fallo ? (
      <p role="alert" className="p-4 text-sm text-sg-text-muted">
        {this.props.mensaje}
      </p>
    ) : (
      this.props.children
    )
  }
}
