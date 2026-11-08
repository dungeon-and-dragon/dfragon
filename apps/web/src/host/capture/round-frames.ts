import type { CharacterImage } from '#core/character/character'
import type { BrowserHost } from '../client-host'
import { decodeBrowserImage } from '../browser-png'
import { createListeners } from '../listeners'
import type { createScreenShare } from './screen-share'

function findPastedImage(data: DataTransfer | null): File | null {
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

// 붙여 넣은 이미지와 마을 자동 인식이 판정에 쓴 프레임은 host가 들고 있다가 웹 앱에서 시작한 회차의
// readCaptureFrame으로 돌려준다. 공유한 창이 있으면 그렇게 시작한 회차만 든 프레임을 읽고, 캡처 버튼 회차는
// 공유 화면을 읽는다.
export function createRoundFrames(share: ReturnType<typeof createScreenShare>): {
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
        // 붙여넣기 회차를 시작할 화면이 없을 때 든 프레임은 뒤의 캡처 버튼 회차가 공유 화면 대신 읽으므로 받지 않는다.
        if (pasted.isEmpty()) {
          return
        }
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
