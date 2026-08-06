import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Startet bewusst mit `undefined` (nicht `window.innerWidth` direkt) –
  // sonst rendert der Server immer den Desktop-Zweig (kein `window`),
  // während der Client beim ersten Render bereits den echten Wert kennt.
  // Dieser Strukturunterschied (Desktop-<div> vs. Mobile-<Sheet>) ist ein
  // Hydration-Mismatch, der dazu führte, dass der Sidebar-Trigger auf
  // Mobilgeräten nach dem Hydratisieren nicht mehr reagierte.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
