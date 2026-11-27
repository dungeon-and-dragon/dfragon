// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureActivity } from '#entities/adventure-guild'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { ADVENTURE_ACTIVITY_URL } from './api/adventure.handlers'
import { storyAdventureActivity } from './api/adventure.fixture'
import { SeasonClears } from './SeasonClears'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function activityWith(summary: Pick<AdventureActivity['summary'], 'raids' | 'legions'>) {
  const activity = storyAdventureActivity(11)

  return { ...activity, summary: { ...activity.summary, ...summary } }
}

async function renderClears(activity: AdventureActivity): Promise<void> {
  server.use(http.get(ADVENTURE_ACTIVITY_URL, () => HttpResponse.json(activity)))
  await act(async () =>
    root.render(
      <TestQueryClient>
        <SeasonClears adventureName="합성 모험단" season={11} />
      </TestQueryClient>
    )
  )
}

function rows(): string[][] {
  return [...container.querySelectorAll('li')].map((row) =>
    [...row.querySelectorAll('span:not([aria-hidden])')]
      .filter((cell) => cell.childElementCount === 0)
      .map((cell) => cell.textContent ?? '')
  )
}

function button(): HTMLButtonElement | null {
  return container.querySelector('section button')
}

async function togglePast(): Promise<void> {
  await act(async () => button()!.click())
}

it('고른 시즌에 나온 컨텐츠만 보이고, 그 전에 나온 컨텐츠는 아래 화살표 버튼으로 펼치고 접는다', async () => {
  await renderClears(
    activityWith({
      raids: [
        {
          name: '무너진 성자 미카엘라 (하드)',
          raid: '무너진 성자 미카엘라',
          stage: '하드',
          count: 3
        },
        { name: '디레지에 레이드 (하드)', raid: '디레지에 레이드', stage: '하드', count: 15 }
      ],
      legions: [
        { name: '아포칼립스', count: 2 },
        { name: '베누스', count: 12 }
      ]
    })
  )

  await vi.waitFor(() =>
    expect(rows().map((row) => row[1])).toEqual(['무너진 성자 미카엘라', '아포칼립스'])
  )
  expect(button()?.getAttribute('aria-label')).toBe('지난 시즌 컨텐츠 2개 보기')
  expect(button()?.getAttribute('aria-expanded')).toBe('false')

  await togglePast()

  expect(rows().map((row) => row[1])).toEqual([
    '무너진 성자 미카엘라',
    '디레지에 레이드',
    '아포칼립스',
    '베누스'
  ])
  expect(button()?.getAttribute('aria-label')).toBe('지난 시즌 컨텐츠 접기')
  expect(button()?.getAttribute('aria-expanded')).toBe('true')

  await togglePast()

  expect(rows()).toHaveLength(2)
})

it('레이드 단계를 한 줄에 모으고, 단계가 없는 횟수는 클리어로 적으며 하드만 붉은 배지다', async () => {
  await renderClears(
    activityWith({
      raids: [
        {
          name: '무너진 성자 미카엘라 (하드)',
          raid: '무너진 성자 미카엘라',
          stage: '하드',
          count: 15
        },
        {
          name: '무너진 성자 미카엘라 (일반)',
          raid: '무너진 성자 미카엘라',
          stage: '일반',
          count: 1203
        },
        {
          name: '무너진 성자 미카엘라 (싱글/매칭)',
          raid: '무너진 성자 미카엘라',
          stage: '싱글/매칭',
          count: 4
        }
      ],
      legions: [{ name: '아포칼립스', count: 12 }]
    })
  )

  await vi.waitFor(() =>
    expect(rows()).toEqual([
      ['레이드', '무너진 성자 미카엘라', '하드', '15', '일반', '1,203', '싱글/매칭', '4'],
      ['레기온', '아포칼립스', '클리어', '12']
    ])
  )
  expect([...container.querySelectorAll('li .badge')].map((badge) => badge.textContent)).toEqual([
    '하드'
  ])
  expect(container.querySelector('li .badge')?.className).toContain('text-fg-danger')
})

it('깨어난 숲의 극과 일반은 한 줄에 모여 극이 하드 칸의 붉은 배지이고, 모두 지난 시즌 컨텐츠면 빈 상태 문구 없이 펼치기 버튼만 둔다', async () => {
  await renderClears(
    activityWith({
      raids: [],
      legions: [
        { name: '깨어난 숲(극)', count: 5 },
        { name: '깨어난 숲(일반)', count: 3 }
      ]
    })
  )
  await vi.waitFor(() => expect(button()).not.toBeNull())
  expect(container.querySelector('section p')).toBeNull()
  expect(rows()).toEqual([])

  await togglePast()

  expect(rows()).toEqual([['레기온', '깨어난 숲', '극', '5', '일반', '3']])
  expect([...container.querySelectorAll('li .badge')].map((badge) => badge.textContent)).toEqual([
    '극'
  ])
  expect(container.querySelector('li .badge')?.className).toContain('text-fg-danger')
})

it('레이드 이름과 단계를 보내지 않는 API의 레이드와 출시일을 모르는 이름은 숨기지 않고 이름마다 한 줄로 보인다', async () => {
  await renderClears(
    activityWith({
      raids: [
        { name: '가 레이드 (하드)', count: 3 },
        { name: '가 레이드 (일반)', count: 5 }
      ],
      legions: []
    })
  )

  await vi.waitFor(() =>
    expect(rows()).toEqual([
      ['레이드', '가 레이드 (하드)', '클리어', '3'],
      ['레이드', '가 레이드 (일반)', '클리어', '5']
    ])
  )
  expect(button()).toBeNull()
})

it('클리어가 없는 시즌은 제목 없이 빈 상태 한 줄만 보인다', async () => {
  await renderClears(activityWith({ raids: [], legions: [] }))

  await vi.waitFor(() =>
    expect(container.querySelector('section[aria-label="시즌 클리어"]')?.textContent).toBe(
      '클리어 기록이 없습니다.'
    )
  )
  expect(container.querySelector('section h2')).toBeNull()
  expect(button()).toBeNull()
})
