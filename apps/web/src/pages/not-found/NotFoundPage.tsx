import * as stylex from '@stylexjs/stylex'
import { Link, useLocation } from '@tanstack/react-router'
import { styles } from './NotFoundPage.style'

export function NotFoundPage(): React.JSX.Element {
  const href = useLocation({ select: (location) => location.href })

  return (
    <div {...stylex.props(styles.screen)}>
      <p {...stylex.props(styles.address)}>{`${window.location.host}${href}`}</p>
      <h1 {...stylex.props(styles.title)}>없는 주소입니다.</h1>
      <Link to="/" {...stylex.props(styles.home)}>
        첫 화면으로
      </Link>
    </div>
  )
}
