import type { DiagnosticCode } from '@dfragon/client-core/preload/common/types/diagnostics'
import {
  SEARCH_ACTIONS,
  SEARCH_COMMAND_ERRORS,
  SEARCH_SLOT_COUNTS,
  type OcrSearchObservation,
  type SearchApi,
  type SearchCommandResult,
  type SearchSnapshot
} from '@dfragon/client-core/preload/common/types/search'
import { createCaptureSearchLifetime } from '@dfragon/client-core/shared/search/capture-lifetime'
import {
  createCharacterCandidatesHttp,
  createCharacterDetailsHttp,
  createCharacterImageHttp
} from '@dfragon/client-core/shared/search/character-http'
import { createCharacterImageSource } from '@dfragon/client-core/shared/search/character-image-source'
import {
  createCachedCharacterCandidates,
  createCachedCharacterDetails
} from '@dfragon/client-core/shared/search/character-response-cache'
import {
  parseOcrSearchObservation,
  parseSearchControl
} from '@dfragon/client-core/shared/search/commands'
import { createPortraitColorScorer } from '@dfragon/client-core/shared/search/portrait-color'
import { INITIAL_PORTRAIT_COLOR_POLICY } from '@dfragon/client-core/shared/search/portrait-policy'
import type { YieldToEventLoop } from '@dfragon/client-core/shared/search/portrait-raster'
import type { SearchRuntime } from '@dfragon/client-core/shared/search/request'
import { decodeBrowserPng } from './browser-png'

export type BrowserCardSearch = SearchApi & {
  notifyOcrCandidatesDetected: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
}

// setTimeout은 중첩되면 4ms 이상 기다려 초상화 비교의 양보가 수 초로 늘어난다.
function createMessageChannelYield(): YieldToEventLoop {
  const channel = new MessageChannel()
  const waiting: Array<() => void> = []
  channel.port1.onmessage = () => waiting.shift()?.()

  return () =>
    new Promise((resolve) => {
      waiting.push(resolve)
      channel.port2.postMessage(null)
    })
}

// 브라우저 fetch는 window가 아닌 this로 부르면 Illegal invocation으로 실패하므로 ky에 감싸서 넘긴다.
const browserFetch: typeof fetch = (input, init) => fetch(input, init)

export function createBrowserSearchRuntime(
  apiOrigin: string,
  reportDiagnostic: (code: DiagnosticCode) => void
): SearchRuntime {
  const policy = INITIAL_PORTRAIT_COLOR_POLICY
  const candidates = createCachedCharacterCandidates(
    createCharacterCandidatesHttp({ apiOrigin, fetch: browserFetch })
  )
  // 네오플 이미지 서버는 CORS 헤더를 주지 않아 픽셀을 읽을 수 없으므로 API가 전달하는 같은 PNG를 받는다.
  const image = createCharacterImageSource({
    image: createCharacterImageHttp({
      fetch: browserFetch,
      decodePng: decodeBrowserPng,
      imageUrl: ({ serverId, characterId }) =>
        `${apiOrigin}/characters/${serverId}/${characterId}/image`
    })
  })
  const details = createCachedCharacterDetails(
    createCharacterDetailsHttp({ apiOrigin, fetch: browserFetch })
  )
  const scorePortrait = createPortraitColorScorer(policy, createMessageChannelYield())

  return {
    reportDiagnostic,
    identification: { candidates, image, details, scorePortrait, selection: policy }
  }
}

export function createBrowserCardSearch(
  kind: keyof typeof SEARCH_SLOT_COUNTS,
  runtime: SearchRuntime
): BrowserCardSearch {
  const slotCount = SEARCH_SLOT_COUNTS[kind]
  const listeners = new Set<(snapshot: SearchSnapshot) => void>()
  // 페이지 하나가 문서이자 캡처 소스라 Desktop처럼 창이나 문서가 바뀌어 수명이 끝나는 일이 없다.
  const lifetime = createCaptureSearchLifetime({
    runtime: kind === 'raid' ? { ...runtime, ocrIdentification: 'raid' } : runtime,
    slotCount,
    isCurrent: () => true,
    isCurrentOcr: () => true,
    // IPC처럼 다음 microtask에 알려, listener가 수명 처리 도중에 다시 명령을 보내지 않게 한다.
    publish: (snapshot) =>
      queueMicrotask(() => {
        for (const listener of listeners) {
          listener(snapshot)
        }
      })
  })

  return {
    async controlCharacterSearch(input) {
      const control = parseSearchControl([input], slotCount)
      if (control == null) {
        return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
      }
      switch (control.action) {
        case SEARCH_ACTIONS.READ:
          return lifetime.result()
        case SEARCH_ACTIONS.END:
          return lifetime.end(control.captureId)
        case SEARCH_ACTIONS.LOOKUP:
          return lifetime.lookup(control)
        case SEARCH_ACTIONS.BEGIN:
          lifetime.invalidate()

          return lifetime.begin({ windowGeneration: 0, sourceGeneration: 0 })
      }
    },
    async notifyOcrCandidatesDetected(input) {
      const observation = parseOcrSearchObservation([input], slotCount)
      if (observation === null) {
        return lifetime.result(SEARCH_COMMAND_ERRORS.INVALID_SEARCH_COMMAND)
      }

      return lifetime.observeOcr(observation)
    },
    onCharacterSearchChanged(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }
  }
}
