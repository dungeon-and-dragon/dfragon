import { useState } from 'react'
import type { Choice } from '../components/ChoiceGroup'

export function useChoice<Value extends string>(
  choices: readonly Choice<Value>[]
): [Value | undefined, (value: Value) => void] {
  const [chosen, setChosen] = useState<Value>()
  const value = choices.some((choice) => choice.value === chosen) ? chosen : choices[0]?.value

  return [value, setChosen]
}
