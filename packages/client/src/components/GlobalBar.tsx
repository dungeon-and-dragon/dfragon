import { PRODUCT_NAME } from '@dfragon/lib'
import * as stylex from '@stylexjs/stylex'
import { Link, type LinkProps } from '@tanstack/react-router'
import { useTodayGrade } from '../hooks/useTodayGrade'
import { CharacterSearchBox } from './CharacterSearchBox'
import { ColorModeToggle } from './ColorModeToggle'
import { styles } from './GlobalBar.style'
import { TodayGrade } from './TodayGrade'

const brandIcon = new URL('../assets/dfragon-icon.png', import.meta.url).href

type GlobalMenuItem = { label: string; to: NonNullable<LinkProps['to']> }

const GLOBAL_MENU: readonly GlobalMenuItem[] = [
  { label: '파티, 공대', to: '/' },
  { label: '랭킹', to: '/rankings' },
  { label: '통계', to: '/stats' },
  { label: '모험단', to: '/adventures' },
  { label: '즐겨찾기', to: '/favorites' }
]

export function GlobalBar(): React.JSX.Element {
  const grade = useTodayGrade()

  return (
    <header {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.inner)}>
        <Link to="/" aria-label={`${PRODUCT_NAME} 첫 화면`} {...stylex.props(styles.brand)}>
          <img src={brandIcon} alt="" width={24} height={24} {...stylex.props(styles.brandIcon)} />
          <span {...stylex.props(styles.name)}>{PRODUCT_NAME}</span>
        </Link>
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <nav aria-label="전역 메뉴" {...stylex.props(styles.menu)}>
          {GLOBAL_MENU.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              // 첫 화면 주소는 모든 주소의 앞부분이라 같은 주소일 때만 지금 화면으로 본다.
              activeOptions={{ exact: item.to === '/', includeSearch: false }}
              {...stylex.props(styles.menuItem)}
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && <i aria-hidden="true" {...stylex.props(styles.underline)} />}
                </>
              )}
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
