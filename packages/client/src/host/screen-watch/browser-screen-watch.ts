import { detectDNFTownIndicator, type DNFParticipantFrame } from '@dfragon/lib'
import type { CharacterImage } from '@dfragon/client-core/preload/common/types/character'
import type { AutoRoundSignal, BrowserHost, WatchedScreen } from '../client-host'
import { decodeBrowserImage } from '../browser-png'
import type { createRoundFrames } from '../capture/round-frames'
import type { ScreenShare } from '../capture/screen-share'
import { createBackgroundLoad } from './background-load'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { readTownIndicatorTemplate } from './browser-town-template'
import { readPartyNameCrops, readRaidNameCrops } from './name-crops'
import {
  initialScreenWatchState,
  observeScreenWatch,
  recordScreenBaseline,
  type NameCrops,
  type ScreenWatchKind,
  type ScreenWatchObservation
} from './screen-watch'

// 마을 자동 인식의 판정 주기는 약 1초이며 ms 단위로 맞추지 않는다.
const SCREEN_WATCH_INTERVAL_MS = 1000

export function createScreenWatch(frames: ReturnType<typeof createRoundFrames>): {
  onShareChanged: (share: ScreenShare | null) => void
  beginRoundRead: () => (kind: ScreenWatchKind, frame: CharacterImage) => Promise<void>
  setWatchedScreen: BrowserHost['setWatchedScreen']
  onAutoRound: BrowserHost['onAutoRound']
} {
  const townTemplate = createBackgroundLoad(readTownIndicatorTemplate)
  const raidTemplates = createBackgroundLoad(readRaidWindowTemplates)
  let screen: WatchedScreen = { kind: 'party', roundRunning: false }
  let state = initialScreenWatchState
  let active: ScreenShare | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let releaseHeldFrame: (() => void) | null = null
  let startAutoRound: ((signal: AutoRoundSignal) => boolean) | null = null
  // 공유나 지금 화면이 바뀌거나 회차가 프레임을 읽으면 올려, 그 전에 프레임을 읽기 시작한 틱의 결과를 버린다.
  let generation = 0
  let judging = false

  // 지금 화면이 아닌 쪽 검출기는 부르지 않는다.
  function cropReader(kind: ScreenWatchKind): ((frame: CharacterImage) => NameCrops | null) | null {
    if (kind === 'party') {
      return readPartyNameCrops
    }
    const templates = raidTemplates()
    if (templates === null) {
      return null
    }

    return (frame) => readRaidNameCrops(frame, templates)
  }

  function observeFrame(
    frame: CharacterImage,
    kind: ScreenWatchKind,
    town: DNFParticipantFrame,
    readCrops: (frame: CharacterImage) => NameCrops | null
  ): ScreenWatchObservation {
    try {
      if (detectDNFTownIndicator(frame, town).status !== 'found') {
        return { town: false, kind, crops: null }
      }

      return { town: true, kind, crops: readCrops(frame) }
    } catch {
      // 검출기의 RangeError와 파티 프레임 미검출 오류는 창을 찾지 못한 틱으로 보아 2번 연속을 처음부터 다시 센다.
      return { town: true, kind, crops: null }
    }
  }

  // 회차는 검색을 시작한 뒤에 프레임을 읽으므로 승인한 뒤에 들어도 그 회차가 이 프레임을 읽는다. 승인 전에 들면 거절한
  // 신호가 대기 중인 붙여넣기 프레임을 덮는다.
  function holdAutoRound(signal: AutoRoundSignal, frame: CharacterImage): void {
    if (startAutoRound?.(signal) === true) {
      releaseHeldFrame = frames.hold(Promise.resolve(frame))
    }
  }

  async function tick(share: ScreenShare): Promise<void> {
    const { kind } = screen
    const town = townTemplate()
    const readCrops = cropReader(kind)
    // 앞 틱이 아직 프레임을 읽고 있으면 건너뛰어, 늦게 끝난 결과가 다음 틱의 결과와 순서가 바뀌지 않게 한다.
    if (judging || screen.roundRunning || town === null || readCrops === null) {
      return
    }

    const judgedGeneration = generation
    judging = true
    let frame: CharacterImage
    try {
      frame = await decodeBrowserImage(share.video)
    } catch {
      // 영상 프레임을 읽지 못한 틱은 건너뛰고 다음 틱에 다시 읽는다.
      return
    } finally {
      judging = false
    }
    if (judgedGeneration !== generation || screen.roundRunning) {
      return
    }
    const result = observeScreenWatch(state, observeFrame(frame, kind, town, readCrops))
    state = result.state
    if (result.signal !== 'none') {
      holdAutoRound(result.signal, frame)
    }
  }

  return {
    onShareChanged(share) {
      clearInterval(timer)
      timer = undefined
      releaseHeldFrame?.()
      releaseHeldFrame = null
      state = initialScreenWatchState
      generation += 1
      active = share
      if (share !== null) {
        // 첫 틱 전에 템플릿을 받기 시작한다.
        townTemplate()
        raidTemplates()
        timer = setInterval(() => tick(share), SCREEN_WATCH_INTERVAL_MS)
      }
    },
    // 회차가 프레임을 읽기 전의 공유를 잡아 두어, 읽는 동안 공유가 바뀌면 새 공유의 기준으로 기록하지 않는다.
    beginRoundRead() {
      const share = active

      return async (kind, frame) => {
        if (share === null || active !== share) {
          return
        }
        generation += 1
        let crops: NameCrops | null = null
        try {
          crops =
            kind === 'party'
              ? readPartyNameCrops(frame)
              : readRaidNameCrops(frame, await readRaidWindowTemplates())
        } catch {
          // 이름 crop을 만들지 못한 프레임도 아래에서 빈 기준이 되어, 그 화면의 창이 다시 보이면 새 구성으로 본다.
        }
        if (active === share) {
          state = recordScreenBaseline(state, kind, crops ?? [])
        }
      }
    },
    setWatchedScreen(next) {
      // 화면이 바뀌면 2번 연속을 처음부터 다시 센다.
      if (next.kind !== screen.kind) {
        generation += 1
        state = { ...state, candidate: null }
      }
      screen = next
    },
    onAutoRound(listener) {
      startAutoRound = listener

      return () => {
        if (startAutoRound === listener) {
          startAutoRound = null
        }
      }
    }
  }
}
