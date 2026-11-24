import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AVATAR_EMBLEM_COLORS,
  AVATAR_PRESET_PARTS,
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
const BUFFER_JOBS = ['아처', '거너(여)', '마법사(여)', '프리스트(남)', '프리스트(여)']
const MALE_PRIEST = 'f6a4ad30555b99b499c07835f87ce522'
const CRUSADER = '37495b941da3b1661bc900e68ef3b2c6'
const ARCHER = 'b9cb48777665de22c006fabaf9a560b3'
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

const presets = table.presets.map(({ role, jobId, jobGrowId }) =>
  findAvatarPreset({ jobId, jobGrowId }, role)
)

test('끝 스펙은 딜러 67전직(남성 크루세이더 딜러 포함)과 버퍼 5전직마다 하나씩 있다', () => {
  const roles = table.presets.map(({ role }) => role)
  const bufferJobs = table.presets
    .filter(({ role }) => role === 'buffer')
    .map(({ jobName }) => jobName)

  assert.equal(table.version, 1)
  assert.equal(roles.filter((role) => role === 'dealer').length, 67)
  assert.deepEqual(bufferJobs.sort(), [...BUFFER_JOBS].sort())
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

// 표를 다시 생성해 값이 바뀌면 이 기대값도 함께 고친다.
test('비질란테 딜러의 끝 스펙은 상의 옵션과 플래티넘 엠블렘이 특이체질이다', () => {
  const vigilante = findAvatarPreset({ jobId: ARCHER, jobGrowId: VIGILANTE }, 'dealer')

  assert.equal(vigilante.parts.JACKET.optionAbility, '특이체질 스킬Lv +1')
  assert.equal(vigilante.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[특이체질]')
  assert.equal(vigilante.parts.PANTS.emblems[0].itemName, '플래티넘 엠블렘[특이체질]')
})

test('남성 크루세이더는 딜러와 버퍼가 다른 끝 스펙을 쓴다', () => {
  const job = { jobId: MALE_PRIEST, jobGrowId: CRUSADER }
  const dealer = findAvatarPreset(job, 'dealer')
  const buffer = findAvatarPreset(job, 'buffer')

  assert.equal(dealer.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[용기의 은총]')
  assert.equal(buffer.parts.JACKET.emblems[0].itemName, '플래티넘 엠블렘[수호의 은총]')
})

test('표에 없는 전직이나 그 전직에 없는 역할은 null이다', () => {
  assert.equal(findAvatarPreset({ jobId: ARCHER, jobGrowId: 'unknown' }, 'dealer'), null)
  assert.equal(findAvatarPreset({ jobId: ARCHER, jobGrowId: VIGILANTE }, 'buffer'), null)
})

test('생성 파일의 플래티넘 엠블렘과 옵션은 관측 파일에 적힌 값과 같다', () => {
  for (const [index, job] of observed.jobs.entries()) {
    const generated = table.presets[index]
    const name = `${job.role} ${job.jobGrowName}`

    assert.equal(generated.platinum.JACKET.itemName, job.platinum.JACKET, name)
    assert.equal(generated.platinum.PANTS.itemName, job.platinum.PANTS, name)
    for (const slotId of AVATAR_PRESET_PARTS) {
      assert.equal(generated.options[slotId], job.options[slotId].optionAbility, name)
    }
  }
})
