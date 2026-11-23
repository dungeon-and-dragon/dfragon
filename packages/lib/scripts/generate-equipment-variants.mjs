import { readFileSync, writeFileSync } from 'node:fs'

const engine = readJson('../data/equipment-variants.dfragon.json')
const observed = readJson('../data/equipment-variant-ids.json')

const observedItemIds = new Map(
  observed.items.map(({ setItemName, slotId, itemName, itemIds }) => [
    observedKey(setItemName, slotId, itemName),
    itemIds.map(({ itemId }) => itemId)
  ])
)

const observedOathItemIds = new Map(
  [...observed.oaths, ...observed.oathCrystals].map(({ itemName, itemRarity, itemIds }) => [
    JSON.stringify([itemName, itemRarity]),
    itemIds.map(({ itemId }) => itemId)
  ])
)

function readJson(path) {
  const url = new URL(path, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8'))
}

function observedKey(setItemName, slotId, itemName) {
  return JSON.stringify([setItemName, slotId, itemName])
}

function tuneSetPointsOf(tune) {
  return tune.map(({ level, setPoint }, index) => {
    if (level !== index) {
      throw new Error(`조율 단계가 0부터 이어지지 않음: ${JSON.stringify(tune)}`)
    }

    return setPoint
  })
}

function observedItemOf(setItemName, slotId, { name, rarity }) {
  const itemIds = observedItemIds.get(observedKey(setItemName, slotId, name))

  if (itemIds === undefined) {
    return null
  }

  const [itemId, ...otherItemIds] = itemIds

  return { item: { itemId, itemName: name, itemRarity: rarity }, otherItemIds }
}

// 흑아 에픽, 공용 이름, 레어는 선택지에 두지 않는다. 공용 이름은 5축성일 때 선택지의 consecrated로만 쓴다.
function isSelectable({ rarity, kind, sharedName }) {
  return !sharedName && rarity !== '레어' && !(kind === '흑아' && rarity === '에픽')
}

function variantOf(setItemName, slotId, variant, sharedItems) {
  const observedItem = observedItemOf(setItemName, slotId, variant)

  if (observedItem === null) {
    return []
  }

  const { item, otherItemIds } = observedItem
  const tuneSetPoints = tuneSetPointsOf(variant.tune)
  const shared = sharedItems.find(
    ({ rarity, kind }) => rarity === variant.rarity && kind === variant.kind
  )
  const generated = {
    id: item.itemId,
    rarity: variant.rarity,
    kind: variant.kind,
    item,
    tuneSetPoints
  }

  if (shared !== undefined) {
    if (tuneSetPointsOf(shared.tune).join() !== tuneSetPoints.join()) {
      throw new Error(`공용 이름 아이템의 조율 포인트가 다름: ${setItemName} ${shared.name}`)
    }

    const consecrated = observedItemOf(setItemName, slotId, shared)

    if (consecrated !== null) {
      generated.consecrated = consecrated.item
    }
  }

  if (otherItemIds.length > 0) {
    generated.otherItemIds = otherItemIds
  }

  return [generated]
}

function setOf({ name, slots }) {
  const setItemId = observed.setItemIds[name]

  if (setItemId === undefined) {
    return []
  }

  const variantSlots = Object.fromEntries(
    Object.entries(slots).map(([slotId, variants]) => {
      const sharedItems = variants.filter(({ sharedName }) => sharedName)
      const selectable = variants
        .filter(isSelectable)
        .flatMap((variant) => variantOf(name, slotId, variant, sharedItems))

      return [slotId, selectable]
    })
  )

  return [{ setItemId, setItemName: name, slots: variantSlots }]
}

function exaltedOf({ slotId, name, rarity, setPoint }) {
  const observedItem = observedItemOf(null, slotId, { name, rarity })

  if (observedItem === null) {
    return []
  }

  const { item, otherItemIds } = observedItem
  const variant = { id: item.itemId, rarity, kind: '유일', item, tuneSetPoints: [setPoint] }

  if (otherItemIds.length > 0) {
    variant.otherItemIds = otherItemIds
  }

  return [[slotId, variant]]
}

function oathCrystalOf({ name, rarity, tune }) {
  const tuneSetPoints = tuneSetPointsOf(tune)

  return { name, rarity, tuneSetPoints }
}

function observedOathItemOf({ name, rarity }) {
  const itemIds = observedOathItemIds.get(JSON.stringify([name, rarity]))

  if (itemIds === undefined) {
    return null
  }

  const [itemId, ...otherItemIds] = itemIds
  const variant = { id: itemId, rarity, item: { itemId, itemName: name, itemRarity: rarity } }

  if (otherItemIds.length > 0) {
    variant.otherItemIds = otherItemIds
  }

  return variant
}

function oathVariantOf(oath) {
  const variant = observedOathItemOf(oath)

  if (variant === null) {
    return []
  }

  return [{ ...variant, setPoint: oath.setPoint }]
}

function oathCrystalVariantOf(crystal) {
  const variant = observedOathItemOf(crystal)

  if (variant === null) {
    return []
  }

  const tuneSetPoints = tuneSetPointsOf(crystal.tune)

  return [{ ...variant, tuneSetPoints }]
}

function oathSetOf({ setId, name }) {
  const oaths = engine.oaths.sets.find((oathSet) => oathSet.setId === setId)?.oaths ?? []
  const crystals =
    engine.oathCrystals.sets.find((crystalSet) => crystalSet.partset === setId)?.crystals ?? []
  const oathVariants = oaths.flatMap(oathVariantOf)
  const crystalVariants = crystals.flatMap(oathCrystalVariantOf)

  return { setId, name, oaths: oathVariants, crystals: crystalVariants }
}

// 엔진은 조율할 수 있는 단계를 0부터 빠짐없이 적으므로 가장 높은 단계만 둔다.
function weaponMaxTuneLevelOf([itemName, levels]) {
  levels.forEach((level, index) => {
    if (level !== index) {
      throw new Error(`무기 조율 단계가 0부터 이어지지 않음: ${itemName}`)
    }
  })

  return [itemName, levels.length - 1]
}

const oathCrystals = [
  ...engine.oathCrystals.sets.flatMap(({ crystals }) => crystals),
  ...engine.oathCrystals.noSet
]
const sets = engine.sets.flatMap(setOf)
const exaltedEntries = engine.exalted.flatMap(exaltedOf)
const exalted = Object.fromEntries(exaltedEntries)
const oathCrystalTable = oathCrystals.map(oathCrystalOf)
const oathSets = engine.oathSets.map(oathSetOf)
const mistOaths = engine.oaths.noSet.flatMap(oathVariantOf)
const weaponMaxTuneLevels = Object.fromEntries(
  Object.entries(engine.weaponTune).map(weaponMaxTuneLevelOf)
)
const table = {
  version: 1,
  sets,
  exalted,
  oathCrystals: oathCrystalTable,
  oathSets,
  mistOaths,
  weaponMaxTuneLevels
}

writeFileSync(
  new URL('../src/equipment-variants.json', import.meta.url),
  `${JSON.stringify(table, null, 2)}\n`
)
