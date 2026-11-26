import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const SITE_ORIGIN = 'https://dfragon.com'
const SITEMAP_LOC_PATTERN = /<loc>(.*?)<\/loc>/g
const LLMS_LINK_PATTERN = /\]\(([^)]+)\)/g

beforeEach(() => {
  vi.stubEnv('DFRAGON_API_ORIGIN', 'http://api.internal.test:3000')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

function sitemapUrls(): string[] {
  const xml = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')

  return [...xml.matchAll(SITEMAP_LOC_PATTERN)].map(([, url]) => url ?? '')
}

type Head = { links?: { rel: string; href: string }[]; meta?: Record<string, string>[] }

it('sitemap의 주소는 모두 있는 route이고, 그 화면이 같은 주소를 canonical로 내며 noindex가 아니다', async () => {
  const { getRouter } = await import('./router')
  const router = getRouter()
  const urls = sitemapUrls()

  expect(urls.length).toBeGreaterThan(0)

  for (const url of urls) {
    expect(url.startsWith(SITE_ORIGIN)).toBe(true)

    const pathname = url.slice(SITE_ORIGIN.length)
    const [matchedRoutes, , foundRoute] = router.getMatchedRoutes(pathname)
    const head = matchedRoutes.at(-1)?.options.head as ((context: object) => Head) | undefined
    const { links = [], meta = [] } = head?.({ params: {}, loaderData: undefined }) ?? {}

    expect(foundRoute, url).toBeDefined()
    expect(links, url).toContainEqual({ rel: 'canonical', href: url })
    expect(
      meta.some(({ name }) => name === 'robots'),
      url
    ).toBe(false)
  }
})

it('robots.txt는 운영 사이트의 sitemap 주소를 알린다', () => {
  const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')

  expect(robots.split('\n')).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
})

it('robots.txt는 /api/ 경로를 막는다', () => {
  const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')

  expect(robots.split('\n')).toContain('Disallow: /api/')
})

it('llms.txt가 링크로 알리는 주소는 sitemap의 주소와 같다', () => {
  const llms = readFileSync(new URL('../../public/llms.txt', import.meta.url), 'utf8')
  const linked = [...llms.matchAll(LLMS_LINK_PATTERN)].map(([, url]) => url ?? '')

  expect(linked.toSorted()).toEqual(sitemapUrls().toSorted())
})
