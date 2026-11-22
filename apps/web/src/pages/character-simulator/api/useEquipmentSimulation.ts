import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { apiCardScoreSchema, type CharacterIdentity } from '#entities/character'
import { requestCharacterJson } from '#entities/character-detail'
import type { SimulationBody } from '#pages/character-simulator/model/simulator-draft'

// 수치를 연달아 바꾸는 동안에는 요청하지 않고 마지막 값만 계산한다.
const SIMULATION_DELAY_MS = 300

const simulationSchema = z.object({
  baseline: apiCardScoreSchema.nullable(),
  simulated: apiCardScoreSchema.nullable()
})

export type EquipmentSimulation = z.infer<typeof simulationSchema>

export type EquipmentSimulationResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; simulation: EquipmentSimulation; calculating: boolean }>
  | Readonly<{ status: 'error' }>

function useSettledValue<Value>(value: Value): Value {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SIMULATION_DELAY_MS)

    return () => clearTimeout(timer)
  }, [value])

  return settled
}

function simulationKey({ serverId, characterId }: CharacterIdentity, body: SimulationBody) {
  return ['character', serverId, characterId, 'simulation', body] as const
}

/**
 * 바꾼 값이 멈춘 뒤 요청하고, 다음 결과를 받는 동안에는 같은 캐릭터의 직전 결과를 보인다. 요청은 끊지 않고, 늦게 온 앞
 * 요청의 응답은 그 요청의 key에만 들어가 지금 결과를 덮지 않는다.
 */
export function useEquipmentSimulation(
  identity: CharacterIdentity,
  body: SimulationBody
): EquipmentSimulationResult {
  const settledBody = useSettledValue(body)
  const queryKey = simulationKey(identity, settledBody)
  const { data, isError, isPlaceholderData } = useQuery({
    queryKey,
    queryFn: () =>
      requestCharacterJson(identity, '/simulation', simulationSchema, {
        method: 'post',
        json: settledBody
      }),
    placeholderData: (previous, previousQuery) => {
      const [, serverId, characterId] = previousQuery?.queryKey ?? []

      if (serverId !== identity.serverId || characterId !== identity.characterId) {
        return undefined
      }

      return previous
    }
  })

  if (isError) {
    return { status: 'error' }
  }

  if (data === undefined) {
    return { status: 'loading' }
  }

  const calculating = isPlaceholderData || settledBody !== body

  return { status: 'success', simulation: data, calculating }
}
