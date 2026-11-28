import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  LabCurrencyIcon,
  LabItemDetailIconChange,
  LabItemDetailInput,
  LabItemDetailSummary
} from '@dfragon/database'
import type { LabItemDetailRepository } from '../src/application/lab-item-details/repository.js'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'

const unused = async () => assert.fail('아이템 상세 경로 테스트는 다른 저장소를 다루면 안 된다')

type Saved = { itemName: string; input: LabItemDetailInput; icon: LabItemDetailIconChange }

// 아이콘 유지, 지우기와 이름마다 한 행은 DB 함수 테스트가 실제 DB로 확인한다. 이 fake는 경로가 넘긴 값만 남긴다.
function memoryStore(
  details: LabItemDetailSummary[] = [],
  icons = new Map<string, LabCurrencyIcon>()
) {
  const saved: Saved[] = []
  const store: LabItemDetailRepository = {
    readDetails: async () => details,
    readIcon: async (itemName) => icons.get(itemName) ?? null,
    save: async (itemName, input, icon) => {
      saved.push({ itemName, input, icon })
    }
  }

  return { store, saved }
}

async function startOpsApp(t: test.TestContext, labItemDetails: LabItemDetailRepository) {
  const app = await createOpsHttpApp({
    jobs: { readOverviews: unused, readRuns: unused, requestRun: unused, setPaused: unused },
    readQueueCounts: unused,
    collection: { readSummary: unused, requeue: unused },
    batchNeopleKeys: { readKeys: unused, add: unused, setEnabled: unused, delete: unused },
    contentClearSettings: {
      readSettings: () => assert.fail('컨텐츠 설정을 읽으면 안 된다'),
      change: () => assert.fail('컨텐츠 설정을 바꾸면 안 된다')
    },
    labItems: { readGroups: unused, replaceGroup: unused },
    labCurrencies: { readCurrencies: unused, readIcon: unused, add: unused, update: unused },
    labItemDetails,
    labCandidates: {
      upsert: unused,
      saveIcon: unused,
      deleteOtherVersions: unused,
      readCandidates: unused,
      readIcon: unused,
      readPriceHistory: unused,
      exclude: unused,
      include: unused,
      readExclusions: unused
    },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) =>
    fetch(`${origin}/api/lab-item-details${path}`, init)
}

function putRequest(body: unknown): RequestInit {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

// 합성 그림이다. 형식 판정에 쓰는 앞부분만 실제 형식과 같다.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const noTooltip = { itemTypeDetail: null, availableLevel: null, fame: null, card: null }
// 운영 화면은 아이템 종류를 입력 칸의 글자 그대로 보낸다.
const emptyTooltip = { ...noTooltip, itemTypeDetail: '' }
const card = {
  slots: ['상의', '하의'],
  enchants: [
    { upgrade: 0, status: [{ name: '힘', value: '90' }] },
    { upgrade: 1, status: [{ name: '힘', value: '100' }] }
  ]
}

test('아이템 상세 목록을 응답하고, 쉼표와 괄호가 든 이름의 아이콘을 query로 찾아 저장한 형식으로 낸다', async (t) => {
  const itemName = '합성 상자 (보주, 선택)'
  const details = [
    {
      itemName,
      description: '합성 설명',
      itemRarity: '유니크',
      itemTypeDetail: '합성 재료',
      availableLevel: 115,
      fame: 232,
      card,
      hasIcon: true,
      updatedAt: new Date('2026-11-27T00:00:00.000Z')
    }
  ]
  const icons = new Map([[itemName, { bytes: PNG_BYTES, contentType: 'image/png' }]])
  const request = await startOpsApp(t, memoryStore(details, icons).store)

  const list = await request('')
  const icon = await request(`/icon?itemName=${encodeURIComponent(itemName)}`)

  assert.deepEqual(await list.json(), {
    details: [{ ...details[0], updatedAt: '2026-11-27T00:00:00.000Z' }]
  })
  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-type'), 'image/png')
  assert.equal(icon.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await icon.arrayBuffer()), PNG_BYTES)
  assert.equal((await request('/icon?itemName=%ED%95%A9%EC%84%B1')).status, 404)
  assert.equal((await request('/icon')).status, 400)
})

test('저장은 설명과 아이템 종류의 공백을 지우고 빈 값을 null로, 아이콘을 빼면 유지, null이면 지우기로 넘긴다', async (t) => {
  const { store, saved } = memoryStore()
  const request = await startOpsApp(t, store)
  const bodies = [
    {
      itemName: ' 합성 상자 ',
      description: ' 합성 설명 ',
      itemRarity: '유니크',
      itemTypeDetail: ' 합성 재료 ',
      availableLevel: 115,
      fame: 232,
      card,
      icon: base64Of(PNG_BYTES)
    },
    {
      itemName: '합성 상자',
      description: '  ',
      itemRarity: null,
      ...emptyTooltip,
      itemTypeDetail: ' '
    },
    { itemName: '합성 상자', description: '', itemRarity: '태초', ...emptyTooltip, icon: null }
  ]

  for (const body of bodies) {
    const response = await request('', putRequest(body))
    assert.equal(response.status, 204, JSON.stringify(body))
  }

  assert.deepEqual(saved, [
    {
      itemName: '합성 상자',
      input: {
        description: '합성 설명',
        itemRarity: '유니크',
        itemTypeDetail: '합성 재료',
        availableLevel: 115,
        fame: 232,
        card
      },
      icon: { bytes: PNG_BYTES, contentType: 'image/png' }
    },
    {
      itemName: '합성 상자',
      input: { description: null, itemRarity: null, ...noTooltip },
      icon: undefined
    },
    {
      itemName: '합성 상자',
      input: { description: null, itemRarity: '태초', ...noTooltip },
      icon: null
    }
  ])
})

test('빈 이름, 목록에 없는 등급, 500자를 넘는 설명, 그림이 아닌 아이콘, 잘못된 tooltip 값은 400으로 거절하고 저장하지 않는다', async (t) => {
  const { store, saved } = memoryStore()
  const request = await startOpsApp(t, store)
  const valid = { itemName: '합성 상자', description: '', itemRarity: null, ...emptyTooltip }
  const [firstStage, secondStage] = card.enchants
  const bodies = [
    { ...valid, availableLevel: 0 },
    { ...valid, availableLevel: 1.5 },
    { ...valid, fame: 0 },
    { ...valid, fame: 2 ** 31 },
    { ...valid, itemTypeDetail: '가'.repeat(41) },
    { ...valid, card: { ...card, slots: [] } },
    { ...valid, card: { ...card, slots: [' '] } },
    { ...valid, card: { ...card, enchants: [] } },
    { ...valid, card: { ...card, enchants: [secondStage, firstStage] } },
    { ...valid, card: { ...card, enchants: [firstStage, firstStage] } },
    {
      ...valid,
      card: { ...card, enchants: [{ upgrade: 0, status: [{ name: '힘', value: '' }] }] }
    },
    { itemName: '합성 상자', description: '', itemRarity: null },
    { ...valid, itemName: '  ' },
    { ...valid, itemRarity: '전설' },
    { ...valid, itemRarity: 'unique' },
    { ...valid, description: '가'.repeat(501) },
    { ...valid, icon: base64Of(new Uint8Array([0x3c, 0x73, 0x76, 0x67])) },
    { itemName: '합성 상자', itemRarity: null }
  ]

  for (const body of bodies) {
    const response = await request('', putRequest(body))
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
  }

  assert.deepEqual(saved, [])
})

test('아이템 상세 경로도 아이콘을 담을 큰 본문을 받는다', async (t) => {
  const { store, saved } = memoryStore()
  const request = await startOpsApp(t, store)
  const icon = new Uint8Array(48 * 1024)
  icon.set(PNG_BYTES)

  const response = await request(
    '',
    putRequest({
      itemName: '합성 상자',
      description: '',
      itemRarity: null,
      ...emptyTooltip,
      icon: base64Of(icon)
    })
  )

  assert.equal(response.status, 204)
  assert.equal(saved.length, 1)
})
