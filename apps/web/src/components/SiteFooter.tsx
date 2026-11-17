import { Link } from '@tanstack/react-router'
import neopleOpenApiColorLogo from '../assets/neople-open-api-color.png'
import neopleOpenApiGrayLogo from '../assets/neople-open-api-gray.png'

const link =
  'px-0.5 py-1 text-fg-subtle no-underline outline-none hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal aria-[current=page]:font-semibold aria-[current=page]:text-fg'

const NEOPLE_API_URL = 'https://developers.neople.co.kr'

export function SiteFooter(): React.JSX.Element {
  return (
    <footer
      aria-label="사이트 정보"
      className="mt-auto flex items-center justify-center gap-3 pt-10 text-xs text-fg-subtle"
    >
      <a
        href={NEOPLE_API_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
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
      <span aria-hidden="true" className="h-3 w-px shrink-0 bg-line" />
      <Link to="/terms" className={link}>
        이용약관
      </Link>
      <Link to="/privacy" className={link}>
        개인정보처리방침
      </Link>
    </footer>
  )
}
