// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type { SkillWindowCatalog } from '@dfragon/client-core/shared/search/skill-window'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { type ClientHost, ClientHostContext } from '../../../hooks/useClientHost'
import { createTestClientHost } from '../../../testing/test-support/client-host'
import { SkillTab } from './SkillTab'

// 저장소 fixture(프리스트(여) 眞 이단심판관)의 스킬 이름으로 만든 합성 배치다.
const CATALOG: SkillWindowCatalog = {
  pvfSha256: 'synthetic',
  jobs: [
    {
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
          icon: { x: 0, y: 0 }
        },
        2: {
          name: '배우지 않은 스킬',
          kind: 'active',
          requiredLevel: 1,
          maxLevel: 10,
          icon: { x: 28, y: 0 }
        }
      }
    }
  ]
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
        <SkillTab detail={detail} />
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
      image.nextElementSibling?.textContent ?? ''
    ]
  )
}

it('스킬 창 데이터가 있는 전직은 배치에 아이콘을 두고 배운 스킬에만 레벨을 보인다', async () => {
  await render(
    createTestClientHost({ getSkillWindowCatalog: async () => CATALOG }),
    characterDetailFixture('dealer')
  )

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
