import { HeadContent, Scripts } from '@tanstack/react-router'

// dev.dfragon.com과 로컬도 같은 빌드를 띄우므로 운영 주소에서만 Google Tag Manager를 불러 통계를 섞지 않는다.
const LOAD_GOOGLE_TAG_MANAGER = `if (location.hostname === 'dfragon.com') {
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    dataLayer.push(arguments)
  }
  gtag('js', new Date())
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-PTWGTSG2'
  document.head.append(script)
}`

// 첫 그리기 전에 고른 모드를 붙여 새로 고칠 때 다른 모드가 잠깐 보이지 않게 한다. key와 형식은
// useColorModeStore(zustand persist), 붙이는 방식은 ColorModeToggle의 applyColorMode와 같다.
// 저장소를 읽을 수 없거나 값이 깨졌으면 시스템 설정을 따른다.
const APPLY_SAVED_COLOR_MODE = `try {
  const colorMode = JSON.parse(localStorage.getItem('dfragon:color-mode'))?.state?.colorMode
  if (colorMode === 'light' || colorMode === 'dark') {
    document.documentElement.dataset.colorMode = colorMode
    for (const meta of document.querySelectorAll('meta[name="theme-color"][data-color-mode]')) {
      meta.media = meta.dataset.colorMode === colorMode ? 'all' : 'not all'
    }
  }
} catch {}`

// 위 script가 hydration 전에 html의 data-color-mode와 theme-color의 media를 바꾸므로 그 요소들은 불일치 경고를 끈다.
export function RootDocument({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <HeadContent />
        <meta
          name="theme-color"
          data-color-mode="light"
          media="(prefers-color-scheme: light)"
          content="#ffffff"
          suppressHydrationWarning
        />
        <meta
          name="theme-color"
          data-color-mode="dark"
          media="(prefers-color-scheme: dark)"
          content="#0a0a0b"
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: APPLY_SAVED_COLOR_MODE }} />
        <script dangerouslySetInnerHTML={{ __html: LOAD_GOOGLE_TAG_MANAGER }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
