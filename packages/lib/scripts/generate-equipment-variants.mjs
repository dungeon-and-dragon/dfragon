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

const observedWeaponItemIds = new Map(
  observed.weapons.map(({ itemTypeDetail, itemName, itemIds }) => [
    JSON.stringify([itemTypeDetail, itemName]),
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

function observedWeaponItemOf(itemTypeDetail, itemName, itemRarity) {
  const [itemId] = observedWeaponItemIds.get(JSON.stringify([itemTypeDetail, itemName])) ?? []

  if (itemId === undefined) {
    return null
  }

  return { itemId, itemName, itemRarity }
}

// 해방 계열은 해방 아이템과 "억압 - " 아이템이 모두 관측됐을 때만, 조율을 마친 아이템은 기본 아이템 바로 뒤에 둔다.
function weaponVariantsOf(type, { name, rarity, line, maxTune, tuned, release, releasePending }) {
  const item = observedWeaponItemOf(type, name, rarity)

  if (item === null) {
    return []
  }

  if (release) {
    const pending = observedWeaponItemOf(type, releasePending, rarity)

    if (pending === null) {
      return []
    }

    return [
      {
        id: item.itemId,
        rarity,
        line,
        tuned: false,
        maxTuneLevel: 0,
        item,
        releasePending: pending
      }
    ]
  }

  const variant = { id: item.itemId, rarity, line, tuned: false, maxTuneLevel: maxTune, item }
  const tunedItem = tuned !== null ? observedWeaponItemOf(type, tuned, rarity) : null

  if (tunedItem === null) {
    return [variant]
  }

  const tunedVariant = {
    id: tunedItem.itemId,
    rarity,
    line,
    tuned: true,
    maxTuneLevel: 0,
    item: tunedItem
  }

  return [variant, tunedVariant]
}

function weaponTypeOf({ type, items }) {
  const variants = items.flatMap((item) => weaponVariantsOf(type, item))

  return { itemTypeDetail: type, variants }
}

const oathCrystals = [
  ...engine.oathCrystals.sets.flatMap(({ crystals }) => crystals),
  ...engine.oathCrystals.noSet
]
const sets = engine.sets.flatMap(setOf)
const exaltedEntries = engine.exalted.flatMap(exaltedOf)
const exalted = Object.fromEntries(exaltedEntries)
const oathCrystalTable = oathCrystals.map(oathCrystalOf)
// 진의는 1단계부터 차례로 이어지고 단계마다 선택지가 셋이어야 엔진 입력의 단계 번호와 맞는다.
function oathUpgradeStepOf({ step, name, options }, index) {
  if (step !== index + 1 || options.length !== 3) {
    throw new Error(`묵언의 진의 단계가 1부터 이어지지 않거나 선택지가 셋이 아님: ${step}`)
  }

  const upgradeOptions = options.map(({ option, kind }) => ({ option, kind }))

  return { step, name, options: upgradeOptions }
}

const oathSets = engine.oathSets.map(oathSetOf)
const mistOaths = engine.oaths.noSet.flatMap(oathVariantOf)
// 115레벨 무기는 무기 단계 목록(weapons)의 조율 상한을 앞세운다. weaponTune이 더 높은 단계까지 적은 이름이 있다.
const weaponMaxTuneLevels = Object.fromEntries([
  ...Object.entries(engine.weaponTune).map(weaponMaxTuneLevelOf),
  ...engine.weapons.flatMap(({ items }) => items.map(({ name, maxTune }) => [name, maxTune]))
])
const weapons = engine.weapons.map(weaponTypeOf)
const oathUpgradeSteps = engine.oathUpgrades.steps.map(oathUpgradeStepOf)

if (oathUpgradeSteps.length !== engine.oathUpgrades.maxLevel) {
  throw new Error('묵언의 진의 단계 수가 최대 단계와 다름')
}

const table = {
  version: 1,
  sets,
  exalted,
  oathCrystals: oathCrystalTable,
  oathSets,
  mistOaths,
  weaponMaxTuneLevels,
  weapons,
  oathUpgradeMaxStep: engine.oathUpgrades.maxLevel,
  oathUpgradeSteps
}

writeFileSync(
  new URL('../src/equipment-variants.json', import.meta.url),
  `${JSON.stringify(table, null, 2)}\n`
)
