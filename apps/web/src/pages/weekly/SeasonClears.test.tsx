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

function title(): string | null | undefined {
  return container.querySelector('section[aria-label="이번 시즌 클리어"] h2')?.textContent
}

function rows(): string[][] {
  return [...container.querySelectorAll('li')].map((row) =>
    [...row.querySelectorAll('span:not([aria-hidden])')]
      .filter((cell) => cell.childElementCount === 0)
      .map((cell) => cell.textContent ?? '')
  )
}

it('모험단 전체의 레이드 단계를 레이드마다 한 줄에 모으고 레기온을 뒤에 두며, 제목 옆에 줄 수를 적는다', async () => {
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

  await vi.waitFor(() => expect(title()).toBe('이번 시즌 클리어3'))
  expect(rows()).toEqual([
    ['레이드', '디레지에 레이드', '하드', '15', '일반', '1,203', '매칭', '4'],
    ['레이드', '이내 황혼전', '7'],
    ['레기온', '베누스', '12']
  ])
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

it('클리어가 없는 시즌은 제목과 빈 상태 한 줄을 보인다', async () => {
  await renderClears(activityWith({ raids: [], legions: [] }))

  await vi.waitFor(() => expect(title()).toBe('이번 시즌 클리어0'))
  expect(container.querySelector('section p')?.textContent).toBe(
    '이번 시즌 클리어 기록이 없습니다.'
  )
})
