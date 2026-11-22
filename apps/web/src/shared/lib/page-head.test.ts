import { expect, it } from 'vitest'
import { pageHead } from './page-head'

it('색인하는 화면은 제목 뒤에 제품 이름을 붙이고 운영 사이트 주소를 canonical과 og:url로 낸다', () => {
  expect(pageHead({ title: '이용약관', path: '/terms' })).toEqual({
    meta: [
      { title: '이용약관 - DFragon' },
      { property: 'og:title', content: '이용약관 - DFragon' },
      { property: 'og:url', content: 'https://dfragon.com/terms' }
    ],
    links: [{ rel: 'canonical', href: 'https://dfragon.com/terms' }],
    scripts: []
  })
})

it('제목이 없는 화면은 제품 이름만 제목으로 쓴다', () => {
  expect(pageHead({ title: null, path: '/' }).meta).toContainEqual({ title: 'DFragon' })
})

it('색인하지 않는 화면은 robots noindex를 내고 canonical을 내지 않는다', () => {
  const head = pageHead({ title: '즐겨찾기', path: '/favorites', indexed: false })

  expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex' })
  expect(head.links).toEqual([])
})

it('구조화 데이터는 schema.org context를 붙인 JSON-LD script로 내고 이름의 <를 태그로 읽히지 않게 바꾼다', () => {
  const structuredData = { '@type': 'ProfilePage', name: '</script><b>' }

  const { scripts } = pageHead({ title: '캐릭터', path: '/c/cain/1', structuredData })

  expect(scripts).toHaveLength(1)
  expect(scripts[0]?.type).toBe('application/ld+json')
  expect(scripts[0]?.children).not.toContain('<')
  expect(JSON.parse(scripts[0]?.children ?? '')).toEqual({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: '</script><b>'
  })
})

it('색인하지 않는 화면은 구조화 데이터를 내지 않는다', () => {
  const structuredData = { '@type': 'WebSite', name: 'DFragon' }

  const { scripts } = pageHead({ title: '검색', path: '/search', indexed: false, structuredData })

  expect(scripts).toEqual([])
})
