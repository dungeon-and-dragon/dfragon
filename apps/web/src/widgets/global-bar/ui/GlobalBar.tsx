import { PRODUCT_NAME } from '@dfragon/lib'
import { Link, type LinkProps, useLocation } from '@tanstack/react-router'
import { useRef } from 'react'
import { useIndicatorSlide } from '#shared/lib/animations/useIndicatorSlide'
import { useTodayGrade } from '#widgets/global-bar/api/useTodayGrade'
import { CharacterSearchBox } from './CharacterSearchBox'
import { ColorModeToggle } from '#features/color-mode'
import { TodayGrade } from './TodayGrade'

type GlobalMenuItem = { label: string; to: NonNullable<LinkProps['to']> }

const GLOBAL_MENU: readonly GlobalMenuItem[] = [
  { label: '멀티서치', to: '/multisearch' },
  { label: '검색', to: '/rankings' },
  { label: '통계', to: '/stats' },
  { label: '클리어', to: '/clears' },
  { label: '모험단', to: '/adventures' },
  { label: '즐겨찾기', to: '/favorites' }
]

export function GlobalBar(): React.JSX.Element {
  const grade = useTodayGrade()
  const menuRef = useRef<HTMLElement>(null)
  const underlineRef = useRef<HTMLSpanElement>(null)
  // 지금 항목은 Link만 다시 그려 바뀌므로 주소가 바뀔 때 메뉴도 다시 그려 밑줄을 옮긴다.
  const pathname = useLocation({ select: (location) => location.pathname })
  const isHome = pathname === '/'
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
              className="inline-flex shrink-0 items-center px-3 text-sm font-medium whitespace-nowrap text-fg-muted no-underline transition-colors focus-ring-inset hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {!isHome && <CharacterSearchBox />}
        <TodayGrade grade={grade} />
        <ColorModeToggle />
      </div>
    </header>
  )
}
