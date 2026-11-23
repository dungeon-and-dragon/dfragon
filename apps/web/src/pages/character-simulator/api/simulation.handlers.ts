import { SLOT_ITEM_CATEGORIES, slotItemsOf } from '@dfragon/lib/slot-items'
import { HttpResponse, http } from 'msw'
import type { CharacterDetailView, CharacterIdentity } from '#entities/character'
import {
  characterUrl,
  loadingResponse
} from '#entities/character-detail/api/character-detail.handlers'
import type { SimulationBody } from '#pages/character-simulator/model/simulator-draft'
import { storyItemDetail } from '#widgets/item-tooltip/api/item-detail.fixture'
import { ITEM_DETAIL_URL } from '#widgets/item-tooltip/api/item-detail.handlers'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
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

const SLOT_ITEMS = SLOT_ITEM_CATEGORIES.flatMap((category) => slotItemsOf(category))

// 선택 목록의 대표 아이템은 목록의 이름, 등급, 명성, 효과로 답하고, 그 밖의 아이템은 합성 상세로 답한다.
const slotItemDetailHandler = http.get(ITEM_DETAIL_URL, ({ params }) => {
  const itemId = String(params.itemId)
  const slotItem = SLOT_ITEMS.find(({ item }) => item.itemId === itemId)

  if (slotItem === undefined) {
    return HttpResponse.json(storyItemDetail(itemId))
  }

  const status = slotItem.status.map(({ name, value }) => {
    const text = String(value)

    return { name, value: text }
  })

  return HttpResponse.json({
    itemId,
    name: slotItem.item.itemName,
    rarity: slotItem.item.itemRarity,
    itemType: null,
    typeDetail: null,
    availableLevel: null,
    fame: slotItem.fame,
    status,
    explain: null,
    flavorText: null
  })
})

function simulatorHandlers(detail: CharacterDetailView, simulate: Simulate) {
  const identity = identityOf(detail)

  return [
    slotItemDetailHandler,
    oathCatalogHandlers.catalog(simulatorOathCatalog),
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
