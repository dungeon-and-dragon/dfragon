import { getRouteApi } from '@tanstack/react-router'
import { ClearDetailScreen } from './ClearDetailScreen'

const route = getRouteApi('/clears/$content')

export function ClearDetailPage(): React.JSX.Element {
  const { content } = route.useParams()
  const { stage, week } = route.useSearch()
  const navigate = route.useNavigate()

  async function selectStage(nextStage: string): Promise<void> {
    await navigate({ search: { stage: nextStage, week }, resetScroll: false })
  }

  async function selectWeek(weekStart: string): Promise<void> {
    await navigate({ search: { stage, week: weekStart }, resetScroll: false })
  }

  async function openContent(nextContent: string): Promise<void> {
    if (nextContent === content) {
      await navigate({ to: '/clears', search: { week }, resetScroll: false })

      return
    }

    await navigate({ params: { content: nextContent }, search: { week }, resetScroll: false })
  }

  return (
    <ClearDetailScreen
      contentKey={content}
      stage={stage}
      week={week}
      onStageSelect={selectStage}
      onWeekSelect={selectWeek}
      onContentOpen={openContent}
    />
  )
}
