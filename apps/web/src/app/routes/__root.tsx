import { PRODUCT_NAME } from '@dfragon/lib'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { RootDocument } from '#app/RootDocument'
import { RootLayout } from '#app/RootLayout'
import siteCss from '#app/site.css?url'
import { NotFoundPage } from '#pages/not-found'

const SITE_DESCRIPTION =
  '던전앤파이터 캐릭터 정보, 장비 통계, 클리어 집계. 파티와 공대는 스크린샷으로 한 번에 조회.'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      // route가 제목을 정하지 않는 없는 주소 화면은 이 제목을 쓴다.
      { title: PRODUCT_NAME },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: PRODUCT_NAME },
      { property: 'og:locale', content: 'ko_KR' },
      { property: 'og:description', content: '캐릭터 정보, 통계, 클리어 집계' },
      { name: 'twitter:card', content: 'summary' }
    ],
    links: [
      { rel: 'stylesheet', href: siteCss },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon.png' }
    ]
  }),
  ssr: true,
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFoundPage
})
