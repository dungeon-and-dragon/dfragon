import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProgressCircle } from '../src/index'

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(node)

  return container
}

describe('ProgressCircle의 호가 범위가 유효하지 않을 때', () => {
  it.each([
    ['minValue가 NaN', { minValue: Number.NaN }],
    ['maxValue가 NaN', { maxValue: Number.NaN }],
    ['maxValue가 minValue 이하', { minValue: 10, maxValue: 10 }]
  ])('%s이면 호가 0이다', (_name, range) => {
    const circle = render(<ProgressCircle value={50} {...range} />).querySelectorAll('circle')

    expect(circle[1].getAttribute('stroke-dasharray')).toMatch(/^0 /)
  })
})
