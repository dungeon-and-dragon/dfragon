import { useState } from 'react'
import { preload } from 'react-dom'
import type { AdventureActivity } from '#entities/adventure-guild'
import { SeasonBackdrop } from './SeasonBackdrop'
import { useAdventureActivity, useBackfillAdventureSeason } from './api/useAdventureActivity'
import { findSeasonRaidBackground } from './season-raid-background'
import { ActivitySummary, ActivitySummarySkeleton } from './ActivitySummary'
import { seasonPeriod } from './season-format'
import { seasonHasLegion } from './season-legion'
import { seasonHasOaths } from './season-oath'
import { SeasonTimeline } from './SeasonTimeline'

const HERO =
  'relative flex min-h-[220px] flex-col justify-between gap-6 overflow-hidden border-t border-line bg-canvas px-4 pt-6 pb-4'
const CONTENT = 'relative flex flex-col gap-1'
const TITLE = 'screen-title break-keep [overflow-wrap:anywhere]'
const PERIOD = 'num text-xs text-fg-muted'

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
    <div aria-busy={!settled} className={HERO}>
      <SeasonBackdrop
        url={seasonId !== undefined ? findSeasonRaidBackground(seasonId) : undefined}
      />
      <div className={CONTENT}>
        <h1 className={TITLE}>{adventureName}</h1>
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        {season !== undefined && period !== undefined && (
          <div className={CONTENT}>
            <span className="label">시즌 {season.id}</span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="text-base font-semibold">{season.name}</b>
              <span className={PERIOD}>{period.days}일</span>
            </div>
            <span className={PERIOD}>{period.range}</span>
          </div>
        )}
        {settled && activity !== undefined ? (
          <ActivitySummary
            summary={activity.summary}
            hasLegion={hasLegion}
            hasOaths={seasonHasOaths(seasonId)}
          />
        ) : (
          <ActivitySummarySkeleton hasLegion={hasLegion} />
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
      <>
        <div className={HERO}>
          <div className={CONTENT}>
            <h1 className={TITLE}>{adventureName}</h1>
          </div>
        </div>
        <p role="alert" className="state state-error">
          {result.message}
        </p>
      </>
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
        <div aria-hidden="true" className="h-[52px]" />
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
