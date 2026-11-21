import { createRootRoute } from '@tanstack/react-router'
import { RootDocument } from '#app/RootDocument'
import { RootLayout } from '#app/RootLayout'
import siteCss from '#app/site.css?url'
import { NotFoundPage } from '#pages/not-found'

const SITE_NAME = 'DFragon'
const SITE_URL = 'https://dfragon.com/'
const SITE_DESCRIPTION =
  '던전앤파이터 파티, 공대의 캐릭터 정보를 닉네임 검색, 스크린샷 붙여넣기, 화면 공유로 설치 없이 바로 확인하는 웹 앱입니다.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: SITE_NAME },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'ko_KR' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: SITE_NAME },
      { property: 'og:description', content: '파티, 공대를 쉽게 확인' },
      { name: 'twitter:card', content: 'summary' }
    ],
    links: [
      { rel: 'stylesheet', href: siteCss },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon.png' },
      { rel: 'canonical', href: SITE_URL }
    ]
  }),
  ssr: true,
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFoundPage
})
