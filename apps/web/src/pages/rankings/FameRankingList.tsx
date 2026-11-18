import { useCallback, useState } from 'react'
import { useInfiniteScrollRef } from '../../hooks/useInfiniteScrollRef'
import type { FameRanking, FameRankingFilter } from '#core/ranking'
import { CharacterTable, SkeletonRow } from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { useFameRanking } from '../../hooks/useFameRanking'
import { rankingName } from './ranking-jobs'

const PAGE_SIZE = 20
const LOADING_ROWS = 5

export function FameRankingList({ filter }: { filter: FameRankingFilter }): React.JSX.Element {
  const result = useFameRanking(filter)
  const name = rankingName(filter)
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={name}>
          {/* 필터를 바꿔 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다. */}
          <div aria-busy="true" className="min-h-screen">
            <span role="status" className="sr-only">
              랭킹을 받는 중입니다.
            </span>
            <CharacterTable
              rows={[]}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} />
              ))}
            />
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={name}>
          <p role="alert" className="state state-error">
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return (
          <ListBox name={name}>
            <p className="state">랭킹에 오른 캐릭터가 없습니다.</p>
          </ListBox>
        )
      }

      return (
        <ListBox name={name}>
          <ScrollingTable
            key={`${filter.jobId}/${filter.jobGrowId}/${filter.role}`}
            ranking={result.value}
          />
        </ListBox>
      )
  }
}

// 응답의 100명을 받아 두고 20명씩 그린다. 다음 줄이 나올 자리의 빈 줄이 화면에 들어오면 20명을 더 그린다.
function ScrollingTable({ ranking }: { ranking: FameRanking }): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { characters } = ranking
  const showMore = useCallback(() => setVisible(visible + PAGE_SIZE), [visible])
  const watchSkeleton = useInfiniteScrollRef<HTMLTableRowElement>(showMore)

  return (
    <CharacterTable
      rows={characters.slice(0, visible)}
      trailing={visible < characters.length ? <SkeletonRow rowRef={watchSkeleton} /> : undefined}
    />
  )
}
