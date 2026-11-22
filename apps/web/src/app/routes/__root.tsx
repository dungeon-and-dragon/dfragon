import { PRODUCT_NAME } from '@dfragon/lib'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { RootDocument } from '#app/RootDocument'
import { RootLayout } from '#app/RootLayout'
import siteCss from '#app/site.css?url'
import { NotFoundPage } from '#pages/not-found'

const SITE_DESCRIPTION =
  '던전앤파이터 캐릭터의 장비, 스킬, 점수와 변화 이력을 한곳에서 봅니다. 직업별 장비 통계와 주간 클리어 집계로 요즘 흐름을 읽고, 파티와 공대는 스크린샷 한 장으로 한 번에 조회합니다.'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      // route가 제목을 정하지 않는 없는 주소 화면은 이 제목을 쓴다.
      { title: PRODUCT_NAME },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: PRODUCT_NAME },
      { property: 'og:locale', content: 'ko_KR' },
      { property: 'og:description', content: '캐릭터 정보, 통계, 클리어 집계를 한곳에서' },
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
