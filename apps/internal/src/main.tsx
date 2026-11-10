import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import './app.css'
import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createOpsClient } from './api/ops-client'
import { OpsApp } from './OpsApp'

// 운영에서는 host의 reverse proxy가, 개발 서버는 vite.config.ts가 같은 origin의 /api를 API 운영 포트로 넘긴다.
const client = createOpsClient(`${window.location.origin}/api/`, window.fetch.bind(window))
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OpsApp client={client} queryClient={queryClient} />
  </StrictMode>
)
