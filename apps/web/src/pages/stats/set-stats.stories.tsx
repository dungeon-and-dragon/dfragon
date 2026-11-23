import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SetStatsFilter } from '#entities/ranking'
import { RANKING_JOBS } from '#entities/character'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { itemDetailHandlers } from '#widgets/item-tooltip/api/item-detail.handlers'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { SetStatsScreen } from './SetStatsScreen'

const meta = {
  title: 'Screens/세트 통계',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const [slayer] = RANKING_JOBS
const oathCatalog = oathCatalogHandlers.catalog(oathCatalogFixture.setStats)
const TWO_HOURS = 2 * 60 * 60 * 1000
const statsHandlers = [
  setStatsHandlers.statsComputedAgo(TWO_HOURS),
  itemStatsHandlers.statsComputedAgo(TWO_HOURS),
  itemDetailHandlers.detail,
  oathCatalog
]

function ignoreFilterChange(): void {}

function Screen({ filter = {} }: { filter?: SetStatsFilter }): React.JSX.Element {
  return (
    <StoryFrame>
      <StoryScreen>
        <SetStatsScreen filter={filter} onFilterChange={ignoreFilterChange} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 세트통계: Story = {
  parameters: { msw: statsHandlers },
  render: () => <Screen />
}

export const 직업고름: Story = {
  parameters: { msw: statsHandlers },
  render: () => <Screen filter={{ jobId: slayer.jobId }} />
}

export const 비었을때: Story = {
  parameters: { msw: [setStatsHandlers.empty, itemStatsHandlers.empty, oathCatalog] },
  render: () => <Screen />
}

export const 받는중: Story = {
  parameters: {
    msw: [setStatsHandlers.loading, itemStatsHandlers.loading, oathCatalogHandlers.loading]
  },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [setStatsHandlers.failure, itemStatsHandlers.loading, oathCatalog] },
  render: () => <Screen />
}
