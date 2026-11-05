import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense } from 'react'
import neopleOpenApiLogo from './assets/neople-open-api-gray.png'
import { styles } from './App.style'

const NEOPLE_API_URL = 'https://developers.neople.co.kr'

// 웹 앱은 Base UI와 카드 묶음이 커서 빈 전역 바를 먼저 그린 뒤 받는다.
const WebClient = lazy(() => import('./WebClient'))

export default function App(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.page)}>
      <Suspense fallback={<div {...stylex.props(styles.appPending)} />}>
        <WebClient />
      </Suspense>
      <a
        href={NEOPLE_API_URL}
        target="_blank"
        rel="noopener noreferrer"
        {...stylex.props(styles.neople)}
      >
        <img
          src={neopleOpenApiLogo}
          alt="Neople 오픈 API"
          width={86}
          height={24}
          {...stylex.props(styles.neopleLogo)}
        />
      </a>
    </div>
  )
}
