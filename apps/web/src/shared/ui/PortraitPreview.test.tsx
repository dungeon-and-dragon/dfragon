// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PortraitPreview } from './PortraitPreview'

const IMAGE = 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function openPopup(): Element | null {
  return document.querySelector('[data-base-ui-portal] > [data-open]')
}

async function renderThumbnail(): Promise<{ thumbnail: Element; image: HTMLImageElement }> {
  await act(async () =>
    root.render(
      <PortraitPreview src={IMAGE}>
        <span data-testid="thumbnail">
          <img src={IMAGE} alt="" />
        </span>
      </PortraitPreview>
    )
  )

  const thumbnail = container.querySelector('[data-testid="thumbnail"]')
  const image = thumbnail?.querySelector('img')

  if (thumbnail == null || image == null) {
    throw new Error('썸네일이 없다')
  }

  return { thumbnail, image }
}

// Base UI Tooltip은 trigger의 mouseenter를 직접 듣는다.
function hover(element: Element, type: 'mouseenter' | 'mouseleave'): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new MouseEvent(type))
  })
}

it('썸네일 이미지가 뜬 뒤 마우스를 올리면 같은 이미지를 띄우고 내리면 닫는다', async () => {
  const { thumbnail, image } = await renderThumbnail()

  await act(async () => {
    image.dispatchEvent(new Event('load'))
  })
  await hover(thumbnail, 'mouseenter')
  const popup = await vi.waitFor(() => {
    const opened = openPopup()

    if (opened === null) {
      throw new Error('확대 이미지가 열리지 않았다')
    }

    return opened
  })

  expect(popup.querySelector('img')?.getAttribute('src')).toBe(IMAGE)

  await hover(thumbnail, 'mouseleave')
  await vi.waitFor(() => {
    if (openPopup() !== null) {
      throw new Error('확대 이미지가 닫히지 않았다')
    }
  })
})

it('썸네일 이미지를 받지 못했으면 마우스를 올려도 확대 창을 열지 않는다', async () => {
  const { thumbnail, image } = await renderThumbnail()

  await act(async () => {
    image.dispatchEvent(new Event('error'))
  })
  await hover(thumbnail, 'mouseenter')

  expect(openPopup()).toBeNull()
})
