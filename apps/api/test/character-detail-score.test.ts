import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import type { NeopleStageTimings } from '../src/characters/details/neople-stages.js'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { createApiHttpApp } from '../src/http.js'
import type { ScoreEngine, ScoreEngineResult } from '../src/score/engine.js'
import type { ScoreCalculator, ScoreEngineInput } from '../src/score/input.js'
import { openNativeScore } from '../src/score/native.js'
import {
  REAL_SCORE_LIBRARY_PATH,
  payloadsFromEngineInput,
  readEngineInput
} from './score-fixtures.js'

type FixtureName = 'dealer-blade' | 'buffer-muse'

const signal = new AbortController().signal
const ignoredTimings: NeopleStageTimings = { record: () => undefined, markShared: () => undefined }
const engineResult: ScoreEngineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions: { package: 'dnfscore-native 0.4.2', rules_rev: 'rev14', bundle_id: 'phase32-rev14d' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const cardVersions = {
  package: 'dnfscore-native 0.4.2',
  rulesRev: 'rev14',
  bundleId: 'phase32-rev14d'
}

interface ScoreCall {
  input: ScoreEngineInput
  calculator: ScoreCalculator
}

function recordingScore(result: (calculator: ScoreCalculator) => ScoreEngineResult | null) {
  const calls: ScoreCall[] = []
  const calculateScore: ScoreEngine['calculate'] = async (input, calculator) => {
    calls.push({ input, calculator })

    return result(calculator)
  }

  return { calls, calculateScore }
}

/** 가명 처리한 golden 입력을 Neople 섹션 응답과 공용 아이템 조회 결과로 되돌려 상세 조회에 넣는다. */
function fixtureSources(name: FixtureName) {
  const original = readEngineInput(name)
  const payloads = payloadsFromEngineInput(original)
  // golden 입력의 서버 칸은 가명이라 상세 경로가 받는 서버 ID로 바꿔 요청한다.
  const { characterId } = payloads.basic as Record<string, string>
  const fetchDetails = async () => payloads
  const fetchCatalog = async (itemIds: string[]) => {
    const found = itemIds.flatMap((itemId) => {
      const data = original.items[itemId]
      if (data === undefined) {
        return []
      }

      return [[itemId, data] as const]
    })

    return new Map(found)
  }

  return {
    original,
    fetchDetails,
    fetchCatalog,
    identity: { serverId: 'siroco', characterId: characterId! }
  }
}

function fixtureService(
  t: TestContext,
  name: FixtureName,
  calculateScore: ScoreEngine['calculate']
) {
  const { original, fetchDetails, fetchCatalog, identity } = fixtureSources(name)
  const service = createCharacterDetailService({
    fetchDetails,
    catalog: createCatalogService(fetchCatalog),
    calculateScore
  })
  t.after(() => service.onModuleDestroy())

  return { original, identity, service }
}

async function readCard(pending: Promise<{ body: Buffer }>) {
  const { body } = await pending

  return JSON.parse(body.toString()).card
}

test('딜러 card.score는 공용 아이템까지 붙인 Neople 원문을 장비 점수로 계산한 값이다', async (t) => {
  const { calls, calculateScore } = recordingScore(() => engineResult)
  const { original, identity, service } = fixtureService(t, 'dealer-blade', calculateScore)

  const card = await readCard(service.get(identity, signal, ignoredTimings))

  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.calculator, 'equipment')
  assert.deepEqual(calls[0]!.input, original)
  assert.equal(card.role, 'dealer')
  assert.deepEqual(card.score, {
    calculator: 'equipment',
    value: 1741,
    skipped: null,
    approximate: null,
    versions: cardVersions
  })
})

test('버퍼는 버프 점수 계산기로 계산한다', async (t) => {
  const { calls, calculateScore } = recordingScore((calculator) => ({
    ...engineResult,
    calculator,
    score: 136617
  }))
  const { identity, service } = fixtureService(t, 'buffer-muse', calculateScore)

  const card = await readCard(service.get(identity, signal, ignoredTimings))

  assert.deepEqual(
    calls.map((call) => call.calculator),
    ['buff']
  )
  assert.equal(card.role, 'buffer')
  assert.equal(card.score.calculator, 'buff')
  assert.equal(card.score.value, 136617)
})

test('엔진이 건너뛴 점수의 근사값은 approximate에 담고, 점수를 내지 못하면 card.score는 null이다', async (t) => {
  const approximate = recordingScore(() => ({
    ...engineResult,
    score: null,
    skipped: { kind: 'resolution', message: '판정 불가' },
    approximate_score: 1650,
    approximate_source: 'legacy_fusion_policy_a',
    warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
  }))
  const unavailable = recordingScore(() => null)
  const skipped = fixtureService(t, 'dealer-blade', approximate.calculateScore)
  const missing = fixtureService(t, 'dealer-blade', unavailable.calculateScore)

  const skippedCard = await readCard(skipped.service.get(skipped.identity, signal, ignoredTimings))
  const missingCard = await readCard(missing.service.get(missing.identity, signal, ignoredTimings))

  assert.deepEqual(skippedCard.score, {
    calculator: 'equipment',
    value: null,
    skipped: { kind: 'resolution', message: '판정 불가' },
    approximate: {
      value: 1650,
      source: 'legacy_fusion_policy_a',
      warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
    },
    versions: cardVersions
  })
  assert.equal(missingCard.role, 'dealer')
  assert.equal(missingCard.score, null)
})

test('캐시한 캐릭터를 다시 조회하면 점수를 다시 계산하지 않고, 강제 갱신은 다시 계산한다', async (t) => {
  const { calls, calculateScore } = recordingScore(() => engineResult)
  const { identity, service } = fixtureService(t, 'dealer-blade', calculateScore)

  const first = await service.get(identity, signal, ignoredTimings)
  const cached = await service.get(identity, signal, ignoredTimings)
  assert.equal(calls.length, 1)
  await service.refresh(identity, signal, ignoredTimings)

  assert.equal(cached.reused, true)
  assert.equal(cached.body, first.body)
  assert.equal(calls.length, 2)
})

test('실제 엔진을 연 API는 상세 응답에 golden 입력을 엔진에 바로 넣은 것과 같은 점수를 낸다', {
  skip: REAL_SCORE_LIBRARY_PATH === null && '점수 엔진 submodule이 없음',
  timeout: 30_000
}, async (t) => {
  const direct = openNativeScore({ path: REAL_SCORE_LIBRARY_PATH! })!
  for (const [name, calculator] of [
    ['dealer-blade', 'equipment'],
    ['buffer-muse', 'buff']
  ] as const) {
    const { original, fetchDetails, fetchCatalog, identity } = fixtureSources(name)
    const app = await createApiHttpApp({
      search: {
        searchCharacters: async () => {
          throw new Error('score test must not search')
        }
      },
      details: { fetchDetails, catalog: createCatalogService(fetchCatalog) },
      todayGrade: {
        fetchShopGrade: async () => {
          throw new Error('score test must not look up the shop grade')
        }
      },
      writeAccessLog: () => undefined,
      scoreLibraryPath: REAL_SCORE_LIBRARY_PATH
    })
    t.after(() => app.close())
    await app.listen(0, '127.0.0.1')
    const expected = JSON.parse(direct(original, calculator)!)

    const response = await fetch(
      `${await app.getUrl()}/characters/${identity.serverId}/${identity.characterId}`
    )
    const { card } = await response.json()

    assert.equal(response.status, 200, name)
    assert.equal(Number.isInteger(expected.score), true, name)
    assert.deepEqual(
      card.score,
      {
        calculator,
        value: expected.score,
        skipped: null,
        approximate: null,
        versions: {
          package: expected.versions.package,
          rulesRev: expected.versions.rules_rev,
          bundleId: expected.versions.bundle_id
        }
      },
      name
    )
  }
})
