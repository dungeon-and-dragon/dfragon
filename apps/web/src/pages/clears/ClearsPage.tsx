import { getRouteApi } from '@tanstack/react-router'
import { ClearOverviewScreen } from './ClearOverviewScreen'

const route = getRouteApi('/clears')

export function ClearsPage(): React.JSX.Element {
  const { week } = route.useSearch()
  const navigate = route.useNavigate()

  async function selectWeek(weekStart: string): Promise<void> {
    await navigate({ search: { week: weekStart } })
  }

  async function openContent(content: string, weekStart: string): Promise<void> {
    await navigate({ to: '/clears/$content', params: { content }, search: { week: weekStart } })
  }

  return <ClearOverviewScreen week={week} onWeekSelect={selectWeek} onContentOpen={openContent} />
}
