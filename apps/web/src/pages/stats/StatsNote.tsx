import { PageNote } from '#shared/ui/PageNote'
import { RelativeTime } from '#shared/ui/RelativeTime'

const integer = new Intl.NumberFormat('ko-KR')

export function StatsNote({
  count,
  computedAt
}: {
  count: number
  computedAt: string | null
}): React.JSX.Element {
  return (
    <PageNote>
      {`캐릭터 ${integer.format(count)}`}
      {computedAt !== null && (
        <>
          {', 마지막 업데이트 '}
          <RelativeTime at={computedAt} />
        </>
      )}
    </PageNote>
  )
}
