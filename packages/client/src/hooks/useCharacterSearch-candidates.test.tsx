// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCharacterSearch } from './useCharacterSearch'
import type { CaptureSearch, createCaptureSearch } from '@dfragon/client-core/lib/capture-search'
import { emptySearchSlots } from '@dfragon/client-core/lib/slots'
import { createTestClientHost } from '../testing/test-support/client-host'
import type { SearchView } from '@dfragon/client-core/types/search'
import {
  type CharacterChoice,
  SEARCH_SLOT_COUNTS,
  type SearchSlot
} from '@dfragon/client-core/preload/common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot
} from '@dfragon/client-core/preload/api/search-test-fixture'

// 파티 검색 수명의 연결(createCaptureSearch)만 바꾸고 useManualCharacterLookup은 그대로 쓴다.
const mocks = vi.hoisted(() => ({ create: vi.fn<typeof createCaptureSearch>() }))
vi.mock('@dfragon/client-core/lib/capture-search', () => ({ createCaptureSearch: mocks.create }))

const SLOT = 1
const partyHost = createTestClientHost().party
const NEXT_REQUEST_ID = '00000000-0000-4000-8000-000000000088'
let value: ReturnType<typeof useCharacterSearch>
let bridge: CaptureSearch
let root: Root
let container: HTMLDivElement

function choice(serverId: string, serverName: string, fame: number): CharacterChoice {
  return {
    ...searchRow,
    characterId: `synthetic-${serverId}`,
    serverId,
    serverName,
    fame,
    adventureName: null
  }
}

const CAIN = choice('cain', '카인', 100)
const SIROCO = choice('siroco', '시로코', 200)

function selected(serverId: string) {
  return {
    ...searchRow,
    serverId,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/synthetic-character?zoom=1`,
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

// 실제 연결은 직접 조회를 받으면 그 슬롯을 직접 조회 상태로 두고, 새 회차를 시작하면 모두 되돌린다.
function viewWithSlot(slot: SearchSlot, manual = false): SearchView {
  const slots = emptySearchSlots(4).map((current) => (current.slot === slot.slot ? slot : current))
  const manualSlots = slots.map((current) => manual && current.slot === slot.slot)

  return { ready: true, slots, manualSlots, connectionFailed: false }
}

function ocrSlotWithChoices(requestId = REQUEST_ID): SearchSlot {
  return searchSlot({
    slot: SLOT,
    requestId,
    state: 'success',
    rows: [searchRow],
    selected: selected('cain'),
    selectionMethod: 'portrait',
    choices: [CAIN, SIROCO]
  })
}

function lookupSlot(overrides: Partial<SearchSlot>): SearchSlot {
  return searchSlot({
    slot: SLOT,
    observationRevision: 2,
    requestId: NEXT_REQUEST_ID,
    ...overrides
  })
}

const pickedResult = lookupSlot({
  state: 'success',
  rows: [{ ...searchRow, serverId: 'siroco' }],
  selected: selected('siroco'),
  selectionMethod: 'manual'
})

async function publish(view: SearchView): Promise<void> {
  const onChange = mocks.create.mock.lastCall![0].onChange
  await act(async () => onChange(view))
}

function lookups(): Array<string | undefined> {
  return vi.mocked(bridge.lookup).mock.calls.map(([input]) => input.serverId)
}

function Harness({
  onRender
}: {
  onRender: (value: ReturnType<typeof useCharacterSearch>) => void
}): null {
  onRender(useCharacterSearch(partyHost, SEARCH_SLOT_COUNTS.party, vi.fn()))

  return null
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  bridge = {
    connect: vi.fn(),
    begin: vi.fn(async () => CAPTURE_ID),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    dispose: vi.fn()
  }
  mocks.create.mockReset().mockReturnValue(bridge)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <Harness
        onRender={(next) => {
          value = next
        }}
      />
    )
  )
  await act(async () => value.begin(new AbortController().signal))
  await publish(viewWithSlot(ocrSlotWithChoices()))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('캡처 검색이 준 후보를 명성 순으로 늘어놓고 자동으로 고른 후보를 지금 후보로 둔다', () => {
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [SIROCO, CAIN],
    shownServerId: 'cain',
    picking: null
  })
  expect(value.candidatePickers[0]).toBeNull()
})

it('다른 후보를 한 번 누르면 같은 수명에서 그 서버로 조회하고, 조회하는 동안 그 후보를 지금 후보로 둔다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await publish(viewWithSlot(lookupSlot({ state: 'pending', rows: [] }), true))

  expect(bridge.lookup).toHaveBeenCalledExactlyOnceWith({
    slot: SLOT,
    nickname: searchRow.characterName,
    serverId: 'siroco'
  })
  expect(bridge.begin).toHaveBeenCalledOnce()
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [SIROCO, CAIN],
    shownServerId: 'siroco',
    picking: SIROCO
  })
})

it('누른 후보로 확정한 뒤에도 같은 후보 목록을 남겨 다른 후보로 바꿀 수 있다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await publish(viewWithSlot(pickedResult, true))

  expect(value.slots[SLOT]).toEqual(pickedResult)
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [SIROCO, CAIN],
    shownServerId: 'siroco',
    picking: null
  })

  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(lookups()).toEqual(['siroco', 'cain'])
})

it('지금 후보나 후보 창에 없는 서버를 누르면 조회하지 않는다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  await act(async () => value.pickCandidate(SLOT, 'anton'))

  expect(bridge.lookup).not.toHaveBeenCalled()
  expect(value.candidatePickers[SLOT]).toMatchObject({ shownServerId: 'cain', picking: null })
})

it('누른 후보의 조회가 실패해도 후보 목록이 남아 다른 후보를 고를 수 있다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  const failure = lookupSlot({ state: 'failure', rows: [], error: { code: 'NEOPLE_TIMEOUT' } })
  await publish(viewWithSlot(failure, true))

  expect(value.slots[SLOT]).toEqual(failure)
  expect(value.candidatePickers[SLOT]).toMatchObject({ shownServerId: null, picking: null })
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(lookups()).toEqual(['siroco', 'cain'])
})

it('누른 후보로 확정한 뒤 서버 칩으로 직접 조회하면 후보 목록을 버린다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await publish(viewWithSlot(pickedResult, true))

  await act(async () => value.lookupSlot(SLOT, searchRow.characterName, 'anton'))
  await publish(viewWithSlot(lookupSlot({ state: 'pending', rows: [] }), true))

  expect(bridge.lookup).toHaveBeenLastCalledWith({
    slot: SLOT,
    nickname: searchRow.characterName,
    serverId: 'anton'
  })
  expect(value.candidatePickers[SLOT]).toBeNull()
})

it('다음 회차가 슬롯을 OCR 검색으로 되돌리면 누른 후보를 버리고 그 회차의 후보로 다시 판정한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await publish(viewWithSlot(pickedResult, true))

  await act(async () => value.begin(new AbortController().signal))
  await publish(viewWithSlot(ocrSlotWithChoices(NEXT_REQUEST_ID)))

  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [SIROCO, CAIN],
    shownServerId: 'cain',
    picking: null
  })
})

it('서버 없이 이름 칸에서 조회한 결과에 후보가 있으면 후보 창을 두고 서버 칩 조회는 두지 않는다', async () => {
  const lookupResult = lookupSlot({
    state: 'success',
    rows: [searchRow],
    selected: selected('cain'),
    selectionMethod: 'highest-fame',
    choices: [CAIN, SIROCO]
  })
  await act(async () => value.lookupSlot(SLOT, '고친이름'))
  await publish(viewWithSlot(lookupResult, true))

  expect(vi.mocked(bridge.lookup)).toHaveBeenLastCalledWith({
    slot: SLOT,
    nickname: '고친이름',
    serverId: undefined
  })
  expect(value.candidatePickers[SLOT]).toMatchObject({ shownServerId: 'cain' })

  await act(async () => value.lookupSlot(SLOT, '고친이름', 'cain'))
  await publish(viewWithSlot(pickedResult, true))

  expect(value.candidatePickers[SLOT]).toBeNull()
})
