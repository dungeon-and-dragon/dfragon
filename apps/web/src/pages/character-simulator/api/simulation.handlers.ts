import { HttpResponse, http } from 'msw'
import type { CharacterDetailView, CharacterIdentity } from '#entities/character'
import {
  characterUrl,
  loadingResponse
} from '#entities/character-detail/api/character-detail.handlers'
import type { SimulationBody } from '#pages/character-simulator/model/simulator-draft'
import { itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { enchantOptionsHandlers } from './enchant-options.handlers'
import {
  calculatorOf,
  simulationScore,
  simulatorOathCatalog,
  syntheticSimulation
} from './simulation.fixture'
import type { EquipmentSimulation } from './useEquipmentSimulation'

type Simulate = (body: SimulationBody) => EquipmentSimulation

function identityOf({ character }: CharacterDetailView): CharacterIdentity {
  return { serverId: character.serverId, characterId: character.characterId }
}

export function simulationUrl(identity: CharacterIdentity): string {
  return characterUrl(identity, '/simulation')
}

function simulatorHandlers(detail: CharacterDetailView, simulate: Simulate) {
  const identity = identityOf(detail)

  return [
    itemDetailHandlers.detail,
    oathCatalogHandlers.catalog(simulatorOathCatalog),
    ...enchantOptionsHandlers.options(),
    http.get(characterUrl(identity), () => HttpResponse.json(detail)),
    http.post(simulationUrl(identity), async ({ request }) => {
      const body = (await request.json()) as SimulationBody

      return HttpResponse.json(simulate(body))
    })
  ]
}

export const simulatorStoryHandlers = {
  calculated: (detail: CharacterDetailView) =>
    simulatorHandlers(detail, (body) => syntheticSimulation(detail, body)),
  skipped: (detail: CharacterDetailView) =>
    simulatorHandlers(detail, (body) => {
      const { baseline, simulated } = syntheticSimulation(detail, body)

      if (body.equipment.length === 0) {
        return { baseline, simulated }
      }

      const skipped = { kind: 'simulation', message: '지원하지 않는 변경' }
      const calculator = calculatorOf(detail)
      const skippedScore = simulationScore(calculator, { value: null, skipped })

      return { baseline, simulated: skippedScore }
    }),
  noEngine: (detail: CharacterDetailView) =>
    simulatorHandlers(detail, () => ({ baseline: null, simulated: null })),
  loading: (detail: CharacterDetailView) => [
    http.get(characterUrl(identityOf(detail)), loadingResponse)
  ]
}
