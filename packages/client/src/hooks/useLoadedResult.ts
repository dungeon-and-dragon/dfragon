import { useEffect, useEffectEvent, useState } from 'react'

export type LoadedResult<Value> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: Value }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING = { status: 'loading' } as const

/** `key`가 바뀌면 다시 불러오고, 다른 key로 바뀐 뒤 늦게 온 응답은 버린다. */
export function useLoadedResult<Value>(
  key: string,
  load: () => Promise<Value>
): LoadedResult<Value> {
  const [received, setReceived] = useState<{ key: string; result: LoadedResult<Value> } | null>(
    null
  )
  const start = useEffectEvent(load)

  useEffect(() => {
    let active = true
    const settle = (result: LoadedResult<Value>) => {
      if (active) {
        setReceived({ key, result })
      }
    }
    start().then(
      (value) => settle({ status: 'success', value }),
      (error: unknown) =>
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    )

    return () => {
      active = false
    }
  }, [key])

  if (received?.key !== key) {
    return LOADING
  }

  return received.result
}
