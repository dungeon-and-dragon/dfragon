import { readFileSync, writeFileSync } from 'node:fs'

const PARTS = ['HEADGEAR', 'HAIR', 'FACE', 'BREAST', 'JACKET', 'PANTS', 'WAIST', 'SHOES', 'WEAPON']
const EMBLEM_COLORS = ['붉은빛', '노란빛', '녹색빛', '푸른빛', '다색']
const PLATINUM_COLOR = '플래티넘'
const PLATINUM_PARTS = ['JACKET', 'PANTS']
const ROLES = ['dealer', 'buffer']

const observed = readJson('../data/avatar-preset-observed.json')

function readJson(path) {
  const url = new URL(path, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8'))
}

const emblemItems = new Map(
  observed.emblemItems.map(({ itemName, itemRarity, itemIds }) => {
    const [{ itemId }] = itemIds

    return [itemName, { itemId, itemName, itemRarity }]
  })
)

function emblemItemOf(itemName) {
  const item = emblemItems.get(itemName)

  if (item === undefined) {
    throw new Error(`엠블렘 itemId가 관측 파일에 없음: ${itemName}`)
  }

  return item
}

function partOf(slotId) {
  const part = observed.parts[slotId]

  if (part === undefined) {
    throw new Error(`부위가 관측 파일에 없음: ${slotId}`)
  }

  const { slotName, itemName, sockets } = part
  const socketList = sockets.map(({ slotNo, slotColor }) => {
    const knownColor =
      EMBLEM_COLORS.includes(slotColor) ||
      (slotColor === PLATINUM_COLOR && PLATINUM_PARTS.includes(slotId))

    if (!knownColor) {
      throw new Error(`채울 엠블렘이 없는 소켓: ${slotId} ${slotColor}`)
    }

    return { slotNo, slotColor }
  })

  return [slotId, { slotName, itemName, sockets: socketList }]
}

function presetOf({ role, jobId, jobGrowId, jobName, jobGrowName, options, emblems, platinum }) {
  if (!ROLES.includes(role)) {
    throw new Error(`알 수 없는 역할: ${role}`)
  }

  const optionEntries = PARTS.map((slotId) => {
    const optionAbility = options[slotId]?.optionAbility

    if (typeof optionAbility !== 'string' || optionAbility === '') {
      throw new Error(`옵션 문구가 없음: ${jobGrowName} ${slotId}`)
    }

    return [slotId, optionAbility]
  })
  const emblemEntries = EMBLEM_COLORS.map((slotColor) => [
    slotColor,
    emblemItemOf(emblems[slotColor].itemName)
  ])
  const platinumEntries = PLATINUM_PARTS.map((slotId) => [slotId, emblemItemOf(platinum[slotId])])
  const optionTable = Object.fromEntries(optionEntries)
  const emblemTable = Object.fromEntries(emblemEntries)
  const platinumTable = Object.fromEntries(platinumEntries)

  return {
    role,
    jobId,
    jobGrowId,
    jobName,
    jobGrowName,
    options: optionTable,
    emblems: emblemTable,
    platinum: platinumTable
  }
}

const presets = observed.jobs.map(presetOf)
const keys = new Set(presets.map(({ role, jobId, jobGrowId }) => [role, jobId, jobGrowId].join()))

if (keys.size !== presets.length) {
  throw new Error('같은 역할, 직업, 전직의 끝 스펙이 둘 이상임')
}

const parts = Object.fromEntries(PARTS.map(partOf))
const table = {
  version: 1,
  parts,
  presets
}

writeFileSync(
  new URL('../src/avatar-presets.json', import.meta.url),
  `${JSON.stringify(table, null, 2)}\n`
)
