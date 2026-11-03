import { describe, expect, it } from 'vitest'
import { searchSlot } from '../preload/api/search-test-fixture'
import type { SelectedCharacterSummary } from '../preload/common/types/character'
import type { SearchSlot } from '../preload/common/types/search'
import { filledSlotCount, toSlotCards } from './slot-cards'

const summary: SelectedCharacterSummary = {
  characterId: 'synthetic-character',
  characterName: '합성',
  serverId: 'cain',
  serverName: '카인',
  adventureName: '모험단',
  jobName: '직업',
  jobGrowName: null,
  level: 115,
  fame: 100,
  imageUrl: '',
  guildName: null,
  equipmentScore: null,
  card: null
}

function slot(state: SearchSlot['state'], overrides: Partial<SearchSlot> = {}): SearchSlot {
  return searchSlot({ state, ...overrides })
}

function input(
  slots: SearchSlot[],
  overrides: Partial<Parameters<typeof toSlotCards>[0]> = {}
): Parameters<typeof toSlotCards>[0] {
  return {
    slots,
    nicknames: slots.map(() => null),
    manualSlots: slots.map(() => false),
    recognizing: false,
    snapshotMarks: [],
    snapshotAdventureInputs: [],
    ...overrides
  }
}

describe('toSlotCards', () => {
  it('슬롯마다 검색 상태와 찾은 캐릭터를 카드 값으로 옮긴다', () => {
    const [found, idle] = toSlotCards(
      input([slot('success', { selected: summary }), slot('idle', { nickname: null })])
    )

    expect(found.state).toBe('success')
    expect(found.character).toMatchObject({ name: '합성', adventure: '모험단', job: '직업' })
    expect(idle.state).toBe('idle')
    expect(idle.character).toBeUndefined()
  })

  it('상세를 채우는 중인 슬롯은 점수 대기로, 받지 못한 슬롯은 직접 조회 안내로 보인다', () => {
    const [pending, failed, filled] = toSlotCards(
      input(
        [
          slot('success', { selected: summary, details: 'pending' }),
          slot('success', { selected: summary, details: 'failed' }),
          slot('success', { selected: summary })
        ],
        { screen: 'raid' }
      )
    )

    expect(pending).toMatchObject({ scorePending: true, character: { name: '합성' } })
    expect(pending.notice).toBeUndefined()
    expect(failed).toMatchObject({
      scorePending: false,
      notice: {
        text: '상세 정보를 불러오지 못했습니다. 서버와 이름을 직접 조회하면 다시 불러옵니다.',
        tone: 'error'
      }
    })
    expect(filled.scorePending).toBe(false)
  })

  it('인식한 이름이 없는 슬롯은 nickname을 비운다', () => {
    const [named, unnamed] = toSlotCards(
      input([slot('idle'), slot('idle')], { nicknames: ['OCR첫후보', null] })
    )

    expect(named.nickname).toBe('OCR첫후보')
    expect(unnamed.nickname).toBeUndefined()
  })

  it('실패한 슬롯에는 실패 문구 한 줄만 두고 다음 조회 안내를 덧붙이지 않는다', () => {
    const [failed, pending] = toSlotCards(
      input([slot('failure', { error: { code: 'SEARCH_TIMEOUT' } }), slot('pending')])
    )

    expect(failed.notice).toEqual({
      text: '검색 시간이 초과됐습니다. 다시 시도해 주세요.',
      tone: 'error'
    })
    expect(pending.notice).toBeUndefined()
  })

  it('공대 화면은 최고 명성 선택에 직업과 수치 안내를, 파티 화면은 안내를 두지 않는다', () => {
    const slots = [slot('success', { selected: summary, selectionMethod: 'highest-fame' })]

    expect(toSlotCards(input(slots, { screen: 'raid' }))[0].notice).toEqual({
      text: '직업과 수치 미확인, 최고 명성 후보입니다.',
      tone: 'estimate'
    })
    expect(toSlotCards(input(slots))[0].notice).toBeUndefined()
  })

  it('인식하는 동안 직접 조회하지 않은 슬롯만 진행 중으로 보인다', () => {
    const slots = [slot('idle'), slot('idle')]
    const manualSlots = [true, false]

    const recognizing = toSlotCards(input(slots, { manualSlots, recognizing: true }))
    const idle = toSlotCards(input(slots, { manualSlots, recognizing: false }))

    expect(recognizing.map((card) => card.loading)).toEqual([false, true])
    expect(idle.map((card) => card.loading)).toEqual([false, false])
  })

  it('누른 후보를 조회하는 동안에는 그 후보의 이름, 서버, 명성과 초상화로 확정 중 카드를 만든다', () => {
    const choice = {
      characterId: 'synthetic-siroco',
      characterName: '합성',
      serverId: 'siroco',
      serverName: '시로코',
      fame: 250,
      adventureName: null
    }
    const picker = { choices: [choice], shownServerId: 'siroco', picking: choice }

    const [card] = toSlotCards(
      input([slot('pending', { selected: summary })], { candidatePickers: [picker] })
    )

    expect(card).toMatchObject({ state: 'success', picking: true, picker })
    expect(card.character).toMatchObject({
      name: '합성',
      serverId: 'siroco',
      fame: 250,
      image: 'https://img-api.neople.co.kr/df/servers/siroco/characters/synthetic-siroco?zoom=1'
    })
  })

  it('스냅샷 표시를 같은 슬롯 번호의 카드에 붙인다', () => {
    const moved = { kind: 'moved', seat: 2 } as const
    const cards = toSlotCards(
      input([slot('idle'), slot('idle'), slot('idle')], { snapshotMarks: [undefined, moved] })
    )

    expect(cards.map((card) => card.snapshotMark)).toEqual([undefined, moved, undefined])
  })

  it('스냅샷 모험단 입력은 검색 실패와 결과 0건 카드에만 붙인다', () => {
    const cards = toSlotCards(
      input(
        [
          slot('success', { selected: summary }),
          slot('failure'),
          slot('empty'),
          slot('idle'),
          slot('pending')
        ],
        { snapshotAdventureInputs: ['', '실패', '', '빈자리', '조회중'] }
      )
    )

    expect(cards.map((card) => card.snapshotAdventureInput)).toEqual([
      undefined,
      '실패',
      '',
      undefined,
      undefined
    ])
  })
})

describe('filledSlotCount', () => {
  it('캐릭터를 찾은 슬롯만 센다', () => {
    const cards = toSlotCards(
      input([
        slot('success', { selected: summary }),
        slot('success'),
        slot('pending', { selected: summary }),
        slot('idle')
      ])
    )

    expect(filledSlotCount(cards)).toBe(1)
  })
})
