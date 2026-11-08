import { PRODUCT_NAME } from '@dfragon/lib'
import * as stylex from '@stylexjs/stylex'
import { Link, type LinkProps, useLocation } from '@tanstack/react-router'
import { useRef } from 'react'
import { useIndicatorSlide } from '../animations/useIndicatorSlide'
import { useTodayGrade } from '../hooks/useTodayGrade'
import { CharacterSearchBox } from './CharacterSearchBox'
import { ColorModeToggle } from './ColorModeToggle'
import { styles } from './GlobalBar.style'
import { TodayGrade } from './TodayGrade'

type GlobalMenuItem = { label: string; to: NonNullable<LinkProps['to']> }

const GLOBAL_MENU: readonly GlobalMenuItem[] = [
  { label: '멀티서치', to: '/multisearch' },
  { label: '랭킹', to: '/rankings' },
  { label: '통계', to: '/stats' },
  { label: '모험단', to: '/adventures' },
  { label: '즐겨찾기', to: '/favorites' }
]

export function GlobalBar(): React.JSX.Element {
  const grade = useTodayGrade()
  const menuRef = useRef<HTMLElement>(null)
  const underlineRef = useRef<HTMLSpanElement>(null)
  // 지금 항목은 Link만 다시 그려 바뀌므로 주소가 바뀔 때 메뉴도 다시 그려 밑줄을 옮긴다.
  useLocation({ select: (location) => location.pathname })
  useIndicatorSlide({
    containerRef: menuRef,
    indicatorRef: underlineRef,
    targetSelector: '[aria-current="page"]',
    box: 'content'
  })

  return (
    <header {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.inner)}>
        <Link to="/" aria-label={`${PRODUCT_NAME} 첫 화면`} {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.name)}>{PRODUCT_NAME}</span>
        </Link>
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <nav ref={menuRef} aria-label="전역 메뉴" {...stylex.props(styles.menu)}>
          <span ref={underlineRef} aria-hidden="true" {...stylex.props(styles.underline)} />
          {GLOBAL_MENU.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ includeSearch: false }}
              {...stylex.props(styles.menuItem)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <CharacterSearchBox />
        <TodayGrade grade={grade} />
        <ColorModeToggle />
      </div>
    </header>
  )
}
