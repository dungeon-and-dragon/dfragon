export const OPS_PAGES = [
  { id: 'ops', label: '운영', path: '/' },
  { id: 'lab-candidates', label: '실험실 후보', path: '/lab-candidates' }
] as const

export type OpsPageId = (typeof OPS_PAGES)[number]['id']

const TRAILING_SLASH_PATTERN = /\/+$/

// edge와 Caddy가 모르는 경로도 index.html을 주므로, 모르는 경로는 운영 페이지로 연다.
export function pageOf(pathname: string): OpsPageId {
  const path = pathname.replace(TRAILING_SLASH_PATTERN, '') || '/'
  const page = OPS_PAGES.find((candidate) => candidate.path === path)

  if (page === undefined) {
    return 'ops'
  }

  return page.id
}
