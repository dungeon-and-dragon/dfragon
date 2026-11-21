import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseWeeklySearch } from '#pages/weekly'

// 예전 내 모험단 주소의 북마크가 깨지지 않게 모험단 화면으로 넘긴다.
export const Route = createFileRoute('/my')({
  ssr: true,
  validateSearch: parseWeeklySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/adventures', search, replace: true })
  }
})
