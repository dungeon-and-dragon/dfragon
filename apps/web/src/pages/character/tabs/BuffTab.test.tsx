// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import type { SkillWindowCatalog } from '#core/shared/search/skill-window'
import { characterDetailFixture } from '#core/testing/fixtures/character-detail'
import { type ClientHost, ClientHostContext } from '../../../host/client-host'
import { createTestClientHost } from '../../../testing/test-support/client-host'
import { TestQueryClient } from '../../../testing/test-support/test-query-client'
import { styles as rarityTones } from './avatar/ItemName.style'
import { BuffTab } from './BuffTab'

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

// 저장소 fixture(아처 眞 뮤즈)의 버프 스킬 이름으로 만든 합성 배치다.
const MUSE_CATALOG: SkillWindowCatalog = {
  marks: {
    evolution: [
      'https://skilltab.test/marks/evolution-1.png',
      'https://skilltab.test/marks/evolution-2.png'
    ],
    enhancement: [
      'https://skilltab.test/marks/enhancement-1.png',
      'https://skilltab.test/marks/enhancement-2.png'
    ]
  },
  job: {
    jobId: 'archer',
    jobName: '아처',
    sprite: 'https://skilltab.test/sprites/archer.png',
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
        icon: { x: 56, y: 28 },
        stage: false
      }
    }
  }
}

async function render(
  detail: CharacterDetailView,
  host: ClientHost = createTestClientHost()
): Promise<void> {
  await act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>
          <BuffTab detail={detail} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function section(label: string): Element | null {
  return container.querySelector(`section[aria-label="${label}"]`)
}

it('버퍼 버프 스킬은 이름과 레벨만 보이고 스킬 설명 줄은 보이지 않는다', async () => {
  await render(characterDetailFixture('buffer'))

  const skill = section('버프 스킬')!
  expect(skill.querySelector('h2')?.textContent).toBe('러블리 템포')
  expect(skill.querySelector('h2 + span')?.textContent).toBe('Lv.30')
  expect(skill.textContent).not.toContain('지속 시간')
  expect(skill.querySelector('li')).toBeNull()
})

it('스킬 창 데이터에 그 전직의 버프 스킬이 있으면 이름 대신 그 스킬의 sprite 아이콘을 보인다', async () => {
  await render(
    characterDetailFixture('buffer'),
    createTestClientHost({ getSkillWindowCatalog: async () => MUSE_CATALOG })
  )

  const name = section('버프 스킬')!.querySelector('h2')!
  expect(name.textContent).toBe('')
  const icon = name.querySelector('[role="img"]')
  expect(icon?.getAttribute('aria-label')).toBe('러블리 템포')
  // jsdom은 StyleX의 동적 값을 CSS 변수로만 받으므로, style 속성에 sprite 주소와 위치가 들어갔는지 본다.
  expect(icon?.getAttribute('style')).toMatch(
    /url\("https:\/\/skilltab\.test\/sprites\/archer\.png"\).*-56px -28px/
  )
})

it('버퍼 버프 강화 장비와 아바타는 한 테이블에서 장비 뒤에 아바타 순서로 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  const tables = section('버프 강화 장비, 아바타, 크리쳐')!.querySelectorAll('table')
  expect(tables).toHaveLength(1)
  const rows = [...tables[0]!.querySelectorAll('tbody tr')]
  expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(['칭호', '상의'])
  const item = rows[0]!.querySelectorAll('td')[1]
  expect(item?.textContent).toBe('모험가의 의지[빛]')
  const { className } = stylex.props(rarityTones.rare)
  expect(item?.querySelector('b')?.className.split(' ')).toContain(className)
  expect(rows[1]?.textContent).toContain('러블리 템포 스킬Lv +1')
})

it('버프 강화 표의 아바타 행은 클론 아이콘 자리를 비워 두지 않아 장비 행과 아이콘 칸 수가 같다', async () => {
  await render(characterDetailFixture('buffer'))

  const rows = [...section('버프 강화 장비, 아바타, 크리쳐')!.querySelectorAll('tbody tr')]
  const iconCounts = rows.map(
    (row) => row.querySelectorAll('td')[1]?.querySelectorAll('img, span[aria-hidden="true"]').length
  )
  expect(iconCounts).toEqual([1, 1])
})

it('딜러처럼 버프 강화 장비가 없으면 같은 테이블에 아바타 뒤로 크리쳐 행을 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  const tables = section('버프 강화 장비, 아바타, 크리쳐')?.querySelectorAll('table') ?? []
  expect(tables).toHaveLength(1)
  const rows = [...(tables[0]?.querySelectorAll('tbody tr') ?? [])]
  expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(['상의', '크리쳐'])
  expect(rows[1]?.querySelectorAll('td')[1]?.textContent).toBe('2026 쁘띠 발키리')
})

it('이름 없는 크리쳐만 있으면 장비, 아바타, 크리쳐 테이블을 생략한다', async () => {
  const detail = characterDetailFixture('dealer')
  const creature = detail.buff.creature!
  await render({
    ...detail,
    buff: {
      equipment: null,
      avatar: null,
      creature: {
        ...creature,
        creature: creature.creature.map((item) => ({ ...item, itemName: null }))
      }
    }
  })

  expect(section('버프 강화 장비, 아바타, 크리쳐')).toBeNull()
})

it('버프 강화 응답이 없으면 스킬 줄과 장착 목록을 모두 생략한다', async () => {
  const detail = characterDetailFixture('buffer')
  await render({ ...detail, buff: { equipment: null, avatar: null, creature: null } })

  expect(container.querySelectorAll('section')).toHaveLength(0)
})
