import { describe, expect, it } from 'vitest'
import type { SelectedCharacterSummary } from '../preload/common/types/character'
import type { SearchSlot } from '../preload/common/types/search'
import { dealerCard } from '../testing/fixtures/character-cards'
import { searchSlotNotice, toCharacterCard } from './character-card'

const summary: SelectedCharacterSummary = {
  characterId: 'fixture-character',
  characterName: '실제이름',
  serverId: 'cain',
  serverName: '카인',
  adventureName: null,
  jobName: '직업',
  jobGrowName: null,
  level: 115,
  fame: 0,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/fixture-character?zoom=1',
  guildName: null,
  equipmentScore: null,
  card: null
}

it('선택한 기본 정보와 명성 0을 보존하고 main이 넘기지 않은 카드 값을 만들어내지 않는다', () => {
  expect(toCharacterCard(summary)).toEqual({
    characterId: 'fixture-character',
    name: '실제이름',
    serverId: 'cain',
    adventure: '-',
    job: '직업',
    level: 115,
    fame: 0,
    guild: null,
    card: null,
    image: summary.imageUrl,
    face: null
  })
  expect(toCharacterCard({ ...summary, fame: null, level: null, jobName: null })).toMatchObject({
    fame: null,
    level: null,
    job: '-'
  })
  expect(
    toCharacterCard({
      ...summary,
      guildName: '길드',
      equipmentScore: 414806,
      card: dealerCard
    })
  ).toMatchObject({ guild: '길드', card: dealerCard })
  expect(toCharacterCard(undefined)).toBeUndefined()
  expect(toCharacterCard({ ...summary, serverId: 'unknown' })).toBeUndefined()
})

it('기본 직업이 얼굴 위치 표에 있으면 이미지 속 그 직업의 얼굴 칸을 카드에 넘긴다', () => {
  expect(toCharacterCard({ ...summary, jobName: '마법사(여)' })?.face).toEqual({
    x: 85,
    y: 108,
    width: 26,
    height: 26
  })
})

describe('실패 행의 한 줄 문구', () => {
  const failed: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'failure',
    rows: [],
    error: { code: 'NEOPLE_UNAVAILABLE', message: '서버가 보낸 문구' }
  }

  it('검색 오류는 API가 보낸 문구를 그대로 빨간 오류로 보인다', () => {
    expect(searchSlotNotice(failed)).toEqual({ text: '서버가 보낸 문구', tone: 'error' })
  })

  it('응답을 받지 못한 실패만 클라이언트 문구를 쓴다', () => {
    expect(searchSlotNotice({ ...failed, error: { code: 'SEARCH_NETWORK_ERROR' } })).toEqual({
      text: '검색 서버에 연결하지 못했습니다. 다시 시도해 주세요.',
      tone: 'error'
    })
  })

  it('결과 0건과 오류가 없는 실패는 노란 찾지 못함 문구다', () => {
    const notFound = { text: '캐릭터를 찾지 못함', tone: 'failure' }

    expect(searchSlotNotice({ ...failed, state: 'empty', error: null })).toEqual(notFound)
    expect(searchSlotNotice({ ...failed, error: null })).toEqual(notFound)
  })

  it('OCR이 이름을 읽지 못한 실패는 직접 입력을 노란 문구로 안내한다', () => {
    expect(
      searchSlotNotice({ ...failed, nickname: '', error: { code: 'INVALID_SEARCH_QUERY' } })
    ).toEqual({ text: '닉네임을 읽지 못했습니다. 직접 입력해 주세요.', tone: 'failure' })
  })

  it('상세 정보 오류는 API 문구를, 받기 전에 멈춘 상세는 다시 조회 안내를 보인다', () => {
    const found: SearchSlot = {
      ...failed,
      state: 'success',
      error: null,
      selected: summary,
      details: 'failed'
    }

    expect(
      searchSlotNotice({ ...found, detailsError: { code: 'NEOPLE_TIMEOUT', message: '상세 문구' } })
    ).toEqual({ text: '상세 문구', tone: 'error' })
    expect(searchSlotNotice(found)).toEqual({
      text: '상세 정보를 불러오지 못했습니다. 서버와 이름을 직접 조회하면 다시 불러옵니다.',
      tone: 'error'
    })
  })

  it('조회 중인 행에는 문구가 없다', () => {
    expect(searchSlotNotice({ ...failed, state: 'pending', error: null })).toBeUndefined()
  })
})

it('파티 카드의 최고 명성 선택은 후보 창 여부와 무관하게 선택 근거 안내를 두지 않는다', () => {
  const slot: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'success',
    rows: [],
    error: null,
    selected: summary,
    selectionMethod: 'highest-fame'
  }
  const choices = [
    { ...summary, adventureName: null },
    { ...summary, serverId: 'siroco', serverName: '시로코', adventureName: null }
  ].map(({ characterId, characterName, serverId, serverName, fame, adventureName }) => ({
    characterId,
    characterName,
    serverId,
    serverName,
    fame,
    adventureName
  }))

  expect(searchSlotNotice(slot)).toBeUndefined()
  expect(searchSlotNotice({ ...slot, choices })).toBeUndefined()
})

describe('공대 카드의 선택 근거 안내', () => {
  const base: SearchSlot = {
    slot: 0,
    observationRevision: 1,
    requestId: 'request',
    nickname: '이름',
    state: 'success',
    rows: [],
    error: null,
    selected: summary
  }
  const choices = [{ ...summary, adventureName: null }].map(
    ({ characterId, characterName, serverId, serverName, fame, adventureName }) => ({
      characterId,
      characterName,
      serverId,
      serverName,
      fame,
      adventureName
    })
  )

  it.each(['job', 'fame'] as const)(
    '%s로 확정한 선택은 안내 없이 스탯 줄을 보인다',
    (selectionMethod) => {
      expect(searchSlotNotice({ ...base, selectionMethod }, 'raid')).toBeUndefined()
    }
  )

  it.each([['fame', '명성으로 추정한 후보입니다.']] as const)(
    '%s로 확정하지 못한 선택은 추정 안내를 보인다',
    (selectionMethod, notice) => {
      expect(searchSlotNotice({ ...base, selectionMethod, choices }, 'raid')).toEqual({
        text: notice,
        tone: 'estimate'
      })
    }
  )

  it('최고 명성 선택은 후보 창 여부와 무관하게 직업과 수치를 확인하지 못했다고 안내한다', () => {
    const estimate = { text: '직업과 수치 미확인, 최고 명성 후보입니다.', tone: 'estimate' }

    expect(searchSlotNotice({ ...base, selectionMethod: 'highest-fame' }, 'raid')).toEqual(estimate)
    expect(searchSlotNotice({ ...base, selectionMethod: 'highest-fame', choices }, 'raid')).toEqual(
      estimate
    )
    expect(searchSlotNotice({ ...base, selectionMethod: 'highest-fame' })).toBeUndefined()
  })
})
