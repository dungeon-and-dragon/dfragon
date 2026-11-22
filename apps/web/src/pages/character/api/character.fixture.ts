import type { GameTextLines, SkillWindowCatalog } from '#entities/catalog'
import type { CharacterDetailView, CharacterHistory, CharacterTimeline } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'

// 캐릭터 상세 화면 테스트의 fixture에서 만든 story와 MSW handler의 값이다. 이름, 소속과 그림 주소는 실제 캐릭터가 아닌 합성 값이다.

const STORY_IDENTITY = {
  dealer: { characterId: 'story-dealer', characterName: '캐릭터1', fame: 136_647 },
  buffer: { characterId: 'story-buffer', characterName: '캐릭터2', fame: 125_689 }
} as const

const STORY_EXALTED_POTENCY: Readonly<Record<string, number>> = { 반지: 100, 보조장비: 90 }

export function storyCharacterDetail(role: 'dealer' | 'buffer'): CharacterDetailView {
  const detail = characterDetailFixture(role)
  const equipment = detail.equipment.equipment.map((item) => {
    const potency = STORY_EXALTED_POTENCY[item.slotName ?? '']

    if (potency === undefined) {
      return item
    }

    return { ...item, potency: { value: potency } }
  })

  return {
    ...detail,
    equipment: { ...detail.equipment, equipment },
    character: {
      ...detail.character,
      ...STORY_IDENTITY[role],
      adventureName: '모험단1',
      guildId: 'guild-1',
      guildName: '길드1'
    },
    freshness: { lastSuccessfulFetchAt: '2026-11-09T05:08:00.000Z' }
  }
}

// Storybook에서 스킬 아이콘이 보이도록 운영 사이트의 스킬 창 데이터 묶음 2ca27db1판 그림을 쓴다. 아이콘 좌표도 그 판의
// 직업 파일 값이다.
const SKILLTAB_ART = 'https://dfragon.com/skilltab/2ca27db1'

const MARKS = {
  evolution: [
    `${SKILLTAB_ART}/marks/evolution-1.ffe62b73.png`,
    `${SKILLTAB_ART}/marks/evolution-2.8cb1d43d.png`
  ],
  enhancement: [
    `${SKILLTAB_ART}/marks/enhancement-1.b6bca15d.png`,
    `${SKILLTAB_ART}/marks/enhancement-2.4e92cb62.png`
  ]
} satisfies SkillWindowCatalog['marks']

function gameText(text: string): GameTextLines {
  return [[{ text, tone: 'default' }]]
}

export const storySkillWindowCatalog: SkillWindowCatalog = {
  marks: MARKS,
  job: {
    jobId: 'at_priest',
    jobName: '프리스트(여)',
    sprite: `${SKILLTAB_ART}/sprites/at_priest.98433654.png`,
    advancements: [
      {
        growtype: 2,
        name: '이단심판관',
        awakeningNames: ['헬베루스', '인페르노', '眞 이단심판관'],
        slots: [
          { skillId: 1, col: 0, row: 0, nextSkills: [] },
          { skillId: 2, col: 3, row: 1, nextSkills: [] },
          { skillId: 3, col: 1, row: 7, nextSkills: [] },
          { skillId: 4, col: 2, row: 9, nextSkills: [] },
          { skillId: 5, col: 3, row: 6, nextSkills: [] }
        ]
      }
    ],
    skills: {
      1: {
        name: '기본기 숙련',
        kind: 'passive',
        requiredLevel: 1,
        maxLevel: 115,
        icon: { x: 140, y: 196 },
        stage: false
      },
      2: {
        name: '배우지 않은 스킬',
        kind: 'active',
        requiredLevel: 1,
        maxLevel: 10,
        icon: { x: 28, y: 0 },
        stage: false
      },
      3: {
        name: '세례의 불길',
        kind: 'active',
        requiredLevel: 35,
        maxLevel: 60,
        icon: { x: 280, y: 56 },
        stage: false,
        evolution: [
          {
            name: '정화의 세례',
            basicExplain: gameText('범위 증가'),
            explain: [[{ text: '[세례의 불길]', tone: 'default' }], ...gameText('범위 30% 증가')]
          },
          {
            name: '심판의 세례',
            basicExplain: gameText('시전 시간 감소'),
            explain: gameText('시전 시간 감소')
          }
        ]
      },
      4: {
        name: '참수',
        kind: 'active',
        requiredLevel: 45,
        maxLevel: 60,
        icon: { x: 364, y: 56 },
        stage: false,
        evolution: [
          { name: '단죄', basicExplain: gameText('공격력 증가'), explain: gameText('공격력 증가') },
          { name: '처형', basicExplain: gameText('딜레이 캔슬'), explain: gameText('딜레이 캔슬') }
        ],
        enhancement: {
          1: { explain: gameText('데미지 증가') },
          2: { explain: gameText('데미지 증가, 쿨타임 감소') }
        }
      },
      5: {
        name: '성화',
        kind: 'active',
        requiredLevel: 25,
        maxLevel: 60,
        icon: { x: 196, y: 56 },
        stage: false,
        enhancement: {
          1: { explain: gameText('데미지 증가') },
          2: { explain: gameText('데미지 증가, 쿨타임 감소') }
        }
      }
    }
  }
}

export const storyBuffSkillWindowCatalog: SkillWindowCatalog = {
  marks: MARKS,
  job: {
    jobId: 'archer',
    jobName: '아처',
    sprite: `${SKILLTAB_ART}/sprites/archer.16ceb474.png`,
    advancements: [
      {
        growtype: 1,
        name: '뮤즈',
        awakeningNames: ['眞 뮤즈'],
        slots: [{ skillId: 48, col: 0, row: 3, nextSkills: [] }]
      }
    ],
    skills: {
      48: {
        name: '러블리 템포',
        kind: 'active',
        requiredLevel: 30,
        maxLevel: 40,
        icon: { x: 364, y: 56 },
        stage: false
      }
    }
  }
}

export const storyTimeline: CharacterTimeline = {
  seasonClears: [
    { kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 },
    { kind: 'raid', name: '나벨 레이드', hard: true, count: 2 },
    { kind: 'raid', name: '나벨 레이드', hard: false, count: 1 },
    { kind: 'legion', name: '베누스', hard: false, count: 12 }
  ],
  enhancements: [
    {
      kind: 'reinforce',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '에픽',
      before: 13,
      after: 14,
      result: true,
      safe: true,
      occurredAt: '2026-11-04T01:02:00.000Z'
    },
    {
      kind: 'amplify',
      itemId: 'item-2',
      itemName: '합성 상의',
      itemRarity: '태초',
      before: 10,
      after: 0,
      result: false,
      safe: false,
      occurredAt: '2026-11-03T23:59:00.000Z'
    },
    {
      kind: 'refine',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '에픽',
      before: null,
      after: 8,
      result: true,
      safe: null,
      occurredAt: '2026-11-03T00:00:00.000Z'
    }
  ],
  enhancementsCursor: null,
  acquisitions: [
    {
      code: 505,
      name: '아이템 획득(던전 드랍)',
      itemId: 'item-3',
      itemName: '합성 하의',
      itemRarity: '태초',
      occurredAt: '2026-11-02T10:00:00.000Z'
    },
    {
      code: 550,
      name: '항아리 획득',
      itemId: 'item-4',
      itemName: '합성 신발',
      itemRarity: '에픽',
      occurredAt: '2026-11-01T10:00:00.000Z'
    }
  ],
  acquisitionsCursor: null
}

const HISTORY_FIRST = '2026-11-05T13:00:00.000Z'
const HISTORY_MIDDLE = '2026-11-13T11:40:00.000Z'
const HISTORY_LATEST = '2026-11-17T13:09:00.000Z'

export const storyHistory: CharacterHistory = {
  basics: [
    { observedAt: HISTORY_FIRST, fame: 134861 },
    { observedAt: HISTORY_MIDDLE, fame: 135980 },
    { observedAt: HISTORY_LATEST, fame: 136647 }
  ],
  scores: [
    { observedAt: HISTORY_FIRST, calculator: 'equipment', value: 1268402, approximate: null },
    { observedAt: HISTORY_MIDDLE, calculator: 'equipment', value: 1338770, approximate: null },
    { observedAt: HISTORY_LATEST, calculator: 'equipment', value: 1369647, approximate: null }
  ],
  sectionChanges: {
    equipment: [HISTORY_FIRST, HISTORY_MIDDLE, HISTORY_LATEST],
    avatar: [HISTORY_FIRST]
  },
  nameChanges: [
    { kind: 'character', at: '2025-01-23T13:52:00.000Z', before: '캐릭터3', after: '캐릭터1' },
    { kind: 'adventure', at: '2026-01-28T19:29:00.000Z', before: '모험단2', after: '모험단1' }
  ],
  changes: [
    { observedAt: HISTORY_FIRST, first: true, items: [] },
    {
      observedAt: HISTORY_MIDDLE,
      first: false,
      items: [
        {
          kind: 'equipment',
          slotId: 'SHOES',
          slotName: '신발',
          itemName: '고요한 안식의 신발',
          itemRarity: '에픽',
          replaced: null,
          fields: [{ field: 'reinforce', name: null, before: 11, after: 12 }]
        }
      ]
    },
    {
      observedAt: HISTORY_LATEST,
      first: false,
      items: [
        {
          kind: 'equipment',
          slotId: 'WEAPON',
          slotName: '무기',
          itemName: '검은 질병의 멸룡검 발뭉',
          itemRarity: '태초',
          replaced: null,
          fields: [{ field: 'refine', name: null, before: 7, after: 8 }]
        },
        {
          kind: 'equipment',
          slotId: 'JACKET',
          slotName: '상의',
          itemName: '긍휼 속 자비의 상의',
          itemRarity: '에픽',
          replaced: null,
          fields: [{ field: 'enchant', name: '최종 데미지 증가', before: '1%', after: '3%' }]
        }
      ]
    }
  ]
}

export const storySingleHistory: CharacterHistory = {
  basics: [{ observedAt: HISTORY_LATEST, fame: 136647 }],
  scores: [
    { observedAt: HISTORY_LATEST, calculator: 'equipment', value: 1369647, approximate: null }
  ],
  sectionChanges: { equipment: [HISTORY_LATEST] },
  nameChanges: [],
  changes: [{ observedAt: HISTORY_LATEST, first: true, items: [] }]
}
