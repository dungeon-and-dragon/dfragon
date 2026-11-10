import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterSkillStyleInput, SkillStyleSampleCharacter } from '@dfragon/database'
import { type NeopleCharacterSkillStyle, NeopleRequestFailure } from '@dfragon/neople'
import { createNeopleSkillStyle } from '../src/infrastructure/neople/skill-style-collection.js'
import { type SkillStyleCollectionDependencies } from '../src/application/ranking-stats/ports.js'
import {
  UNAVAILABLE_PAUSE_MS,
  collectSkillStyles,
  createSkillStyleCollectionJob
} from '../src/application/ranking-stats/skill-style-collection.js'

const NOW = new Date('2026-11-10T03:00:00Z')

// 합성 캐릭터와 스킬 스타일이다. DB는 대상 목록과 저장한 행을 메모리에 두는 fake다.
const character = (characterId: string): SkillStyleSampleCharacter => ({
  serverId: 'cain',
  characterId
})
const styleOf = (characterId: string): NeopleCharacterSkillStyle => ({
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  skills: [{ name: `스킬-${characterId}`, level: 10 }],
  evolutions: [],
  enhancements: []
})

type Respond = (characterId: string, attempt: number) => NeopleCharacterSkillStyle

function collection(targets: readonly SkillStyleSampleCharacter[], respond: Respond) {
  const saved: CharacterSkillStyleInput[] = []
  const pauses: number[] = []
  const progress: [number, number][] = []
  const attempts = new Map<string, number>()
  const dependencies: SkillStyleCollectionDependencies = {
    store: {
      readTargets: async () => [...targets],
      recordSkillStyle: async (style) => {
        saved.push(style)
      }
    },
    fetchSkillStyle: createNeopleSkillStyle({
      characterSkillStyle: async ({ characterId }) => {
        const attempt = (attempts.get(characterId) ?? 0) + 1
        attempts.set(characterId, attempt)

        return respond(characterId, attempt)
      }
    }),
    concurrency: 2,
    now: () => NOW,
    pause: async (ms) => {
      pauses.push(ms)
    },
    report: () => {},
    reportProgress: (done, total) => {
      progress.push([done, total])
    }
  }

  return { dependencies, saved, pauses, progress }
}

test('대상 캐릭터의 스킬 스타일을 받아 받은 시각과 함께 저장하고, 없는 캐릭터는 건너뛴다', async () => {
  const { dependencies, saved, pauses, progress } = collection(
    [character('a'), character('deleted'), character('c')],
    (characterId) => {
      if (characterId === 'deleted') {
        throw new NeopleRequestFailure('api', { characterNotFound: true })
      }

      return styleOf(characterId)
    }
  )

  const summary = await collectSkillStyles(dependencies)

  assert.deepEqual(saved, [
    { ...character('a'), ...styleOf('a'), fetchedAt: NOW },
    { ...character('c'), ...styleOf('c'), fetchedAt: NOW }
  ])
  assert.deepEqual(summary, { characters: 3, saved: 2, skipped: 1 })
  assert.deepEqual(pauses, [])
  assert.deepEqual(progress.at(-1), [3, 3])
})

for (const kind of ['unavailable', 'timeout'] as const) {
  test(`Neople ${kind} 실패는 건너뛰지 않고 쉬었다가 같은 캐릭터를 다시 받는다`, async () => {
    const { dependencies, saved, pauses } = collection(
      [character('a'), character('b'), character('c')],
      (characterId, attempt) => {
        if (characterId === 'b' && attempt === 1) {
          throw new NeopleRequestFailure(kind)
        }

        return styleOf(characterId)
      }
    )

    const summary = await collectSkillStyles(dependencies)

    assert.deepEqual(
      saved.map(({ characterId }) => characterId),
      ['a', 'b', 'c']
    )
    assert.deepEqual(summary, { characters: 3, saved: 3, skipped: 0 })
    assert.deepEqual(pauses, [UNAVAILABLE_PAUSE_MS])
  })
}

test('Neople 실패가 아닌 오류는 수집을 실패로 끝낸다', async () => {
  const { dependencies, saved } = collection([character('a')], () => {
    throw new TypeError('합성 내부 오류')
  })

  await assert.rejects(collectSkillStyles(dependencies), TypeError)
  assert.deepEqual(saved, [])
})

test('스킬 스타일 수집 job은 일정 없이 수동으로만 돈다', () => {
  const { dependencies } = collection([], styleOf)
  const { store, fetchSkillStyle, concurrency, report } = dependencies

  const job = createSkillStyleCollectionJob(store, { fetchSkillStyle, concurrency, report })

  assert.equal(job.name, 'skill-style-collection')
  assert.equal(job.schedule, undefined)
})
