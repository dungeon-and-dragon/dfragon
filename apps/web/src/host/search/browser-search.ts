import type { DiagnosticCode } from '#core/diagnostics/diagnostics'
import {
  SEARCH_ACTIONS,
  SEARCH_COMMAND_ERRORS,
  SEARCH_SLOT_COUNTS,
  type SearchSnapshot
} from '#core/search/search'
import { createCaptureSearchLifetime } from '#core/search/capture-lifetime'
import type { DfragonClient } from '#core/api/dfragon-client'
import { decodeCharacterImage } from '#core/character/character-image'
import { createCharacterImageSource } from '#core/character/character-image-source'
import {
  createCachedCharacterCandidates,
  createCachedCharacterDetails
} from '#core/search/character-response-cache'
import { parseOcrSearchObservation, parseSearchControl } from '#core/search/commands'
import { createPortraitColorScorer } from '#core/search/portrait-color'
import { INITIAL_PORTRAIT_COLOR_POLICY } from '#core/search/portrait-policy'
import type { YieldToEventLoop } from '#core/search/portrait-raster'
import type { SearchRuntime } from '#core/search/request'
import type { CardSearchHost } from '../client-host'
import { decodeBrowserPng } from '../browser-png'

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
export const browserFetch: typeof fetch = (input, init) => fetch(input, init)

export function createBrowserSearchRuntime(
  dfragon: DfragonClient,
  reportDiagnostic: (code: DiagnosticCode) => void
): SearchRuntime {
  const policy = INITIAL_PORTRAIT_COLOR_POLICY
  const candidates = createCachedCharacterCandidates(dfragon.characters.candidates)
  // 네오플 이미지 서버는 CORS 헤더를 주지 않아 픽셀을 읽을 수 없으므로 API가 전달하는 같은 PNG를 받는다.
  const image = createCharacterImageSource({
    image: async (input) => {
      const bytes = await dfragon.characters.image(input)
      try {
        return await decodeCharacterImage(bytes, decodeBrowserPng)
      } finally {
        // 디코드 중에 취소되면 디코드 결과나 실패보다 취소를 먼저 알린다.
        input.signal.throwIfAborted()
      }
    }
  })
  const details = createCachedCharacterDetails(dfragon.characters.details)
  const scorePortrait = createPortraitColorScorer(policy, createMessageChannelYield())

  return {
    reportDiagnostic,
    identification: { candidates, image, details, scorePortrait, selection: policy }
  }
}

export function createBrowserCardSearch(
  kind: keyof typeof SEARCH_SLOT_COUNTS,
  runtime: SearchRuntime
): CardSearchHost {
  const slotCount = SEARCH_SLOT_COUNTS[kind]
  const listeners = new Set<(snapshot: SearchSnapshot) => void>()
  const lifetime = createCaptureSearchLifetime({
    runtime: kind === 'raid' ? { ...runtime, ocrIdentification: 'raid' } : runtime,
    slotCount,
    // 수명은 발행 직후 대기 중인 상세 요청을 시작한다.
    // 다음 microtask에 알려, listener가 그 사이에 다시 명령을 보내지 않게 한다.
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

          return lifetime.begin()
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
