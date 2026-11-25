import type { Meta, StoryObj } from '@storybook/react-vite'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import type { FameRankingFilter, SkillStats } from '#entities/ranking'
import { skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { skillStatsCatalogFixture, skillStatsFixture } from './api/skill-stats.fixture'
import { SkillStatsScreen } from './SkillStatsScreen'

const meta = {
  title: 'Screens/스킬 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const FIRST_FILTER: FameRankingFilter = {}

const catalogHandlers = skillWindowHandlers([skillStatsCatalogFixture])

function ignoreFilterChange(): void {}

function Screen({ filter }: { filter: FameRankingFilter }): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <SkillStatsScreen filter={filter} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

function statsStory(stats: SkillStats): Story {
  return {
    parameters: { msw: [skillStatsHandlers.of(stats), ...catalogHandlers] },
    render: () => <Screen filter={FIRST_FILTER} />
  }
}

export const 스킬통계: Story = statsStory(skillStatsFixture)

export const 받는중: Story = {
  parameters: { msw: [skillStatsHandlers.loading, ...catalogHandlers] },
  render: () => <Screen filter={FIRST_FILTER} />
}

export const 받지못함: Story = {
  parameters: { msw: [skillStatsHandlers.failure, ...catalogHandlers] },
  render: () => <Screen filter={FIRST_FILTER} />
}

export const 통계없음: Story = statsStory({ ...skillStatsFixture, computedAt: null })

export const 표본부족: Story = statsStory({ ...skillStatsFixture, sampleSize: 19 })

export const 체인조합없음: Story = statsStory({ ...skillStatsFixture, chains: [] })
