import { useEffect, useState } from 'react'

export default function useIsMobile(breakpoint = 768) {
  const getMatches = () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  }

  const [isMobile, setIsMobile] = useState(getMatches)

  useEffect(() => {
    function handleResize() {
      setIsMobile(getMatches())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}
