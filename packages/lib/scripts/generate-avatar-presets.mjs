import { readFileSync, writeFileSync } from 'node:fs'

const PARTS = ['HEADGEAR', 'HAIR', 'FACE', 'BREAST', 'JACKET', 'PANTS', 'WAIST', 'SHOES', 'WEAPON']
const EMBLEM_COLORS = ['붉은빛', '노란빛', '녹색빛', '푸른빛', '다색']
const PLATINUM_COLOR = '플래티넘'
const PLATINUM_PARTS = ['JACKET', 'PANTS']
const ROLES = ['dealer', 'buffer']
const SKIN_COLOR = '다색'

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

function skinOf() {
  const { slotName, itemName, itemRarity, sockets } = observed.skin
  const socketList = sockets.map(({ slotNo, slotColor }) => {
    if (slotColor !== SKIN_COLOR) {
      throw new Error(`피부에 채울 엠블렘이 없는 소켓: ${slotColor}`)
    }

    return { slotNo, slotColor }
  })

  return { slotName, itemName, itemRarity, sockets: socketList }
}

function presetOf({
  role,
  jobId,
  jobGrowId,
  jobName,
  jobGrowName,
  mainStat,
  options,
  emblems,
  platinum,
  skinEmblem
}) {
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
  const skinEmblemItem = emblemItemOf(skinEmblem.itemName)

  return {
    role,
    jobId,
    jobGrowId,
    jobName,
    jobGrowName,
    mainStat,
    options: optionTable,
    emblems: emblemTable,
    platinum: platinumTable,
    skinEmblem: skinEmblemItem
  }
}

function jobKey({ role, jobId, jobGrowId }) {
  return [role, jobId, jobGrowId].join()
}

const firstIndexes = new Map()

for (const [index, job] of observed.jobs.entries()) {
  const key = jobKey(job)

  if (!firstIndexes.has(key)) {
    firstIndexes.set(key, index)
  }
}

// findAvatarPreset은 주스탯을 모를 때 먼저 나오는 갈래를 쓰므로, 같은 전직의 갈래를 표본이 많은 순서로 둔다.
// 정렬은 안정 정렬이라 표본이 같으면 관측 파일 순서를 지킨다.
function byJobThenSample(left, right) {
  const leftIndex = firstIndexes.get(jobKey(left))
  const rightIndex = firstIndexes.get(jobKey(right))

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex
  }

  return right.sample - left.sample
}

const orderedJobs = observed.jobs.toSorted(byJobThenSample)
const presets = orderedJobs.map(presetOf)
const presetKeys = presets.map(({ role, jobId, jobGrowId, mainStat }) =>
  [role, jobId, jobGrowId, mainStat].join()
)
const keys = new Set(presetKeys)

if (keys.size !== presets.length) {
  throw new Error('같은 역할, 직업, 전직, 주스탯의 끝 스펙이 둘 이상임')
}

for (const { role, jobId, jobGrowId, jobGrowName } of presets) {
  const branches = presets.filter(
    (preset) => preset.role === role && preset.jobId === jobId && preset.jobGrowId === jobGrowId
  )

  if (branches.length > 1 && branches.some(({ mainStat }) => mainStat === null)) {
    throw new Error(`갈래가 있는 전직에 주스탯이 없는 끝 스펙이 있음: ${jobGrowName}`)
  }
}

const parts = Object.fromEntries(PARTS.map(partOf))
const skin = skinOf()
const table = {
  version: 1,
  parts,
  skin,
  presets
}

writeFileSync(
  new URL('../src/avatar-presets.json', import.meta.url),
  `${JSON.stringify(table, null, 2)}\n`
)
