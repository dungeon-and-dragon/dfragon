import {
  detectDNFTownIndicator,
  detectPartyFrameGeometry,
  type DNFParticipantFrame,
  type DNFRectangle
} from '@dfragon/lib'
import ky from 'ky'
import { parseTodayGrade } from '@dfragon/client-core/preload/common/today-grade'
import type { CaptureSource } from '@dfragon/client-core/preload/common/types/capture'
import type { CharacterImage } from '@dfragon/client-core/preload/common/types/character'
import type { DesktopShortcut } from '@dfragon/client-core/preload/common/types/desktop-shortcut'
import { SEARCH_SLOT_COUNTS } from '@dfragon/client-core/preload/common/types/search'
import {
  DIAGNOSTIC_HISTORY_LIMIT,
  type DiagnosticApi,
  type DiagnosticCode,
  type DiagnosticEntry
} from '@dfragon/client-core/preload/common/types/diagnostics'
import type { TodayGrade } from '@dfragon/client-core/preload/common/types/today-grade'
import type { UpdateNoticeSnapshot } from '@dfragon/client-core/preload/common/types/update-notice'
import { toRaidFrameResult } from '@dfragon/client-core/shared/raid/raid-frame'
import {
  cropRaidWindowNicknames,
  type RaidWindowTemplates
} from '@dfragon/client-core/shared/raid/raid-window'
import { startRendererDiagnostics } from '../../lib/runtime-diagnostics'
import { decodeBrowserImage } from './browser-png'
import { readRaidWindowTemplates } from './browser-raid-templates'
import { createBrowserCardSearch, createBrowserSearchRuntime } from './browser-search'
import { readTownIndicatorTemplate } from './browser-town-template'
import {
  initialScreenWatchState,
  observeScreenWatch,
  recordScreenBaseline,
  type NameCrops,
  type ScreenWatchKind,
  type ScreenWatchObservation
} from './screen-watch'

// 응답은 `{ percent, expiresAt }` 하나라 100바이트 안팎이다.
const TODAY_GRADE_MAX_BYTES = 4 * 1024
const NO_UPDATE_NOTICE: UpdateNoticeSnapshot = { revision: 0, notice: null }
// 한글 자판에서는 Alt+W의 key가 'ㅈ'이므로 물리 키로 고른다.
const PAGE_SHORTCUTS: Readonly<Record<string, DesktopShortcut>> = {
  KeyW: 'take-snapshot',
  KeyA: 'copy-clipboard',
  KeyR: 'restart-search'
}
// 마을 자동 인식의 판정 주기는 약 1초이며 ms 단위로 맞추지 않는다.
const SCREEN_WATCH_INTERVAL_MS = 1000

export type WatchedScreen = Readonly<{ kind: ScreenWatchKind; roundRunning: boolean }>

export type AutoRoundSignal = Readonly<{ kind: ScreenWatchKind }>

export type BrowserHost = {
  onPastedFrame: (listener: () => void) => () => void
  requestScreenShare: () => Promise<string | null>
  onScreenShareEnded: (listener: () => void) => () => void
  setWatchedScreen: (screen: WatchedScreen) => void
  // listener는 회차를 시작했는지 돌려준다. 시작하지 않으면 host가 그 회차용으로 든 프레임을 놓는다.
  onAutoRound: (listener: (signal: AutoRoundSignal) => boolean) => () => void
}

type ScreenShare = { id: string; track: MediaStreamTrack; video: HTMLVideoElement }

type BrowserDiagnostics = DiagnosticApi & { report: (code: DiagnosticCode) => void }

function createListeners<T extends unknown[]>(): {
  subscribe: (listener: (...args: T) => void) => () => void
  notify: (...args: T) => void
} {
  const listeners = new Set<(...args: T) => void>()

  return {
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    notify(...args) {
      for (const listener of listeners) {
        listener(...args)
      }
    }
  }
}

function createMemoryDiagnostics(): BrowserDiagnostics {
  const entries: DiagnosticEntry[] = []
  const listeners = createListeners<[DiagnosticEntry]>()
  let sequence = 0

  function report(code: DiagnosticCode): void {
    if (entries.at(-1)?.code === code) {
      return
    }
    sequence += 1
    const entry = Object.freeze({ sequence, timestamp: Date.now(), code })
    entries.push(entry)
    if (entries.length > DIAGNOSTIC_HISTORY_LIMIT) {
      entries.shift()
    }
    listeners.notify(entry)
  }

  return {
    report,
    getDiagnosticHistory: async () => entries.slice(),
    reportRendererDiagnostic: async (code) => report(code),
    onDiagnosticEntry: listeners.subscribe
  }
}

async function readTodayGrade(apiOrigin: string): Promise<TodayGrade> {
  const body = await ky
    .get(`${apiOrigin}/items/today-grade`, {
      retry: 0,
      maxResponseSize: TODAY_GRADE_MAX_BYTES,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
    .json()
  const grade = parseTodayGrade(body)
  if (grade == null) {
    throw new Error('INVALID_TODAY_GRADE_RESPONSE')
  }

  return grade
}

function findPastedImage(data: DataTransfer | null): File | null {
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

function createScreenShare(): {
  isConnected: () => boolean
  request: BrowserHost['requestScreenShare']
  select: (sourceId: string) => CaptureSource | null
  read: () => Promise<CharacterImage>
  onEnded: BrowserHost['onScreenShareEnded']
  onChanged: (listener: (share: ScreenShare | null) => void) => () => void
} {
  let current: ScreenShare | null = null
  let shareCount = 0
  const ended = createListeners<[]>()
  const changed = createListeners<[ScreenShare | null]>()

  // track.stop()은 ended 이벤트를 보내지 않으므로, 앱이 끊은 공유는 끝났다고 다시 알리지 않는다.
  function stop(): void {
    if (current === null) {
      return
    }
    current.track.stop()
    current = null
    changed.notify(null)
  }

  return {
    isConnected: () => current !== null,
    async request() {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'window' },
          audio: false
        })
      } catch {
        // 공유 창을 닫거나 거절하면 지금 연결을 그대로 둔다.
        return null
      }
      const [track] = stream.getVideoTracks()
      const video = document.createElement('video')
      video.muted = true
      video.srcObject = stream
      await video.play()
      stop()
      shareCount += 1
      const share: ScreenShare = { id: `screen-share-${shareCount}`, track, video }
      track.addEventListener('ended', () => {
        if (current === share) {
          current = null
          changed.notify(null)
          ended.notify()
        }
      })
      current = share
      changed.notify(share)

      return share.id
    },
    select(sourceId) {
      if (sourceId === '') {
        stop()

        return null
      }

      if (current?.id !== sourceId) {
        throw new Error('SCREEN_SHARE_ENDED')
      }

      return { id: current.id, name: current.track.label }
    },
    read() {
      if (current === null) {
        return Promise.reject(new Error('SCREEN_SHARE_ENDED'))
      }

      // 재생 중인 video의 지금 프레임을 읽어, 화면이 바뀌지 않아 새 프레임이 오지 않아도 기다리지 않는다.

      return decodeBrowserImage(current.video)
    },
    onEnded: ended.subscribe,
    onChanged: changed.subscribe
  }
}

// 붙여 넣은 이미지와 마을 자동 인식이 판정에 쓴 프레임은 host가 들고 있다가 renderer가 시작한 회차의
// readCaptureFrame으로 돌려준다. 공유한 창이 있으면 그렇게 시작한 회차만 든 프레임을 읽고, 캡처 버튼과 Alt+R 회차는
// 공유 화면을 읽는다.
function createRoundFrames(share: ReturnType<typeof createScreenShare>): {
  read: () => Promise<CharacterImage>
  hold: (frame: Promise<CharacterImage>) => () => void
  install: () => BrowserHost['onPastedFrame']
} {
  let pastedFrame: Promise<CharacterImage> | null = null
  let nextFrame: Promise<CharacterImage> | null = null
  const pasted = createListeners<[]>()

  return {
    read() {
      const frame = nextFrame
      nextFrame = null
      if (frame !== null) {
        return frame
      }

      if (share.isConnected()) {
        return share.read()
      }

      if (pastedFrame === null) {
        return Promise.reject(new Error('NO_PASTED_FRAME'))
      }

      return pastedFrame
    },
    hold(frame) {
      nextFrame = frame

      return () => {
        if (nextFrame === frame) {
          nextFrame = null
        }
      }
    },
    install() {
      document.addEventListener('paste', (event) => {
        const image = findPastedImage(event.clipboardData)
        if (image === null) {
          return
        }
        const frame = decodeBrowserImage(image)
        // 디코딩 실패는 회차의 readCaptureFrame이 받아 안내하므로 여기서는 미처리 거절로 남기지 않는다.
        frame.catch(() => undefined)
        pastedFrame = frame
        nextFrame = frame
        pasted.notify()
      })

      return pasted.subscribe
    }
  }
}

function copyRegion(frame: CharacterImage, region: DNFRectangle): DNFParticipantFrame {
  const { x, y, width, height } = region
  const rgba = new Uint8Array(width * height * 4)
  for (let line = 0; line < height; line += 1) {
    const start = ((y + line) * frame.width + x) * 4
    rgba.set(frame.rgba.subarray(start, start + width * 4), line * width * 4)
  }

  return { width, height, rgba }
}

function readPartyNameCrops(frame: CharacterImage): NameCrops {
  const crops: (DNFParticipantFrame | null)[] = Array.from(
    { length: SEARCH_SLOT_COUNTS.party },
    () => null
  )
  for (const region of detectPartyFrameGeometry(frame).slots) {
    crops[region.slot - 1] = copyRegion(frame, region)
  }

  return crops
}

function readRaidNameCrops(
  frame: CharacterImage,
  templates: RaidWindowTemplates
): NameCrops | null {
  const detection = cropRaidWindowNicknames(frame, templates)
  if (detection.status !== 'found') {
    return null
  }

  return detection.rows.map((row) => row.nicknameCrop)
}

// 템플릿을 아직 받지 못했으면 null을 돌려주고 받기 시작한다. 실패하면 loader가 캐시를 비우므로 다음 호출이 다시 받는다.
function createBackgroundLoad<T>(load: () => Promise<T>): () => T | null {
  let value: T | null = null
  let loading = false

  return () => {
    if (value === null && !loading) {
      loading = true
      load()
        .then(
          (loaded) => {
            value = loaded
          },
          () => undefined
        )
        .finally(() => {
          loading = false
        })
    }

    return value
  }
}

function createScreenWatch(frames: ReturnType<typeof createRoundFrames>): {
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

function installPageShortcuts(
  canRestart: () => boolean
): (listener: (shortcut: DesktopShortcut) => void) => () => void {
  const shortcuts = createListeners<[DesktopShortcut]>()
  document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
      return
    }
    const shortcut = PAGE_SHORTCUTS[event.code]
    // Alt+R은 공유한 창이 있을 때만 받는다. 붙여넣기만 있으면 다시 읽을 화면이 없다.
    if (shortcut === undefined || (shortcut === 'restart-search' && !canRestart())) {
      return
    }
    event.preventDefault()
    shortcuts.notify(shortcut)
  })

  return shortcuts.subscribe
}

export function installBrowserHost(apiOrigin: string): BrowserHost {
  const diagnostics = createMemoryDiagnostics()
  const runtime = createBrowserSearchRuntime(apiOrigin, diagnostics.report)
  const party = createBrowserCardSearch('party', runtime)
  const raid = createBrowserCardSearch('raid', runtime)
  const screenShare = createScreenShare()
  const roundFrames = createRoundFrames(screenShare)
  const watch = createScreenWatch(roundFrames)
  screenShare.onChanged(watch.onShareChanged)

  async function readRoundFrame(kind: ScreenWatchKind): Promise<CharacterImage> {
    const recordRound = watch.beginRoundRead()
    const frame = await roundFrames.read()
    await recordRound(kind, frame)

    return frame
  }

  // 공유는 게임 연결 칩을 눌렀을 때만 요청한다. 목록 재조회가 공유 창을 띄우지 않도록 목록은 늘 비운다.
  window.api = {
    listCaptureSources: async () => [],
    selectCaptureSource: async (sourceId) => screenShare.select(sourceId),
    readCaptureFrame: async () => ({ kind: 'frame', image: await readRoundFrame('party') }),
    notifyOcrCandidatesDetected: party.notifyOcrCandidatesDetected
  }
  window.search = {
    controlCharacterSearch: party.controlCharacterSearch,
    onCharacterSearchChanged: party.onCharacterSearchChanged
  }
  window.raidSearch = {
    ...raid,
    readCaptureFrame: async () =>
      toRaidFrameResult(
        { kind: 'frame', image: await readRoundFrame('raid') },
        await readRaidWindowTemplates()
      )
  }
  window.desktopShortcut = { onDesktopShortcut: installPageShortcuts(screenShare.isConnected) }
  // 보안 컨텍스트가 아니면 navigator.clipboard가 없으므로, async로 감싸 그 TypeError도 복사 실패로 보이게 한다.
  window.desktopClipboard = {
    writeText: async (text) => {
      await navigator.clipboard.writeText(text)
    }
  }
  window.todayGrade = { getTodayGrade: () => readTodayGrade(apiOrigin) }
  window.diagnostics = diagnostics
  window.updateNotice = {
    getUpdateNotice: async () => NO_UPDATE_NOTICE,
    dismissUpdateNotice: async () => NO_UPDATE_NOTICE,
    openUpdateRelease: async () => {},
    onUpdateNoticeChanged: () => () => {}
  }
  window.windowChrome = { setContentHeight: async () => {} }
  startRendererDiagnostics(diagnostics)

  return {
    onPastedFrame: roundFrames.install(),
    requestScreenShare: screenShare.request,
    onScreenShareEnded: screenShare.onEnded,
    setWatchedScreen: watch.setWatchedScreen,
    onAutoRound: watch.onAutoRound
  }
}
