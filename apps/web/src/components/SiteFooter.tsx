import * as stylex from '@stylexjs/stylex'
import { Link } from '@tanstack/react-router'
import neopleOpenApiColorLogo from '../assets/neople-open-api-color.png'
import neopleOpenApiGrayLogo from '../assets/neople-open-api-gray.png'
import { styles } from './SiteFooter.style'

const NEOPLE_API_URL = 'https://developers.neople.co.kr'

export function SiteFooter(): React.JSX.Element {
  return (
    <footer aria-label="사이트 정보" {...stylex.props(styles.footer)}>
      <a
        href={NEOPLE_API_URL}
        target="_blank"
        rel="noopener noreferrer"
        {...stylex.props(styles.neople)}
      >
        <img
          src={neopleOpenApiColorLogo}
          alt="Neople 오픈 API"
          width={86}
          height={24}
          data-neople-logo="light"
        />
        <img
          src={neopleOpenApiGrayLogo}
          alt="Neople 오픈 API"
          width={86}
          height={24}
          data-neople-logo="dark"
        />
      </a>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <Link to="/terms" {...stylex.props(styles.link)}>
        이용약관
      </Link>
      <Link to="/privacy" {...stylex.props(styles.link)}>
        개인정보처리방침
      </Link>
    </footer>
  )
}
