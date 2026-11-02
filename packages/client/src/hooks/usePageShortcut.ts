import { useEffect, useEffectEvent } from 'react'
import { useClientHost, type PageShortcut } from './useClientHost'

export function usePageShortcut(
  shortcut: PageShortcut,
  enabled: boolean,
  action: () => void
): void {
  const { onShortcut } = useClientHost()
  const handleShortcut = useEffectEvent(action)

  useEffect(() => {
    if (!enabled) {
      return
    }

    return onShortcut((received) => {
      if (received === shortcut) {
        handleShortcut()
      }
    })
  }, [onShortcut, shortcut, enabled])
}
