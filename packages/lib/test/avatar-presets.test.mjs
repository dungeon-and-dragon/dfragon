import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AVATAR_EMBLEM_COLORS,
  AVATAR_PRESET_PARTS,
  avatarPresetNeedsMainStat,
  findAvatarPreset
} from '@dfragon/lib/avatar-presets'

// build가 생성 파일을 dist에 함께 실어야 package export로 읽힌다.
const table = JSON.parse(
  readFileSync(new URL('../dist/avatar-presets.json', import.meta.url), 'utf8')
)
const observed = JSON.parse(
  readFileSync(new URL('../data/avatar-preset-observed.json', import.meta.url), 'utf8')
)

const ITEM_ID = /^[0-9a-f]{32}$/
const PLATINUM_EMBLEM_NAME = /^플래티넘 엠블렘\[/
const RADIANT_EMBLEM_NAME = /^찬란한 /
const BUFFER_JOBS = [
  '아처',
  '거너(여)',
  '마법사(여)',
  '프리스트(남)',
  '프리스트(남)',
  '프리스트(여)'
]
const MALE_PRIEST = 'f6a4ad30555b99b499c07835f87ce522'
const CRUSADER = '37495b941da3b1661bc900e68ef3b2c6'
const ARCHER = 'b9cb48777665de22c006fabaf9a560b3'
const MUSE = '37495b941da3b1661bc900e68ef3b2c6'
const MALE_CRUSADER = { jobId: MALE_PRIEST, jobGrowId: CRUSADER }
const VIGILANTE = 'c9b492038ee3ca8d27d7004cf58d59f3'
const SOCKET_COLORS = {
  HEADGEAR: ['붉은빛', '붉은빛'],
  HAIR: ['붉은빛', '붉은빛'],
  FACE: ['노란빛', '노란빛'],
  BREAST: ['노란빛', '노란빛'],
  JACKET: ['플래티넘', '녹색빛', '녹색빛'],
  PANTS: ['플래티넘', '녹색빛', '녹색빛'],
  WAIST: ['푸른빛', '푸른빛'],
  SHOES: ['푸른빛', '푸른빛'],
  WEAPON: ['다색', '다색']
}

const presets = table.presets.map(({ role, jobId, jobGrowId, mainStat }) =>
  findAvatarPreset({ jobId, jobGrowId }, role, mainStat)
)

test('끝 스펙은 딜러 67전직과 버퍼 5전직에 하나씩 있고 남성 크루세이더 버퍼만 체력과 정신력 두 갈래다', () => {
  const roles = table.presets.map(({ role }) => role)
  const buffers = table.presets.filter(({ role }) => role === 'buffer')
  const bufferJobs = buffers.map(({ jobName }) => jobName)
  const branches = buffers.filter(({ mainStat }) => mainStat !== null)

  assert.equal(table.version, 1)
  assert.equal(roles.filter((role) => role === 'dealer').length, 67)
  assert.deepEqual(bufferJobs.sort(), [...BUFFER_JOBS].sort())
  assert.deepEqual(
    branches.map(({ jobName, mainStat }) => [jobName, mainStat]),
    [
      ['프리스트(남)', '체력'],
      ['프리스트(남)', '정신력']
    ]
  )
  assert.equal(
    table.presets.filter(({ role, mainStat }) => role === 'dealer' && mainStat !== null).length,
    0
  )
  assert.equal(table.presets.length, observed.jobs.length)
})

test('모든 끝 스펙의 9부위는 레어이고 레어 소켓 배열에 찬란한 엠블렘과 플래티넘 엠블렘을 넣는다', () => {
  for (const preset of presets) {
    assert.notEqual(preset, null)
    for (const slotId of AVATAR_PRESET_PARTS) {
      const name = `${preset.role} ${preset.jobGrowId} ${slotId}`
      const part = preset.parts[slotId]

      assert.equal(part.slotId, slotId, name)
      assert.equal(part.itemRarity, '레어', name)
      assert.notEqual(part.optionAbility, '', name)
      assert.deepEqual(
        part.emblems.map(({ slotNo }) => slotNo),
        SOCKET_COLORS[slotId].map((_color, index) => index + 1),
        name
      )
      assert.deepEqual(
        part.emblems.map(({ slotColor }) => slotColor),
        SOCKET_COLORS[slotId],
        name
      )
      for (const emblem of part.emblems) {
        assert.match(emblem.itemId, ITEM_ID, name)
        if (emblem.slotColor === '플래티넘') {
          assert.match(emblem.itemName, PLATINUM_EMBLEM_NAME, name)
          assert.equal(emblem.itemRarity, '레전더리', name)
        } else {
          assert.match(emblem.itemName, RADIANT_EMBLEM_NAME, name)
          assert.equal(emblem.itemRarity, '유니크', name)
        }
      }
    }
    assert.deepEqual(Object.keys(preset.emblems).sort(), [...AVATAR_EMBLEM_COLORS].sort())
  }
})

test('모든 끝 스펙의 피부는 커먼 등급에 다색 소켓 2개를 찬란한 엠블렘으로 채운다', () => {
  for (const preset of presets) {
    const name = `${preset.role} ${preset.jobGrowId} ${preset.mainStat}`
    const { skin } = preset

    assert.equal(skin.slotId, 'SKIN', name)
    assert.equal(skin.slotName, '스킨 아바타', name)
    assert.equal(skin.itemRarity, '커먼', name)
    assert.deepEqual(
      skin.emblems.map(({ slotNo, slotColor }) => [slotNo, slotColor]),
      [
        [1, '다색'],
        [2, '다색']
      ],
      name
    )
    for (const emblem of skin.emblems) {
      assert.match(emblem.itemId, ITEM_ID, name)
      assert.match(emblem.itemName, RADIANT_EMBLEM_NAME, name)
      assert.equal(emblem.itemRarity, '유니크', name)
    }
  }
})

// 표를 다시 생성해 값이 바뀌면 이 기대값도 함께 고친다.
test('비질란테 딜러의 끝 스펙은 상의 옵션과 플래티넘 엠블렘이 특이체질이다', () => {
  const vigilante = findAvatarPreset({ jobId: ARCHER, jobGrowId: VIGILANTE }, 'dealer')

  assert.equal(vigilante.parts.JACKET.optionAbility, '특이체질 스킬Lv +1')
  assert.equal(vigilante.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[특이체질]')
  assert.equal(vigilante.parts.PANTS.emblems[0].itemName, '플래티넘 엠블렘[특이체질]')
})

test('남성 크루세이더는 딜러와 버퍼가 다른 끝 스펙을 쓴다', () => {
  const dealer = findAvatarPreset(MALE_CRUSADER, 'dealer')
  const buffer = findAvatarPreset(MALE_CRUSADER, 'buffer')

  assert.equal(dealer.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[용기의 은총]')
  assert.equal(buffer.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[수호의 은총]')
})

// 표를 다시 생성해 값이 바뀌면 이 기대값도 함께 고친다.
for (const [mainStat, option, emblem] of [
  ['체력', '캐스팅 속도 14.0% 증가', '찬란한 붉은빛 엠블렘[체력]'],
  ['정신력', '정신력 55 증가', '찬란한 붉은빛 엠블렘[정신력]']
]) {
  test(`남성 크루세이더 버퍼의 ${mainStat} 갈래는 모자 옵션이 ${option}이고 붉은빛, 피부 엠블렘이 ${emblem}이다`, () => {
    const preset = findAvatarPreset(MALE_CRUSADER, 'buffer', mainStat)

    assert.equal(preset.mainStat, mainStat)
    assert.equal(preset.parts.HEADGEAR.optionAbility, option)
    assert.equal(preset.parts.HAIR.optionAbility, option)
    assert.equal(preset.parts.HEADGEAR.emblems[0].itemName, emblem)
    assert.equal(preset.skin.emblems[0].itemName, emblem)
  })
}

test('주스탯을 모르거나 맞는 갈래가 없으면 표본이 많은 체력 갈래를 돌려준다', () => {
  assert.equal(findAvatarPreset(MALE_CRUSADER, 'buffer').mainStat, '체력')
  assert.equal(findAvatarPreset(MALE_CRUSADER, 'buffer', '지능').mainStat, '체력')
})

test('주스탯이 필요한 끝 스펙은 남성 크루세이더 버퍼뿐이다', () => {
  assert.equal(avatarPresetNeedsMainStat(MALE_CRUSADER, 'buffer'), true)
  assert.equal(avatarPresetNeedsMainStat(MALE_CRUSADER, 'dealer'), false)
  assert.equal(avatarPresetNeedsMainStat({ jobId: ARCHER, jobGrowId: MUSE }, 'buffer'), false)
  assert.equal(avatarPresetNeedsMainStat({ jobId: ARCHER, jobGrowId: 'unknown' }, 'buffer'), false)
})

test('표에 없는 전직이나 그 전직에 없는 역할은 null이다', () => {
  assert.equal(findAvatarPreset({ jobId: ARCHER, jobGrowId: 'unknown' }, 'dealer'), null)
  assert.equal(findAvatarPreset({ jobId: ARCHER, jobGrowId: VIGILANTE }, 'buffer'), null)
})

function observedJobOf({ role, jobId, jobGrowId, mainStat }) {
  return observed.jobs.find(
    (job) =>
      job.role === role &&
      job.jobId === jobId &&
      job.jobGrowId === jobGrowId &&
      job.mainStat === mainStat
  )
}

test('생성 파일은 같은 전직의 주스탯 갈래를 관측 표본이 많은 순서로 둔다', () => {
  const branches = table.presets.filter(
    ({ role, jobId, jobGrowId }) =>
      role === 'buffer' && jobId === MALE_PRIEST && jobGrowId === CRUSADER
  )
  const samples = branches.map((branch) => observedJobOf(branch).sample)
  const descending = samples.toSorted((left, right) => right - left)

  assert.equal(branches.length, 2)
  assert.ok(samples[0] > samples[1], JSON.stringify(samples))
  assert.deepEqual(samples, descending)
})

test('생성 파일의 주스탯 갈래, 플래티넘 엠블렘, 피부 엠블렘과 옵션은 관측 파일에 적힌 값과 같다', () => {
  for (const generated of table.presets) {
    const job = observedJobOf(generated)
    const name = `${generated.role} ${generated.jobGrowName} ${generated.mainStat}`

    assert.equal(generated.platinum.JACKET.itemName, job.platinum.JACKET, name)
    assert.equal(generated.platinum.PANTS.itemName, job.platinum.PANTS, name)
    assert.equal(generated.skinEmblem.itemName, job.skinEmblem.itemName, name)
    assert.equal(generated.mainStat, job.mainStat, name)
    for (const slotId of AVATAR_PRESET_PARTS) {
      assert.equal(generated.options[slotId], job.options[slotId].optionAbility, name)
    }
  }
})
