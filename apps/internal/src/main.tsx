import './app.css'
import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createOpsClient } from '#ops-api/ops-client'
import { OpsApp } from './OpsApp'
import { pageOf } from './pages'

// 운영에서는 host의 reverse proxy가, 개발 서버는 vite.config.ts가 같은 origin의 /api를 운영 app으로 넘긴다.
const client = createOpsClient(`${window.location.origin}/api/`, window.fetch.bind(window))
const queryClient = new QueryClient()
const page = pageOf(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OpsApp client={client} queryClient={queryClient} page={page} />
  </StrictMode>
)
