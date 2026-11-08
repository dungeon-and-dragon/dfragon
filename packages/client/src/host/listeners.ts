export function createListeners<T extends unknown[]>(): {
  subscribe: (listener: (...args: T) => void) => () => void
  notify: (...args: T) => void
  isEmpty: () => boolean
} {
  const listeners = new Set<(...args: T) => void>()

  return {
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    notify(...args) {
      for (const listener of listeners) {
        listener(...args)
      }
    },
    isEmpty: () => listeners.size === 0
  }
}
