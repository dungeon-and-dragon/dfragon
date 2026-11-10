import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useState } from 'react'
import { preload } from 'react-dom'
import type { AdventureActivity } from '#core/adventure-guild/adventure-activity'
import { SeasonBackdrop } from '../../components/SeasonBackdrop'
import { useAdventureActivity, useBackfillAdventureSeason } from './hooks/useAdventureActivity'
import { findSeasonRaidBackground } from '../../lib/season-raid-background'
import { ActivitySummary, ActivitySummarySkeleton } from './ActivitySummary'
import { styles } from './AdventureDashboard.style'
import { seasonPeriod } from './season-format'
import { seasonHasLegion } from './season-legion'
import { SeasonTimeline } from './SeasonTimeline'

// 시즌을 고르는 순간 배경이 크로스페이드되도록 고를 수 있는 시즌의 배경을 미리 받는다.
function preloadSeasonBackgrounds(activity: AdventureActivity): void {
  for (const { id, available } of activity.seasons) {
    const url = available ? findSeasonRaidBackground(id) : undefined
    if (url !== undefined) {
      preload(url, { as: 'image' })
    }
  }
}

function DashboardHero({
  adventureName,
  activity,
  seasonId,
  settled
}: {
  adventureName: string
  activity: AdventureActivity | undefined
  seasonId: number | undefined
  settled: boolean
}): React.JSX.Element {
  const [now] = useState(Date.now)
  const seasonIndex = activity?.seasons.findIndex(({ id }) => id === seasonId) ?? -1
  const season = seasonIndex >= 0 ? activity?.seasons[seasonIndex] : undefined
  const period =
    season !== undefined
      ? seasonPeriod(season.startsAt, activity?.seasons[seasonIndex + 1]?.startsAt, now)
      : undefined
  const hasLegion = seasonHasLegion(seasonId)

  return (
    <div aria-busy={!settled} {...stylex.props(styles.hero)}>
      <SeasonBackdrop
        url={seasonId !== undefined ? findSeasonRaidBackground(seasonId) : undefined}
      />
      <div {...stylex.props(styles.content)}>
        <h1 {...stylex.props(styles.title)}>{adventureName}</h1>
      </div>
      <div {...stylex.props(styles.bottom)}>
        {season !== undefined && period !== undefined && (
          <div {...stylex.props(styles.content)}>
            <span {...stylex.props(styles.kind)}>시즌 {season.id}</span>
            <div {...stylex.props(styles.nameRow)}>
              <b {...stylex.props(styles.seasonName)}>{season.name}</b>
              <span {...stylex.props(styles.start)}>{period.days}일</span>
            </div>
            <span {...stylex.props(styles.start)}>{period.range}</span>
          </div>
        )}
        {settled && activity !== undefined ? (
          <ActivitySummary summary={activity.summary} hasLegion={hasLegion} />
        ) : (
          <>
            <span role="status" {...stylex.props(shapes.srOnly)}>
              시즌 활동을 받는 중입니다.
            </span>
            <ActivitySummarySkeleton hasLegion={hasLegion} />
          </>
        )}
      </div>
    </div>
  )
}

export function AdventureDashboard({
  adventureName,
  season,
  onSeasonChange
}: {
  adventureName: string
  season: number | undefined
  onSeasonChange: (season: number) => void
}): React.JSX.Element {
  const result = useAdventureActivity(adventureName, season)
  const backfill = useBackfillAdventureSeason(adventureName)
  if (result.status === 'error') {
    return (
      <div {...stylex.props(styles.hero)}>
        <div {...stylex.props(styles.content)}>
          <h1 {...stylex.props(styles.title)}>{adventureName}</h1>
        </div>
        <p role="alert" {...stylex.props(styles.state)}>
          {result.message}
        </p>
      </div>
    )
  }

  const activity = result.status === 'success' ? result.value : undefined
  const settled = result.status === 'success' && !result.previous
  const seasonId = season ?? activity?.season?.id
  if (activity !== undefined) {
    preloadSeasonBackgrounds(activity)
  }

  return (
    <>
      {activity !== undefined && seasonId !== undefined ? (
        <SeasonTimeline
          seasons={activity.seasons}
          selectedId={seasonId}
          onSelect={onSeasonChange}
          onBackfill={backfill}
        />
      ) : (
        <div aria-hidden="true" {...stylex.props(styles.timelinePlaceholder)} />
      )}
      <DashboardHero
        adventureName={adventureName}
        activity={activity}
        seasonId={seasonId}
        settled={settled}
      />
    </>
  )
}
