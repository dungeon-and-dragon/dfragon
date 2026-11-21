import { getRouteApi } from '@tanstack/react-router'
import { StatsTabs } from '#widgets/stats-tabs'
import { ClearOverviewScreen } from './ClearOverviewScreen'

const route = getRouteApi('/clears')

export function ClearsPage(): React.JSX.Element {
  const { week } = route.useSearch()
  const navigate = route.useNavigate()

  async function selectWeek(weekStart: string): Promise<void> {
    await navigate({ search: { week: weekStart }, resetScroll: false })
  }

  async function openContent(content: string, weekStart: string): Promise<void> {
    await navigate({
      to: '/clears/$content',
      params: { content },
      search: { week: weekStart },
      resetScroll: false
    })
  }

  return (
    <div className="flex flex-col">
      <StatsTabs />
      <ClearOverviewScreen week={week} onWeekSelect={selectWeek} onContentOpen={openContent} />
    </div>
  )
}
