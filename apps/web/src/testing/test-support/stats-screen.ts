import { expect } from 'vitest'

export function boxOf(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!
}

export function rowsOf(container: HTMLElement, name: string): [string, string][] {
  return [...boxOf(container, name).querySelectorAll('[data-chart-item]')].map((row) => [
    row.querySelector('[data-chart-name]')?.textContent ?? '',
    row.querySelector('[data-chart-count], .num')?.textContent ?? ''
  ])
}

export function rowLink(
  container: HTMLElement,
  name: string,
  rowName: string
): Element | null | undefined {
  const row = [...boxOf(container, name).querySelectorAll('[data-chart-item]')].find(
    (item) => item.querySelector('[data-chart-name]')?.textContent === rowName
  )

  return row?.querySelector(':scope > div a')
}

export function rankingSearchOf(link: Element | null | undefined): Record<string, string> | null {
  const href = link?.getAttribute('href')

  if (href == null) {
    return null
  }

  const url = new URL(href, 'https://site.test')
  expect(url.pathname).toBe('/rankings')

  return Object.fromEntries(url.searchParams)
}
