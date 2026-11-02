import { describe, expect, it } from 'vitest'
import { dealerCard, scoredDealerCard } from '../../preload/common/search/card-test-fixture'
import { parseSearchSnapshot } from '../../preload/common/search/snapshot'
import { searchRow, searchSlot, withSearchSlot } from '../../preload/api/search-test-fixture'
import type { CharacterCardScore, CharacterDetails } from '../../preload/common/types/character'
import { buildCharacterCard } from '../../shared/search/card-assembler'

const versions = {
  package: 'synthetic-engine 0.1.0',
  rulesRev: 'rev12',
  bundleId: 'phase31-rev12'
}
const buffScore: CharacterCardScore = {
  calculator: 'buff',
  value: 136617,
  skipped: null,
  approximate: null,
  versions
}
const approximateScore: CharacterCardScore = {
  calculator: 'equipment',
  value: null,
  skipped: { kind: 'unresolved', message: '판정 불가' },
  approximate: {
    value: 1650,
    source: 'legacy_fusion_policy_a',
    warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
  },
  versions
}

// 합성 캐릭터의 상세 응답이며 card만 바꿔 가며 쓴다.
function details(card: unknown): CharacterDetails {
  return {
    character: {
      characterId: 'synthetic-character',
      serverId: 'cain',
      serverName: '카인',
      characterName: '합성캐릭터'
    },
    status: { status: null, buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    },
    card: card as CharacterDetails['card']
  }
}

const selected = {
  ...searchRow,
  fame: 0,
  level: null,
  adventureName: null,
  jobName: null,
  jobGrowName: null,
  imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
  guildName: null,
  equipmentScore: null
}

function acceptsCard(card: unknown): boolean {
  const snapshot = withSearchSlot(
    searchSlot({ state: 'success', rows: [searchRow], selected: { ...selected, card } as never })
  )

  return parseSearchSnapshot(snapshot) !== null
}

describe('상세 응답 card에서 카드 읽기', () => {
  it.each([
    ['딜러의 장비 점수', scoredDealerCard(1741)],
    ['버퍼의 버프 점수', { role: 'buffer', score: buffScore }],
    ['역할을 모르는 캐릭터의 점수', { ...scoredDealerCard(1741), role: null }],
    ['건너뛴 결과의 근사값', { role: 'dealer', score: approximateScore }],
    ['점수 없음', dealerCard]
  ] as const)('%s를 API가 보낸 그대로 카드에 넣는다', (_name, apiCard) => {
    const card = buildCharacterCard(details(apiCard))

    expect(card).toEqual(apiCard)
    expect(acceptsCard(card)).toBe(true)
  })

  it('card와 점수에 Desktop이 모르는 칸이 있으면 버리고 역할과 점수만 남긴다', () => {
    const card = buildCharacterCard(
      details({
        role: 'dealer',
        stats: null,
        score: {
          ...scoredDealerCard(1741).score,
          display: { role: 'dealer' },
          versions: { ...versions, engineCommit: 'synthetic' }
        },
        serverRank: null,
        set: null,
        oath: null,
        investment: []
      })
    )

    expect(card).toEqual(scoredDealerCard(1741))
    expect(acceptsCard(card)).toBe(true)
  })

  it.each([
    ['점수 칸 누락', { role: 'buffer' }],
    ['알 수 없는 계산기', { role: 'buffer', score: { ...buffScore, calculator: 'tank' } }],
    [
      '정확한 점수에 붙은 근사값',
      { role: 'buffer', score: { ...buffScore, approximate: approximateScore.approximate } }
    ],
    [
      '빈 버전',
      { role: 'buffer', score: { ...buffScore, versions: { ...versions, package: ' ' } } }
    ]
  ])('%s처럼 점수를 읽지 못하면 역할만 남긴다', (_name, apiCard) => {
    expect(buildCharacterCard(details(apiCard))).toEqual({ role: 'buffer', score: null })
  })

  it.each([
    ['카드 없음', null],
    ['역할 누락', { score: null }],
    ['알 수 없는 역할', { ...scoredDealerCard(1741), role: 'tank' }]
  ])('%s 상세 응답은 카드를 null로 둔다', (_name, apiCard) => {
    expect(buildCharacterCard(details(apiCard))).toBeNull()
  })
})
