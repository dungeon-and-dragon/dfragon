import { useState } from 'react'
import type { ChipGroupItem } from '@dfragon/ui'

export function useChoice<Value extends string>(
  choices: readonly ChipGroupItem<Value>[]
): [Value | undefined, (value: Value) => void] {
  const [chosen, setChosen] = useState<Value>()
  const value = choices.some((choice) => choice.value === chosen) ? chosen : choices[0]?.value

  return [value, setChosen]
}
