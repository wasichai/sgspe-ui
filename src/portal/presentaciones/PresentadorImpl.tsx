import { Player, type PlayerRef } from '@remotion/player'
import { DeckView, deckFrames, FPS, PAGE, SLIDE_FRAMES } from '@wasichai/sgspe-slides'
import { useEffect, useMemo, useRef } from 'react'
import { leerEspecificacion } from './especificacion'
import type { PropsDelReproductor } from './Presentador'

// el reproductor de verdad, en su propio chunk (ADR-0031): el Player de @remotion/player sobre la composición DeckView del paquete
// @wasichai/sgspe-slides, la misma que compone el PDF. reproduce solo la lámina actual (inFrame a outFrame): su entrada animada y,
// al terminar, su último fotograma, el estado completo que va al PDF. sin controles propios del Player: el presentador maneja el
// teclado. la licencia Free de Remotion la reconoce acknowledgeRemotionLicense (decisión del usuario del 2026-10-20), que además
// calla el aviso de licencia en la consola
const ESPERA_PARA_REPRODUCIR = 600

export default function PresentadorImpl({ especificacion, lamina, etiqueta, alNoAdmitir }: PropsDelReproductor) {
  const lectura = useMemo(() => leerEspecificacion(especificacion), [especificacion])
  const reproductor = useRef<PlayerRef>(null)
  const desde = lamina * SLIDE_FRAMES
  useEffect(() => {
    if (!lectura.admitida) alNoAdmitir()
  }, [lectura, alNoAdmitir])
  // la lámina entra animada. si el reloj no avanza (el navegador no deja arrancar el AudioContext del Player sin un gesto de la
  // persona, y el Player queda «reproduciendo» en el primer fotograma), se muestra quieta en su último fotograma, el estado
  // completo, y nunca a medio animar
  useEffect(() => {
    const player = reproductor.current
    if (!player) return
    player.seekTo(desde)
    player.play()
    const espera = setTimeout(() => {
      if (player.getCurrentFrame() !== desde) return
      player.pause()
      player.seekTo(desde + SLIDE_FRAMES - 1)
    }, ESPERA_PARA_REPRODUCIR)
    return () => clearTimeout(espera)
  }, [desde])
  if (!lectura.admitida) return null
  return (
    <div role="img" aria-label={etiqueta} style={{ width: '100%', height: '100%' }}>
      <Player
        ref={reproductor}
        component={DeckView}
        inputProps={{ deck: lectura.deck }}
        durationInFrames={deckFrames(lectura.deck)}
        compositionWidth={PAGE.width}
        compositionHeight={PAGE.height}
        fps={FPS}
        inFrame={desde}
        outFrame={desde + SLIDE_FRAMES - 1}
        autoPlay
        loop={false}
        moveToBeginningWhenEnded={false}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
