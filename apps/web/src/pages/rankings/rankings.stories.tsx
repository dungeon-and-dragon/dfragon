import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { FameRankingFilter } from '#entities/ranking'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { fameRankingHandlers } from '#entities/ranking/api/fame-ranking.handlers'
import { itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { evolutionSkillStats, skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import {
  STORY_EVOLUTION_SKILLS,
  storyWeaponMasterCatalog
} from '#entities/catalog/api/skill-window.fixture'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { RANKING_JOBS } from '#entities/character'
import { RankingsScreen } from './RankingsScreen'

const meta = {
  title: 'Screens/검색',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const setHandlers = [
  setStatsHandlers.statsComputedAgo(0),
  itemStatsHandlers.statsComputedAgo(0),
  oathCatalogHandlers.catalog(oathCatalogFixture.setStats)
]
const pendingSetHandlers = [
  setStatsHandlers.loading,
  itemStatsHandlers.loading,
  oathCatalogHandlers.loading
]
const rankingPagesParameters = { msw: [fameRankingHandlers.pages, ...setHandlers] }

function Screen({ initialFilter = {} }: { initialFilter?: FameRankingFilter }): React.JSX.Element {
  const [filter, setFilter] = useState(initialFilter)

  return (
    <StoryFrame>
      <StoryScreen>
        <RankingsScreen filter={filter} onFilterChange={setFilter} />
      </StoryScreen>
    </StoryFrame>
  )
}

export const 전체: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen />
}

export const 직업선택: Story = {
  parameters: rankingPagesParameters,
  render: () => <Screen initialFilter={{ jobId: RANKING_JOBS[0]!.jobId }} />
}

export const 세트선택: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        oathSetId: 16204,
        oathSetOption: '용투 : 용제 강림'
      }}
    />
  )
}

export const 아이템선택: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        itemIds: ['aa5273499f19ddba846919dbb6857d82', 'story-weapon-1']
      }}
    />
  )
}

export const 거른결과없음: Story = {
  parameters: { msw: [fameRankingHandlers.empty, ...setHandlers] },
  render: () => <Screen initialFilter={{ oathSetId: 16204 }} />
}

export const 받는중: Story = {
  parameters: { msw: [fameRankingHandlers.loading, ...pendingSetHandlers] },
  render: () => <Screen />
}

export const 받지못함: Story = {
  parameters: { msw: [fameRankingHandlers.failure, ...pendingSetHandlers] },
  render: () => <Screen />
}

const WEAPON_MASTER_FILTER: FameRankingFilter = {
  jobId: RANKING_JOBS[0]!.jobId,
  jobGrowId: RANKING_JOBS[0]!.grows[0]!.jobGrowId
}
const catalogHandlers = skillWindowHandlers([storyWeaponMasterCatalog])

export const 개화선택: Story = {
  parameters: {
    msw: [
      fameRankingHandlers.pages,
      ...setHandlers,
      skillStatsHandlers.of(evolutionSkillStats(STORY_EVOLUTION_SKILLS)),
      ...catalogHandlers
    ]
  },
  render: () => (
    <Screen
      initialFilter={{
        ...WEAPON_MASTER_FILTER,
        evolutions: [
          { name: '발도', type: 1 },
          { name: '환영검무', type: 2 }
        ]
      }}
    />
  )
}

export const 개화받는중: Story = {
  parameters: {
    msw: [fameRankingHandlers.pages, ...setHandlers, skillStatsHandlers.loading, ...catalogHandlers]
  },
  render: () => <Screen initialFilter={WEAPON_MASTER_FILTER} />
}

export const 개화받지못함: Story = {
  parameters: {
    msw: [fameRankingHandlers.pages, ...setHandlers, skillStatsHandlers.failure, ...catalogHandlers]
  },
  render: () => <Screen initialFilter={WEAPON_MASTER_FILTER} />
}

export const 점수기준: Story = {
  parameters: rankingPagesParameters,
  render: () => (
    <Screen
      initialFilter={{
        jobId: RANKING_JOBS[0]!.jobId,
        sort: 'equipmentScore',
        scoreFrom: 1300000,
        scoreTo: 1400000
      }}
    />
  )
}
