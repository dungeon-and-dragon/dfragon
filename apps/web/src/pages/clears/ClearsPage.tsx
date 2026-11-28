import { getRouteApi } from '@tanstack/react-router'
import { StatsTabs } from '#widgets/stats-tabs'
import { ClearOverviewScreen } from './ClearOverviewScreen'

const route = getRouteApi('/clears/')

export function ClearsPage(): React.JSX.Element {
  const navigate = route.useNavigate()

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
      <ClearOverviewScreen onContentOpen={openContent} />
    </div>
  )
}
