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

it('모험단 전체의 레이드 단계를 레이드마다 한 줄에 모으고 레기온을 뒤에 둔다', async () => {
  await renderClears(
    activityWith({
      raids: [
        { name: '디레지에 레이드 (하드)', raid: '디레지에 레이드', stage: '하드', count: 15 },
        { name: '디레지에 레이드 (일반)', raid: '디레지에 레이드', stage: '일반', count: 1203 },
        { name: '디레지에 레이드 (매칭)', raid: '디레지에 레이드', stage: '매칭', count: 4 },
        { name: '이내 황혼전', raid: '이내 황혼전', stage: null, count: 7 }
      ],
      legions: [{ name: '베누스', count: 12 }]
    })
  )

  await vi.waitFor(() =>
    expect(rows()).toEqual([
      ['레이드', '디레지에 레이드', '하드', '15', '일반', '1,203', '매칭', '4'],
      ['레이드', '이내 황혼전', '7'],
      ['레기온', '베누스', '12']
    ])
  )
  expect([...container.querySelectorAll('li .badge')].map((badge) => badge.textContent)).toEqual([
    '하드'
  ])
  expect(container.querySelector('li .badge')?.className).toContain('text-fg-danger')
})

it('레이드 이름과 단계를 보내지 않는 API의 레이드는 이름 그대로 한 줄씩 숫자만 보인다', async () => {
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
      ['레이드', '가 레이드 (하드)', '3'],
      ['레이드', '가 레이드 (일반)', '5']
    ])
  )
})

it('깨어난 숲처럼 이름 뒤 괄호에 극, 일반을 적은 레기온은 한 줄에 모으고 극을 하드처럼 붉은 배지로 보인다', async () => {
  await renderClears(
    activityWith({
      raids: [],
      legions: [
        { name: '깨어난 숲(극)', count: 5 },
        { name: '깨어난 숲(일반)', count: 3 },
        { name: '어둑섬', count: 2 }
      ]
    })
  )

  await vi.waitFor(() =>
    expect(rows()).toEqual([
      ['레기온', '깨어난 숲', '극', '5', '일반', '3'],
      ['레기온', '어둑섬', '2']
    ])
  )
  expect([...container.querySelectorAll('li .badge')].map((badge) => badge.textContent)).toEqual([
    '극'
  ])
  expect(container.querySelector('li .badge')?.className).toContain('text-fg-danger')
})

it('클리어가 없는 시즌은 제목 없이 빈 상태 한 줄만 보인다', async () => {
  await renderClears(activityWith({ raids: [], legions: [] }))

  await vi.waitFor(() =>
    expect(container.querySelector('section[aria-label="시즌 클리어"]')?.textContent).toBe(
      '클리어 기록이 없습니다.'
    )
  )
  expect(container.querySelector('section h2')).toBeNull()
})
