// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type { GameTextLines } from '@dfragon/client-core/shared/search/game-text'
import type { SkillWindowCatalog } from '@dfragon/client-core/shared/search/skill-window'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { type ClientHost, ClientHostContext } from '../../../host/client-host'
import { createTestClientHost } from '../../../testing/test-support/client-host'
import { TestQueryClient } from '../../../testing/test-support/test-query-client'
import { SkillTab } from './SkillTab'

const MARKS = {
  evolution: [
    'https://skilltab.test/marks/evolution-1.png',
    'https://skilltab.test/marks/evolution-2.png'
  ],
  enhancement: [
    'https://skilltab.test/marks/enhancement-1.png',
    'https://skilltab.test/marks/enhancement-2.png'
  ]
} satisfies SkillWindowCatalog['marks']

function gameText(text: string): GameTextLines {
  return [[{ text, tone: 'default' }]]
}

// 저장소 fixture(프리스트(여) 眞 이단심판관)의 스킬 이름으로 만든 합성 배치다.
const CATALOG: SkillWindowCatalog = {
  marks: MARKS,
  job: {
    jobId: 'at_priest',
    jobName: '프리스트(여)',
    sprite: 'https://skilltab.test/sprites/at_priest.png',
    advancements: [
      {
        growtype: 2,
        name: '이단심판관',
        awakeningNames: ['헬베루스', '인페르노', '眞 이단심판관'],
        slots: [
          { skillId: 1, col: 0, row: 0, nextSkills: [] },
          { skillId: 2, col: 3, row: 1, nextSkills: [] }
        ]
      }
    ],
    skills: {
      1: {
        name: '기본기 숙련',
        kind: 'passive',
        requiredLevel: 1,
        maxLevel: 115,
        icon: { x: 0, y: 0 },
        stage: false
      },
      2: {
        name: '배우지 않은 스킬',
        kind: 'active',
        requiredLevel: 1,
        maxLevel: 10,
        icon: { x: 28, y: 0 },
        stage: false
      }
    }
  }
}

const PRIEST = CATALOG.job
const [INQUISITOR] = PRIEST.advancements
if (INQUISITOR === undefined) {
  throw new Error('합성 배치에 직업이 없다')
}

// 개화, 강화할 수 있는 스킬을 더한 배치다. fixture에서 세례의 불길은 개화 Ⅰ, 참수는 개화 Ⅱ와 강화 데미지를 골랐고,
// 성화는 아무것도 고르지 않았다.
const CATALOG_WITH_UPGRADES: SkillWindowCatalog = {
  ...CATALOG,
  job: {
    ...PRIEST,
    advancements: [
      {
        ...INQUISITOR,
        slots: [
          ...INQUISITOR.slots,
          { skillId: 3, col: 1, row: 7, nextSkills: [] },
          { skillId: 4, col: 2, row: 9, nextSkills: [] },
          { skillId: 5, col: 3, row: 6, nextSkills: [] }
        ]
      }
    ],
    skills: {
      ...PRIEST.skills,
      3: {
        name: '세례의 불길',
        kind: 'active',
        requiredLevel: 35,
        maxLevel: 60,
        icon: { x: 56, y: 0 },
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
        icon: { x: 84, y: 0 },
        stage: false,
        evolution: [
          {
            name: '단죄',
            basicExplain: gameText('공격력 증가'),
            explain: gameText('공격력 증가')
          },
          {
            name: '처형',
            basicExplain: gameText('딜레이 캔슬'),
            explain: gameText('딜레이 캔슬')
          }
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
        icon: { x: 112, y: 0 },
        stage: false,
        enhancement: {
          1: { explain: gameText('데미지 증가') },
          2: { explain: gameText('데미지 증가, 쿨타임 감소') }
        }
      }
    }
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function render(host: ClientHost, detail: CharacterDetailView): Promise<void> {
  await act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>
          <SkillTab detail={detail} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

// jsdom은 StyleX의 동적 값을 CSS 변수로만 받으므로, style 속성에 sprite 주소와 위치가 들어갔는지 본다.
function spriteAt(position: string): unknown {
  return expect.stringMatching(
    new RegExp(`url\\("https://skilltab\\.test/sprites/at_priest\\.png"\\).*${position}`)
  )
}

function iconTexts(): string[][] {
  return [...container.querySelectorAll('[role="group"][aria-label="스킬 창"] [role="img"]')].map(
    (image) => [
      image.getAttribute('aria-label') ?? '',
      image.getAttribute('style') ?? '',
      image.parentElement?.nextElementSibling?.textContent ?? ''
    ]
  )
}

it('스킬 창 데이터가 있는 전직은 배치에 아이콘을 두고 배운 스킬에만 레벨을 보인다', async () => {
  const getSkillWindowCatalog = vi.fn(async () => CATALOG)
  await render(createTestClientHost({ getSkillWindowCatalog }), characterDetailFixture('dealer'))

  expect(getSkillWindowCatalog).toHaveBeenCalledWith('프리스트(여)')
  expect(iconTexts()).toEqual([
    ['기본기 숙련', spriteAt('0px 0px'), 'Lv 115'],
    ['배우지 않은 스킬', spriteAt('-28px 0px'), '']
  ])
  expect(container.querySelector('[aria-label="배운 스킬"]')).toBeNull()
})

it('스킬 창 데이터가 없으면 배운 스킬을 습득 레벨 줄로 나눈 목록으로 보인다', async () => {
  await render(createTestClientHost(), characterDetailFixture('dealer'))

  const rows = container.querySelectorAll('[aria-label="배운 스킬"] section')
  expect(container.querySelector('[aria-label="스킬 창"]')).toBeNull()
  expect(rows[0]?.querySelector('h3')?.textContent).toBe('1레벨')
  expect([...(rows[0]?.querySelectorAll('li') ?? [])].map((row) => row.textContent)).toContain(
    '기본기 숙련Lv 115'
  )
})

it('스킬 창 데이터를 받지 못해도 배운 스킬 목록으로 보인다', async () => {
  await render(
    createTestClientHost({
      getSkillWindowCatalog: async () => {
        throw new Error('스킬 창 데이터를 받지 못했습니다(HTTP 503).')
      }
    }),
    characterDetailFixture('dealer')
  )

  expect(container.querySelector('[aria-label="배운 스킬"]')).not.toBeNull()
})

it('스킬 개화와 강화는 스킬 이름과 type 숫자로 나열한다', async () => {
  await render(createTestClientHost(), characterDetailFixture('dealer'))

  const rowsOf = (label: string) =>
    [...container.querySelectorAll(`section[aria-label="${label}"] li`)].map((row) =>
      [...row.children].map((cell) => cell.textContent)
    )
  expect(rowsOf('스킬 개화')).toEqual([
    ['세례의 불길', '1'],
    ['즉결심판', '1'],
    ['참수', '2'],
    ['역죄단멸', '1'],
    ['신벌', '1']
  ])
  expect(rowsOf('스킬 강화')).toEqual([
    ['즉결심판', '1'],
    ['참수', '1'],
    ['신벌', '1']
  ])
})

it('개화는 배울 수 있는 스킬을 모두, 강화는 강화한 스킬만 두고 고른 갈래만 표시한다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }),
    characterDetailFixture('dealer')
  )

  expect(container.querySelector('section[aria-label="스킬 개화"] h2')?.textContent).toBe(
    '스킬 개화'
  )
  expect(container.querySelector('section[aria-label="스킬 강화"] h2')?.textContent).toBe(
    '스킬 강화'
  )
  const picked = (label: string) =>
    [...container.querySelectorAll(`section[aria-label="${label}"] [aria-current="true"]`)].map(
      (branch) => branch.textContent
    )
  expect(picked('스킬 개화')).toEqual(['정화의 세례', '처형'])
  expect(picked('스킬 강화')).toEqual(['데미지'])
  expect(
    [...container.querySelectorAll('section[aria-label="스킬 강화"] li')].map((row) =>
      [...row.querySelectorAll('img[src*="marks/enhancement"]')].map(
        (mark) => mark.parentElement?.textContent
      )
    )
  ).toEqual([['데미지', '쿨타임 감소']])
  expect(
    [...container.querySelectorAll('section[aria-label="스킬 강화"] li')].map(
      (row) => row.textContent
    )
  ).toEqual(['참수45레벨데미지쿨타임 감소'])
})

it('강화한 스킬이 없으면 스킬 강화 없음 한 줄을 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  const skillStyle = detail.skillStyle
  if (skillStyle?.style == null) {
    throw new Error('딜러 fixture에 스킬 스타일이 없다')
  }
  await render(createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }), {
    ...detail,
    skillStyle: { ...skillStyle, style: { ...skillStyle.style, enhancement: [] } }
  })

  expect(container.textContent).toContain('스킬 강화 없음')
  expect(container.querySelector('section[aria-label="스킬 강화"]')).toBeNull()
})

it('개화 갈래만 설명 창을 여는 버튼이고 강화 칸은 설명 창이 없다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }),
    characterDetailFixture('dealer')
  )

  expect(container.querySelectorAll('section[aria-label="스킬 개화"] button')).toHaveLength(4)
  expect(container.querySelectorAll('section[aria-label="스킬 강화"] button')).toHaveLength(0)
})

it('스킬 창 아이콘에 고른 개화 마름모와 강화 표식을 붙인다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }),
    characterDetailFixture('dealer')
  )

  const marksOf = (name: string) =>
    [
      ...(container
        .querySelector(`[aria-label="스킬 창"] [role="img"][aria-label="${name}"]`)
        ?.parentElement?.querySelectorAll('img') ?? [])
    ].map((mark) => mark.getAttribute('src'))
  expect(marksOf('세례의 불길')).toEqual(['https://skilltab.test/marks/evolution-1.png'])
  expect(marksOf('참수')).toEqual([
    'https://skilltab.test/marks/evolution-2.png',
    'https://skilltab.test/marks/enhancement-1.png'
  ])
  expect(marksOf('성화')).toEqual([])
})

it('스킬 창과 개화, 강화 표의 마크는 드래그되지 않는다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }),
    characterDetailFixture('dealer')
  )

  for (const label of ['스킬 창', '스킬 개화', '스킬 강화']) {
    const marks = container.querySelectorAll<HTMLImageElement>(`[aria-label="${label}"] img`)
    expect(marks.length).toBeGreaterThan(0)
    expect([...marks].every((mark) => !mark.draggable)).toBe(true)
  }
})

it('스킬 트리 코드와 체인 스킬 이름을 보인다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG_WITH_UPGRADES }),
    characterDetailFixture('dealer')
  )

  expect(container.querySelector('section[aria-label="스킬 트리 코드"] code')?.textContent).toMatch(
    /^eJyNjDFOAlEARN9b/
  )
  expect(container.querySelector('section[aria-label="스킬 체인"] h2')?.textContent).toBe(
    '스킬 체인'
  )
  expect(
    [...container.querySelectorAll('section[aria-label="스킬 체인"] li')].map(
      (link) => link.textContent
    )
  ).toEqual(['세례의 불길', '성염의 쇄도', '성화', '즉결심판'])
})

it('스킬 체인을 쓰지 않는 캐릭터는 체인 없음 한 줄을 보인다', async () => {
  await render(createTestClientHost(), characterDetailFixture('buffer'))

  expect(container.textContent).toContain('스킬 체인 없음')
  expect(container.querySelector('section[aria-label="스킬 체인"]')).toBeNull()
})

it('스킬 창이 있으면 그 전직의 스킬 채택률을 받고, 배운 스킬 목록이면 받지 않는다', async () => {
  const getSkillStats = vi.fn(() => new Promise<never>(() => {}))
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG, getSkillStats }),
    characterDetailFixture('dealer')
  )

  expect(getSkillStats).toHaveBeenCalledWith({
    jobId: '0c1b401bb09241570d364420b3ba3fd7',
    jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7'
  })

  getSkillStats.mockClear()
  await act(async () => root.unmount())
  root = createRoot(container)
  await render(createTestClientHost({ getSkillStats }), characterDetailFixture('dealer'))

  expect(container.querySelector('[aria-label="배운 스킬"]')).not.toBeNull()
  expect(getSkillStats).not.toHaveBeenCalled()
})
