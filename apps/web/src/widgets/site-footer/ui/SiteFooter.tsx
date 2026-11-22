import { Link } from '@tanstack/react-router'
import neopleOpenApiColorLogo from '#shared/assets/neople-open-api-color.png'
import neopleOpenApiGrayLogo from '#shared/assets/neople-open-api-gray.png'

const link =
  'link p-1 text-fg-subtle focus-ring aria-[current=page]:font-semibold aria-[current=page]:text-fg'

const NEOPLE_API_URL = 'https://developers.neople.co.kr'
const DISCORD_URL = 'https://discord.gg/MMRhM22RXN'

export function SiteFooter(): React.JSX.Element {
  return (
    <footer
      aria-label="사이트 정보"
      className="mt-auto flex items-center justify-center gap-3 pt-12 text-xs text-fg-subtle"
    >
      <a
        href={NEOPLE_API_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus-ring"
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
      <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={link}>
        디스코드
      </a>
    </footer>
  )
}
