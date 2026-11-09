import { useEffect, useState } from 'react'

interface CountUpProps {
  value: number
  duration?: number
  formatter?: (val: number) => string
}

export function CountUp({ value, duration = 600, formatter }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = displayValue
    const delta = value - startVal

    if (delta === 0) return

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Easing out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + delta * easedProgress)

      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    animationFrameId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [value, duration])

  const text = formatter ? formatter(displayValue) : displayValue.toLocaleString('pt-BR')
  return <span className="tabular-nums">{text}</span>
}
