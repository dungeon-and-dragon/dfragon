import type { Meta, StoryObj } from '@storybook/react-vite'
import type { HttpHandler } from 'msw'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import type { SetStatsFilter, SkillStats } from '#entities/ranking'
import { itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { skillStatsCatalogFixture, skillStatsFixture } from './api/skill-stats.fixture'
import { JobStatsScreen } from './JobStatsScreen'

const meta = {
  title: 'Screens/직업 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const FIRST_FILTER: SetStatsFilter = {}
const TWO_HOURS = 2 * 60 * 60 * 1000

const catalogHandlers = skillWindowHandlers([skillStatsCatalogFixture])
const setStats = setStatsHandlers.statsComputedAgo(TWO_HOURS)
const itemStats = itemStatsHandlers.statsComputedAgo(TWO_HOURS)

function ignoreFilterChange(): void {}

function Screen(): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <JobStatsScreen filter={FIRST_FILTER} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

function story(handlers: readonly HttpHandler[]): Story {
  return {
    parameters: { msw: [...handlers, ...catalogHandlers, itemDetailHandlers.detail] },
    render: () => <Screen />
  }
}

function skillStory(stats: SkillStats): Story {
  return story([skillStatsHandlers.of(stats), setStats, itemStats])
}

export const 직업통계: Story = skillStory(skillStatsFixture)

export const 받는중: Story = story([
  skillStatsHandlers.loading,
  setStatsHandlers.loading,
  itemStatsHandlers.loading
])

export const 스킬통계받지못함: Story = story([skillStatsHandlers.failure, setStats, itemStats])

export const 조합무기받지못함: Story = story([
  skillStatsHandlers.of(skillStatsFixture),
  setStatsHandlers.failure,
  itemStatsHandlers.failure
])

export const 통계없음: Story = story([
  skillStatsHandlers.of({ ...skillStatsFixture, computedAt: null }),
  setStatsHandlers.empty,
  itemStatsHandlers.empty
])

export const 표본부족: Story = skillStory({ ...skillStatsFixture, sampleSize: 19 })

export const 체인조합없음: Story = skillStory({ ...skillStatsFixture, chains: [] })
