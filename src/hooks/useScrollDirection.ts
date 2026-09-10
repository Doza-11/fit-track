import { useEffect, useState } from 'react'

/**
 * Tracks scroll direction so the floating add button can get out of the way
 * while the user reads, and return the moment they scroll back up.
 */
export function useScrollDirection(threshold = 8): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    const update = () => {
      const y = window.scrollY
      // Ignore jitter and the elastic overscroll region at the very top.
      if (Math.abs(y - last) >= threshold && y > 40) {
        setDirection(y > last ? 'down' : 'up')
        last = y
      } else if (y <= 40) {
        setDirection('up')
        last = y
      }
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return direction
}
