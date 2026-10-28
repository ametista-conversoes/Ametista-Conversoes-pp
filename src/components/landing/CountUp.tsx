import { useEffect, useState } from 'react'
import { useInView } from '@/hooks/useInView'

interface CountUpProps {
  to: number
  suffix?: string
  durationMs?: number
}

/** Número que conta de 0 até `to` quando aparece na tela. */
export function CountUp({ to, suffix = '', durationMs = 1400 }: CountUpProps) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5)
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, to, durationMs])

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  )
}
