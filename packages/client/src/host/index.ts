import type { CharacterImage } from '@dfragon/client-core/types/character'
import { createDfragonClient } from '@dfragon/client-core/shared/api/dfragon-client'
import { toRaidFrameResult } from '@dfragon/client-core/shared/raid/raid-frame'
import { startRendererDiagnostics } from '@dfragon/client-core/lib/runtime-diagnostics'
import {
  createOathCatalogSource,
  createSkillWindowCatalogSource
} from './catalog/browser-skill-window'
import { createRoundFrames } from './capture/round-frames'
import { createScreenShare } from './capture/screen-share'
import type { BrowserHost } from './client-host'
import { readRaidWindowTemplates } from './screen-watch/browser-raid-templates'
import { createScreenWatch } from './screen-watch/browser-screen-watch'
import type { ScreenWatchKind } from './screen-watch/screen-watch'
import {
  browserFetch,
  createBrowserCardSearch,
  createBrowserSearchRuntime
} from './search/browser-search'

export function installBrowserHost(
  apiOrigin: string,
  skillWindowIndexUrl: string,
  oathCatalogUrl: string
): BrowserHost {
  const reportDiagnostic = startRendererDiagnostics()
  const dfragon = createDfragonClient({ apiOrigin, fetch: browserFetch })
  const runtime = createBrowserSearchRuntime(dfragon, reportDiagnostic)
  const party = createBrowserCardSearch('party', runtime)
  const raid = createBrowserCardSearch('raid', runtime)
  const screenShare = createScreenShare()
  const roundFrames = createRoundFrames(screenShare)
  const watch = createScreenWatch(roundFrames.hold)
  screenShare.onChanged((share) => watch.onShareChanged(share?.video ?? null))

  async function readRoundFrame(kind: ScreenWatchKind): Promise<CharacterImage> {
    const recordRound = watch.beginRoundRead()
    const frame = await roundFrames.read()
    await recordRound(kind, frame)

    return frame
  }

  return {
    party: {
      ...party,
      selectCaptureSource: async (sourceId) => screenShare.select(sourceId),
      readCaptureFrame: () => readRoundFrame('party')
    },
    raid: {
      ...raid,
      readCaptureFrame: async () =>
        toRaidFrameResult(await readRoundFrame('raid'), await readRaidWindowTemplates())
    },
    getTodayGrade: dfragon.items.todayGrade,
    getCharacterDetail: dfragon.characters.detailView,
    getCharacterTimeline: dfragon.characters.timeline,
    getTimelineEnhancements: dfragon.characters.timelineEnhancements,
    getTimelineAcquisitions: dfragon.characters.timelineAcquisitions,
    getSkillWindowCatalog: createSkillWindowCatalogSource(skillWindowIndexUrl),
    getOathCatalog: createOathCatalogSource(oathCatalogUrl),
    getFameRanking: dfragon.rankings.fame,
    getCharacterStats: dfragon.stats,
    getSkillStats: dfragon.skillStats,
    getGuild: dfragon.guilds.get,
    getAdventureWeekly: dfragon.adventures.weekly,
    getAdventureActivity: dfragon.adventures.activity,
    getAdventureActivityDay: dfragon.adventures.activityDay,
    backfillAdventureSeason: dfragon.adventures.backfillSeason,
    searchCharacters: dfragon.characters.search,
    onPastedFrame: roundFrames.install(),
    requestScreenShare: screenShare.request,
    onScreenShareEnded: screenShare.onEnded,
    setWatchedScreen: watch.setWatchedScreen,
    onAutoRound: watch.onAutoRound
  }
}
