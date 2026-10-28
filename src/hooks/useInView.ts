import { useEffect, useRef, useState } from 'react'

/** `true` a partir da 1ª vez que o elemento aparece na tela — usado pelas
 * animações da página pública (barras do funil, contadores). Com "menos
 * movimento" ligado no sistema, já começa `true`. */
export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}
