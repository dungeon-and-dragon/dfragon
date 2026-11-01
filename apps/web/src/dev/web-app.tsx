import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/700.css'
import '../site.css'
import { installBrowserHost, WebApp } from '@dfragon/desktop-web'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// 첫 화면에 넣기 전까지 웹 앱을 여는 개발 서버 전용 화면이다. production build의 입력이 아니다.
const host = installBrowserHost(window.location.origin)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebApp host={host} />
  </StrictMode>
)
