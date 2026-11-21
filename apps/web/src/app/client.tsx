import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserHostContext, installBrowserHost } from '#features/capture-search'
import { API_BASE_URL } from '#shared/api/dfragon-api'

// host는 페이지의 붙여넣기 listener를 달기 때문에 브라우저가 이 모듈을 읽을 때 한 번만 설치한다.
const host = installBrowserHost(API_BASE_URL)

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <BrowserHostContext value={host}>
        <StartClient />
      </BrowserHostContext>
    </StrictMode>
  )
})
