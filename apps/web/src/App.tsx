import { PRODUCT_NAME } from '@dfragon/lib'
import { timeOfDayImages } from '@dfragon/desktop-site/time-of-day'
import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense } from 'react'
import neopleOpenApiLogo from './assets/neople-open-api.png'
import { DownloadLink } from './download/DownloadLink'
import { ExternalLinkIcon } from './icons'
import { useTimeOfDay } from './useTimeOfDay'
import { styles } from './App.style'

const REPOSITORY_URL = 'https://github.com/dungeon-and-dragon/dfragon'
const NEOPLE_API_URL = 'https://developers.neople.co.kr'

// 웹 앱은 Base UI와 Desktop 카드 묶음이 커서 첫 문장을 먼저 그린 뒤 받는다.
const WebClient = lazy(() => import('./WebClient'))

export default function App(): React.JSX.Element {
  const timeOfDay = useTimeOfDay()

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <a href="/" {...stylex.props(styles.brand)}>
          <img src="/favicon.png" alt="" width={32} height={32} {...stylex.props(styles.icon)} />
          {PRODUCT_NAME}
        </a>
        <nav aria-label="주 메뉴" {...stylex.props(styles.nav)}>
          <a href={REPOSITORY_URL} {...stylex.props(styles.navLink)}>
            GitHub
            <ExternalLinkIcon width={14} height={14} />
          </a>
        </nav>
      </header>
      <main
        data-time-of-day={timeOfDay}
        {...stylex.props(
          styles.hero,
          styles[timeOfDay],
          styles.sky(`url("${timeOfDayImages[timeOfDay]}")`)
        )}
      >
        <section aria-labelledby="hero-title" {...stylex.props(styles.panel)}>
          <h1 id="hero-title" {...stylex.props(styles.title)}>
            파티, 공대를 쉽게 확인
          </h1>
          <p {...stylex.props(styles.text)}>
            닉네임을 검색하거나, 던파 스크린샷을 붙여 넣거나, 던파 창을 화면 공유하면 바로 확인해요.
          </p>
          <p {...stylex.props(styles.text)}>
            데스크톱 브라우저용이에요. 휴대폰은 지원하지 않고, 창이 좁으면 아래 상자 안에서 가로로
            스크롤해요.
          </p>
        </section>
        <section aria-label={`${PRODUCT_NAME} 웹 앱`} {...stylex.props(styles.app)}>
          <Suspense fallback={<div {...stylex.props(styles.appPending)} />}>
            <WebClient />
          </Suspense>
        </section>
        <section aria-label="안내" {...stylex.props(styles.notes)}>
          <div {...stylex.props(styles.note)}>
            <h2 {...stylex.props(styles.noteTitle)}>보내는 정보</h2>
            <ul {...stylex.props(styles.noteList)}>
              <li>닉네임과 조회한 캐릭터는 api.dfragon.com으로 보내요.</li>
              <li>캐릭터 초상화는 API가 네오플에서 받아 전달해요.</li>
              <li>붙여 넣거나 공유한 화면 이미지는 브라우저 밖으로 나가지 않아요.</li>
            </ul>
          </div>
          <div {...stylex.props(styles.note)}>
            <h2 {...stylex.props(styles.noteTitle)}>게임 안에서 쓰려면</h2>
            <p {...stylex.props(styles.text)}>
              Desktop 앱을 받으면 게임 위에서 Alt+R로 바로 인식해요.
            </p>
            <DownloadLink />
          </div>
        </section>
      </main>
      <footer {...stylex.props(styles.footer)}>
        <a href={NEOPLE_API_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={neopleOpenApiLogo}
            alt="Neople 오픈 API"
            width={191}
            height={36}
            {...stylex.props(styles.neopleLogo)}
          />
        </a>
      </footer>
    </div>
  )
}
