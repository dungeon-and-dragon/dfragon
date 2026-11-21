import { PRODUCT_NAME } from '@dfragon/lib'

// 검색 엔진과 링크 미리보기에 내는 주소는 dev나 로컬에서 그려도 운영 사이트의 주소다.
const SITE_ORIGIN = 'https://dfragon.com'

type PageHeadOptions = Readonly<{
  title: string | null
  path: string
  indexed?: boolean
}>

type PageMeta =
  | { title: string }
  | { property: string; content: string }
  | { name: string; content: string }

type PageHead = {
  meta: PageMeta[]
  links: Array<{ rel: string; href: string }>
}

export function pageHead({ title, path, indexed = true }: PageHeadOptions): PageHead {
  const fullTitle = title !== null ? `${title} - ${PRODUCT_NAME}` : PRODUCT_NAME
  const url = `${SITE_ORIGIN}${path}`
  const meta: PageMeta[] = [
    { title: fullTitle },
    { property: 'og:title', content: fullTitle },
    { property: 'og:url', content: url }
  ]

  if (!indexed) {
    const noindexMeta = [...meta, { name: 'robots', content: 'noindex' }]

    return { meta: noindexMeta, links: [] }
  }

  return { meta, links: [{ rel: 'canonical', href: url }] }
}
