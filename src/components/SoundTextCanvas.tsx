import { useEffect, useRef } from 'react'

interface SoundTextCanvasProps {
  text: string
  stateKey: string
  replayToken: number
  audioLevel: number
  restoration: number
  reducedMotion: boolean
  speaking?: boolean
  restored?: boolean
  fragmentBias?: number
  labelPrefix?: string
}

interface Fragment {
  char: string
  charIndex: number
  x: number
  y: number
  size: number
  band: number
  bands: number
  scatterX: number
  scatterY: number
  rotation: number
  phase: number
  restoreRank: number
  weight: number
}

interface Geometry {
  width: number
  height: number
  fragments: Fragment[]
}

const bodyFont =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function makeGeometry(
  width: number,
  height: number,
  text: string,
  reducedMotion: boolean,
): Geometry {
  const chars = Array.from(text.replace(/\s+/g, ''))
  const vertical = width < 660
  const fragments: Fragment[] = []
  // Fewer strips on phones and in reduced-motion mode keep the canvas light.
  const bandCount = reducedMotion ? 3 : vertical ? 5 : 7
  const positions: Array<{ x: number; y: number; size: number }> = []

  if (vertical) {
    const perColumn = chars.length > 8 ? 5 : Math.max(1, chars.length)
    const columnCount = Math.ceil(chars.length / perColumn)
    const columnGap = Math.min(72, width / (columnCount + 1))
    const charGap = clamp((height - 120) / perColumn, 44, 63)
    const charSize = clamp(columnGap * 0.88, 38, 54)

    for (let column = 0; column < columnCount; column += 1) {
      const inColumn = Math.min(perColumn, chars.length - column * perColumn)
      const x = width / 2 + ((columnCount - 1) * columnGap) / 2 - column * columnGap
      const top = height / 2 - ((inColumn - 1) * charGap) / 2
      for (let row = 0; row < inColumn; row += 1) {
        positions.push({ x, y: top + row * charGap, size: charSize })
      }
    }
  } else {
    const rows = chars.length > 8 ? 2 : 1
    const perRow = Math.ceil(chars.length / rows)
    const rowGap = clamp(height * 0.15, 88, 138)
    const cell = clamp(
      Math.min((width - 100) / perRow, (height - 110) / rows / 1.4),
      58,
      104,
    )
    for (let row = 0; row < rows; row += 1) {
      const inRow = Math.min(perRow, chars.length - row * perRow)
      const y = height / 2 + (row - (rows - 1) / 2) * rowGap
      const startX = width / 2 - ((inRow - 1) * cell * 1.1) / 2
      for (let column = 0; column < inRow; column += 1) {
        positions.push({
          x: startX + column * cell * 1.1,
          y,
          size: cell * 0.86,
        })
      }
    }
  }

  chars.forEach((char, index) => {
    const position = positions[index]
    if (!position) return
    const weight = char.charCodeAt(0) % 3 === 0 ? 600 : 400
    for (let band = 0; band < bandCount; band += 1) {
      fragments.push({
        char,
        charIndex: index,
        x: position.x,
        y: position.y,
        size: position.size,
        band,
        bands: bandCount,
        scatterX: (Math.random() * 2 - 1) * 0.32,
        scatterY: (Math.random() * 2 - 1) * 0.24,
        rotation: (Math.random() * 2 - 1) * 0.22,
        phase: index * 0.73 + band * 0.035,
        restoreRank: Math.random(),
        weight,
      })
    }
  })

  return { width, height, fragments }
}
export function SoundTextCanvas({
  text,
  stateKey,
  replayToken,
  audioLevel,
  restoration,
  reducedMotion,
  speaking = false,
  restored = false,
  fragmentBias = 0,
  labelPrefix = '声音文字场',
}: SoundTextCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({
    text,
    audioLevel,
    restoration,
    reducedMotion,
    speaking,
    restored,
    fragmentBias,
  })
  const pulseRef = useRef(0)

  useEffect(() => {
    propsRef.current = {
      text,
      audioLevel,
      restoration,
      reducedMotion,
      speaking,
      restored,
      fragmentBias,
    }
  }, [text, audioLevel, restoration, reducedMotion, speaking, restored, fragmentBias])

  useEffect(() => {
    pulseRef.current = performance.now()
  }, [stateKey, replayToken])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let geometry = makeGeometry(1, 1, text, reducedMotion)
    let animationFrame = 0
    let resizeFrame = 0
    const font = bodyFont

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      geometry = makeGeometry(rect.width, rect.height, text, reducedMotion)
    }

    const draw = () => {
      const current = propsRef.current
      const { width, height } = geometry
      context.clearRect(0, 0, width, height)
      if (!current.text) return

      const now = performance.now()
      const time = now / 1000
      const sincePulse = (now - pulseRef.current) / 1000
      const movement = current.reducedMotion ? 0.16 : 1
      const voice = clamp(
        current.audioLevel * 1.45 + (current.speaking ? 0.2 : 0),
        0,
        1,
      )
      const arrival = clamp(sincePulse / 0.75, 0, 1)
      const loosen = clamp((sincePulse - 2.8) / 4.2, 0, 1)
      const gather = clamp(0.2 + arrival * 0.64 + voice * 0.36, 0, 1)
      const dispersion = clamp(
        (1 - gather) * 1.12 +
          loosen * (1 - voice * 0.7) * 0.62 +
          current.fragmentBias * 0.52,
        0,
        1.24,
      )
      const restorationEnergy = clamp(
        current.restoration + (current.restored ? 0.2 : 0),
        0,
        1,
      )

      // A soft imprint preserves at least part of the character silhouette.
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#A84432'
      context.globalAlpha = clamp(0.16 + (1 - dispersion) * 0.34, 0.12, 0.5)
      for (const fragment of geometry.fragments) {
        if (fragment.band !== 0) continue
        context.font = `${fragment.weight} ${fragment.size}px ${font}`
        context.fillText(fragment.char, fragment.x, fragment.y)
      }
      context.globalAlpha = 1

      for (const fragment of geometry.fragments) {
        const charHeight = fragment.size * 1.18
        const bandHeight = charHeight / fragment.bands
        const isRestored = fragment.restoreRank < restorationEnergy
        const localRestore = isRestored
          ? 0.72 + restorationEnergy * 0.28
          : restorationEnergy * 0.16
        // Every fourth character is a steadier anchor; the rest loosen at different rates.
        const anchor = fragment.charIndex % 4 === 0
        const characterWeight = anchor
          ? 0.42
          : 0.72 + ((fragment.charIndex * 7) % 5) * 0.08
        const localDispersion =
          dispersion * characterWeight * (1 - localRestore * 0.86) * movement
        const wanderX =
          Math.sin(time * 0.52 + fragment.phase) *
          (0.8 + localDispersion * 19) *
          movement
        const wanderY =
          Math.cos(time * 0.41 + fragment.phase * 1.7) *
          (0.7 + localDispersion * 15) *
          movement
        const dispersionWeight = localDispersion * localDispersion
        const scatterDistance = fragment.size * (0.08 + dispersionWeight * 2.35)
        const x =
          fragment.x +
          wanderX +
          fragment.scatterX * scatterDistance * localDispersion
        const y =
          fragment.y +
          wanderY +
          fragment.scatterY * scatterDistance * localDispersion
        const rotation =
          fragment.rotation * Math.pow(localDispersion, 2.4) * 2.8 * movement +
          Math.sin(time * 0.22 + fragment.phase) * 0.012 * movement
        const opacity = clamp(
          0.42 + gather * 0.4 + fragment.band * 0.008,
          0.28,
          0.9,
        )

        context.save()
        context.translate(x, y)
        context.rotate(rotation)
        context.beginPath()
        context.rect(
          -fragment.size * 0.7,
          -charHeight / 2 + fragment.band * bandHeight,
          fragment.size * 1.4,
          bandHeight * 0.9,
        )
        context.clip()
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.font = `${fragment.weight} ${fragment.size}px ${font}`

        if (isRestored) {
          context.globalAlpha = clamp(opacity + 0.05, 0, 0.94)
          context.strokeStyle = 'rgba(242, 242, 234, 0.9)'
          context.lineWidth = 0.85
          context.fillStyle = 'rgba(232, 229, 217, 0.74)'
          context.fillText(fragment.char, 0, 0)
          context.strokeText(fragment.char, 0, 0)
        } else {
          context.globalAlpha = opacity
          context.fillStyle = '#A84432'
          context.fillText(fragment.char, 0, 0)
          context.globalAlpha = opacity * 0.24
          context.strokeStyle = 'rgba(242, 242, 234, 0.65)'
          context.lineWidth = 0.55
          context.strokeText(fragment.char, 0, 0)
        }

        context.restore()
      }
    }

    const loop = () => {
      if (document.hidden) {
        animationFrame = 0
        return
      }
      draw()
      animationFrame = requestAnimationFrame(loop)
    }

    const handleVisibility = () => {
      if (!document.hidden && animationFrame === 0) {
        pulseRef.current = performance.now() - 1600
        loop()
      }
    }

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(resize)
    })

    resize()
    observer.observe(canvas)
    document.addEventListener('visibilitychange', handleVisibility)
    loop()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      cancelAnimationFrame(animationFrame)
      cancelAnimationFrame(resizeFrame)
    }
  }, [reducedMotion, text])

  return (
    <div className="sound-field">
      <canvas
        ref={canvasRef}
        className="sound-field__canvas"
        role="img"
        aria-label={`${labelPrefix}：${text}`}
      />
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
    </div>
  )
}