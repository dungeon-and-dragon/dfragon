import type { CaptureSource } from '@dfragon/client-core/types/capture'
import type { CharacterImage } from '@dfragon/client-core/types/character'
import type { BrowserHost } from '../client-host'
import { decodeBrowserImage } from '../browser-png'
import { createListeners } from '../listeners'

export type ScreenShare = { id: string; track: MediaStreamTrack; video: HTMLVideoElement }

export function createScreenShare(): {
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
