import type { CharacterImage } from '#entities/character'
import { toRaidFrameResult } from '#features/capture-search/lib/capture/raid/raid-frame'
import { createDfragonHttp } from '#shared/api/dfragon-http'
import { startRuntimeDiagnostics } from '#shared/lib/diagnostics'
import { createRoundFrames } from '#features/capture-search/lib/capture/round-frames'
import { createScreenShare } from '#features/capture-search/lib/capture/screen-share'
import type { BrowserHost } from './client-host'
import { readRaidWindowTemplates } from '#features/capture-search/lib/screen-watch/browser-raid-templates'
import { createScreenWatch } from '#features/capture-search/lib/screen-watch/browser-screen-watch'
import type { ScreenWatchKind } from '#features/capture-search/lib/screen-watch/screen-watch'
import {
  browserFetch,
  createBrowserCardSearch,
  createBrowserSearchRuntime
} from '#features/capture-search/lib/search/browser-search'

export function installBrowserHost(apiOrigin: string): BrowserHost {
  const reportDiagnostic = startRuntimeDiagnostics()
  const http = createDfragonHttp(browserFetch)
  const api = { http, apiOrigin }
  const runtime = createBrowserSearchRuntime(api, reportDiagnostic)
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
    onPastedFrame: roundFrames.install(),
    requestScreenShare: screenShare.request,
    onScreenShareEnded: screenShare.onEnded,
    setWatchedScreen: watch.setWatchedScreen,
    onAutoRound: watch.onAutoRound
  }
}
