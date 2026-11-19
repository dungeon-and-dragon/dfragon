import {
  type DatabaseClient,
  readAdventureCharacters,
  readCharactersTimelineItems,
  readItemDictionary,
  readSeasons
} from '@dfragon/database'
import {
  EQUIPMENT_ACQUISITION_CODES,
  OATH_ACQUISITION_CODES
} from '@dfragon/server-core/domain/item-dictionary/index.js'
import {
  type AdventureEquipment,
  toAdventureEquipment,
  toEquipmentWindow
} from '#domain/adventure-guild/index.js'

export async function readAdventureEquipment(
  client: DatabaseClient,
  adventureName: string,
  now: Date
): Promise<AdventureEquipment> {
  const [seasons, characters] = await Promise.all([
    readSeasons(client),
    readAdventureCharacters(client, adventureName)
  ])
  const window = toEquipmentWindow(seasons, now)
  const records =
    window !== undefined
      ? await readCharactersTimelineItems(
          client,
          characters,
          [...EQUIPMENT_ACQUISITION_CODES, ...OATH_ACQUISITION_CODES],
          window.since
        )
      : []
  const itemIds = records.flatMap(({ itemId }) => (itemId !== null ? [itemId] : []))
  const entries = await readItemDictionary(client, itemIds)
  const dictionary = new Map(entries.map((entry) => [entry.itemId, entry]))

  return toAdventureEquipment(characters, records, dictionary, window?.equipmentLevel)
}
