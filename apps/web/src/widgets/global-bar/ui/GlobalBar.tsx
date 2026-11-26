import { PRODUCT_NAME } from '@dfragon/lib'
import { IconButton } from '@dfragon/ui'
import { ClientOnly, Link, type LinkProps, useLocation } from '@tanstack/react-router'
import { useRef } from 'react'
import { useIndicatorSlide } from '#shared/lib/animations/useIndicatorSlide'
import { useTodayGrade } from '#widgets/global-bar/api/useTodayGrade'
import { CharacterSearchBox } from './CharacterSearchBox'
import { ColorModeToggle } from '#features/color-mode'
import { TodayGrade } from './TodayGrade'

type GlobalMenuItem = {
  label: string
  to: NonNullable<LinkProps['to']>
  currentOn?: RegExp
}

const CLEARS_PATH = /^\/clears(\/|$)/
const CHARACTER_SIMULATOR_PATH = /^\/c\/[^/]+\/[^/]+\/simulator$/
const LAB_PATH = /^\/lab(\/|$)/

const GLOBAL_MENU: readonly GlobalMenuItem[] = [
  { label: '멀티서치', to: '/multisearch' },
  { label: '검색', to: '/rankings' },
  { label: '통계', to: '/stats', currentOn: CLEARS_PATH },
  { label: '모험단', to: '/adventures' },
  { label: '장비 시뮬레이터', to: '/simulator', currentOn: CHARACTER_SIMULATOR_PATH },
  { label: '실험실', to: '/lab/enchants', currentOn: LAB_PATH },
  { label: '즐겨찾기', to: '/favorites' }
]

// 첫 화면과 시뮬레이터 검색 화면은 본문에 큰 검색창이 있어 전역 바의 검색창을 숨긴다.
const PATHS_WITHOUT_SEARCH_BOX = new Set(['/', '/simulator'])

export function GlobalBar(): React.JSX.Element {
  const grade = useTodayGrade()
  const menuRef = useRef<HTMLElement>(null)
  const underlineRef = useRef<HTMLSpanElement>(null)
  // 지금 항목은 Link만 다시 그려 바뀌므로 주소가 바뀔 때 메뉴도 다시 그려 밑줄을 옮긴다.
  const pathname = useLocation({ select: (location) => location.pathname })
  useIndicatorSlide({
    containerRef: menuRef,
    indicatorRef: underlineRef,
    targetSelector: '[aria-current="page"]',
    box: 'content'
  })

  return (
    <header className="topbar">
      <div className="page max-md:h-auto max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-0 max-md:pt-2">
        <Link
          to="/"
          aria-label={`${PRODUCT_NAME} 첫 화면`}
          className="flex shrink-0 items-center text-fg no-underline focus-ring"
        >
          <span className="text-base font-bold tracking-heading whitespace-nowrap">
            {PRODUCT_NAME}
          </span>
        </Link>
        <span aria-hidden="true" className="divider-v max-md:hidden" />
        <nav
          ref={menuRef}
          aria-label="전역 메뉴"
          className="relative flex min-w-0 grow items-stretch self-stretch overflow-x-auto max-md:order-last max-md:h-[40px] max-md:basis-full"
        >
          <span
            ref={underlineRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 h-[2px] bg-signal"
          />
          {GLOBAL_MENU.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ includeSearch: false }}
              aria-current={item.currentOn?.test(pathname) === true ? 'page' : undefined}
              className="inline-flex shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap text-fg-muted no-underline transition-colors focus-ring-inset hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {!PATHS_WITHOUT_SEARCH_BOX.has(pathname) && <CharacterSearchBox />}
        <TodayGrade grade={grade} />
        {/* 고른 색 모드와 시스템 설정은 브라우저만 알아, 서버가 만드는 HTML에는 누를 수 없는 빈 버튼으로 자리만 둔다. */}
        <ClientOnly fallback={<IconButton aria-label="색 모드 바꾸기" icon={null} disabled />}>
          <ColorModeToggle />
        </ClientOnly>
      </div>
    </header>
  )
}
