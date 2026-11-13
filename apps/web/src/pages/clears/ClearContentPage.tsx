import { getRouteApi } from '@tanstack/react-router'
import type { ClearSearch } from './clear-search'
import { ClearContentScreen } from './ClearContentScreen'

const route = getRouteApi('/clears/$contentId')

export function ClearContentPage(): React.JSX.Element {
  const { contentId } = route.useParams()
  const { week } = route.useSearch()
  const navigate = route.useNavigate()

  async function changeSearch({ content = contentId, week }: ClearSearch): Promise<void> {
    await navigate({ params: { contentId: content }, search: { week } })
  }

  return <ClearContentScreen search={{ content: contentId, week }} onSearchChange={changeSearch} />
}
