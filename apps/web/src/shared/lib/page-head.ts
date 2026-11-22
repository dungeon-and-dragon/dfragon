import { PRODUCT_NAME } from '@dfragon/lib'

// 검색 엔진과 링크 미리보기에 내는 주소는 dev나 로컬에서 그려도 운영 사이트의 주소다.
const SITE_ORIGIN = 'https://dfragon.com'

// schema.org의 구조화 데이터(JSON-LD)다. '@context'는 pageHead가 붙인다.
type StructuredData = Readonly<{ '@type': string } & Record<string, unknown>>

type PageHeadOptions = Readonly<{
  title: string | null
  path: string
  indexed?: boolean
  structuredData?: StructuredData | null
}>

type PageMeta =
  | { title: string }
  | { property: string; content: string }
  | { name: string; content: string }

type PageHead = {
  meta: PageMeta[]
  links: Array<{ rel: string; href: string }>
  scripts: Array<{ type: string; children: string }>
}

// script 안에 그대로 들어가므로, 이름에 든 '<'가 태그를 닫지 못하게 유니코드 표기로 바꾼다.
function structuredDataScript(structuredData: StructuredData): { type: string; children: string } {
  const json = JSON.stringify({ '@context': 'https://schema.org', ...structuredData })
  const children = json.replaceAll('<', '\\u003c')

  return { type: 'application/ld+json', children }
}

export function siteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`
}

export function pageHead({
  title,
  path,
  indexed = true,
  structuredData = null
}: PageHeadOptions): PageHead {
  const fullTitle = title !== null ? `${title} - ${PRODUCT_NAME}` : PRODUCT_NAME
  const url = siteUrl(path)
  const meta: PageMeta[] = [
    { title: fullTitle },
    { property: 'og:title', content: fullTitle },
    { property: 'og:url', content: url }
  ]

  if (!indexed) {
    const noindexMeta = [...meta, { name: 'robots', content: 'noindex' }]

    return { meta: noindexMeta, links: [], scripts: [] }
  }

  const scripts = structuredData !== null ? [structuredDataScript(structuredData)] : []

  return { meta, links: [{ rel: 'canonical', href: url }], scripts }
}
