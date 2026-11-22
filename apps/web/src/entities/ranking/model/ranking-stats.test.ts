import { describe, expect, it } from 'vitest'
import { fameRankingSchema } from './ranking-stats'

// 합성 응답이다. API가 세트 필드와 nextCursor를 더한 뒤의 명성 랭킹 응답 모양이다.
const row = {
  serverId: 'cain',
  characterId: 'synthetic-character',
  characterName: '합성캐릭터',
  adventureName: '합성모험단',
  level: 115,
  jobId: 'synthetic-job',
  jobGrowId: 'synthetic-grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  fame: 80000,
  guildId: null,
  guildName: null,
  fetchedAt: '2026-11-18T00:00:00.000Z',
  role: 'dealer'
}

describe('fameRankingSchema', () => {
  it('세트 필드와 nextCursor가 더해진 응답을 rank가 있든 없든 읽는다', () => {
    const response = {
      characters: [
        {
          ...row,
          rank: 1,
          equipmentSet: { id: 'set-fairy', name: '소울 페어리 세트' },
          oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' }
        },
        { ...row, characterId: 'synthetic-no-sets', equipmentSet: null, oathSet: null }
      ],
      nextCursor: 'WzgwMDAwLCJjYWluIiwic3ludGhldGljLW5vLXNldHMiLDJd'
    }

    const parsed = fameRankingSchema.safeParse(response)

    expect(parsed.success).toBe(true)
    expect(parsed.data?.characters.map(({ characterId }) => characterId)).toEqual([
      'synthetic-character',
      'synthetic-no-sets'
    ])
  })

  it('행의 score를 종류, 값, 근사 방식으로 읽고, 근사 방식이 없으면 정확한 점수로, score가 없는 행은 null로 읽으며, 모르는 종류는 거절한다', () => {
    const response = {
      characters: [
        {
          ...row,
          equipmentSet: null,
          oathSet: null,
          score: { calculator: 'buff', value: 4120000 }
        },
        {
          ...row,
          characterId: 'synthetic-approximate',
          equipmentSet: null,
          oathSet: null,
          score: {
            calculator: 'equipment',
            value: 1300000,
            approximate: { source: 'legacy_fusion_policy_a' }
          }
        },
        { ...row, characterId: 'synthetic-null', equipmentSet: null, oathSet: null, score: null },
        { ...row, characterId: 'synthetic-missing', equipmentSet: null, oathSet: null }
      ],
      nextCursor: null
    }

    expect(fameRankingSchema.parse(response).characters.map(({ score }) => score)).toEqual([
      { calculator: 'buff', value: 4120000, approximate: null },
      {
        calculator: 'equipment',
        value: 1300000,
        approximate: { source: 'legacy_fusion_policy_a' }
      },
      null,
      null
    ])
    const unknown = {
      ...response,
      characters: [{ ...response.characters[0], score: { calculator: 'synergy', value: 1 } }]
    }
    expect(fameRankingSchema.safeParse(unknown).success).toBe(false)
  })
})
