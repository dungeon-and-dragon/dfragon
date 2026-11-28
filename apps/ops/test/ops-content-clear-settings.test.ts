import assert from 'node:assert/strict'
import test from 'node:test'
import type { ContentClearSetting } from '@dfragon/database'
import type { ContentClearSettingRepository } from '../src/application/content-clear-settings/repository.js'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'

const unused = async () => assert.fail('컨텐츠 설정 경로 테스트는 다른 경로를 다루면 안 된다')
const unusedStore = new Proxy(
  {},
  {
    get: () => unused
  }
)

// 저장 함수처럼 행이 없으면 바꾸지 않은 스위치를 켜고 최소 인원을 0으로 만들고, 있으면 준 값만 바꾸는 메모리 fake다.
function memoryStore() {
  const rows = new Map<string, ContentClearSetting>()
  const store: ContentClearSettingRepository = {
    readSettings: async () => [...rows.values()],
    change: async ({ contentId, collected, shown, scoreBandMinPopulation }) => {
      const stored = rows.get(contentId)
      rows.set(contentId, {
        contentId,
        collected: collected ?? stored?.collected ?? true,
        shown: shown ?? stored?.shown ?? true,
        scoreBandMinPopulation: scoreBandMinPopulation ?? stored?.scoreBandMinPopulation ?? 0,
        updatedAt: new Date('2026-11-12T00:00:00Z')
      })
    }
  }

  return { rows, store }
}

async function startOpsApp(
  t: test.TestContext,
  contentClearSettings: ContentClearSettingRepository
) {
  const app = await createOpsHttpApp({
    jobs: unusedStore as never,
    readQueueCounts: unused,
    collection: unusedStore as never,
    batchNeopleKeys: unusedStore as never,
    contentClearSettings,
    labItems: unusedStore as never,
    labCurrencies: unusedStore as never,
    labItemDetails: unusedStore as never,
    labCandidates: unusedStore as never,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init)
}

const patch = (body: unknown): RequestInit => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

test('컨텐츠 설정 목록은 모든 클리어 컨텐츠를 주고, 바꾼 적 없는 컨텐츠는 수집과 노출이 켜져 있고 최소 인원이 0이다', async (t) => {
  const { store } = memoryStore()
  const request = await startOpsApp(t, store)

  await request('/api/content-clear-settings/legion-venus', patch({ collected: false }))
  await request('/api/content-clear-settings/inae-twilight', patch({ shown: false }))
  await request('/api/content-clear-settings/inae-twilight', patch({ scoreBandMinPopulation: 30 }))
  const response = await request('/api/content-clear-settings')
  const { contents } = await response.json()
  const of = (id: string) => contents.find((content: { id: string }) => content.id === id)

  assert.equal(response.status, 200)
  assert.equal(contents.length, 10)
  assert.deepEqual(of('legion-venus'), {
    id: 'legion-venus',
    kind: 'legion',
    name: '베누스',
    collected: false,
    shown: true,
    scoreBandMinPopulation: 0
  })
  assert.deepEqual(of('inae-twilight'), {
    id: 'inae-twilight',
    kind: 'raid',
    name: '이내 황혼전',
    collected: true,
    shown: false,
    scoreBandMinPopulation: 30
  })
  assert.deepEqual(of('michaela-hard'), {
    id: 'michaela-hard',
    kind: 'raid',
    name: '무너진 성자 미카엘라 (하드)',
    collected: true,
    shown: true,
    scoreBandMinPopulation: 0
  })
})

test('컨텐츠 설정 바꾸기는 모르는 컨텐츠를 404, 바꿀 값이 없거나 잘못된 본문과 JSON이 아닌 요청을 거절하고 저장하지 않는다', async (t) => {
  const { rows, store } = memoryStore()
  const request = await startOpsApp(t, store)

  const unknown = await request('/api/content-clear-settings/retired-raid', patch({ shown: false }))
  assert.equal(unknown.status, 404)
  assert.equal((await unknown.json()).error.code, 'CONTENT_CLEAR_NOT_FOUND')

  for (const body of [
    {},
    { shown: 'false' },
    { shown: false, name: '베누스' },
    { scoreBandMinPopulation: -1 },
    { scoreBandMinPopulation: 1.5 },
    { scoreBandMinPopulation: '30' },
    { scoreBandMinPopulation: 2_147_483_648 }
  ]) {
    const rejected = await request('/api/content-clear-settings/legion-venus', patch(body))
    assert.equal(rejected.status, 400, JSON.stringify(body))
  }

  const form = await request('/api/content-clear-settings/legion-venus', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'shown=false'
  })
  assert.equal(form.status, 415)
  assert.equal(rows.size, 0)
})
