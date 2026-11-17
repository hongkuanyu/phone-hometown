import { useEffect, useState } from 'react'

export function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setSeconds((value) => value + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [active])

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const remaining = (seconds % 60).toString().padStart(2, '0')

  return {
    seconds,
    label: `${minutes}:${remaining}`,
    reset: () => setSeconds(0),
  }
}