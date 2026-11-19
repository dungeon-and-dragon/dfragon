import { Button } from '@dfragon/ui'
import { useCallback, useState } from 'react'
import { MISSING_VALUE } from '#core/capture'
import type { OathCatalog } from '#core/catalog'
import type { FameRankingFilter, RankedCharacter } from '#core/ranking'
import {
  type Affiliation,
  CharacterTable,
  type CharacterTableDetail,
  SkeletonRow
} from '#components/table/CharacterTable'
import { ListBox } from '#shared/ui/ListBox'
import { type FameRankingPages, useFameRanking } from '#entities/ranking'
import { useInfiniteScrollRef } from '#shared/lib/useInfiniteScrollRef'
import { rankingName } from './ranking-jobs'
import { rankingSetLines } from './ranking-sets'

const PAGE_SIZE = 20
const LOADING_ROWS = 5
// 세트 열이 길드 열 자리를 쓴다.
const AFFILIATIONS: readonly Affiliation[] = ['adventure']

function setColumnOf(catalog: OathCatalog | null): CharacterTableDetail<RankedCharacter> {
  return {
    name: '세트',
    render: (row) => <SetLines row={row} catalog={catalog} />
  }
}

function SetLines({
  row,
  catalog
}: {
  row: RankedCharacter
  catalog: OathCatalog | null
}): React.JSX.Element {
  const { equipment, oath } = rankingSetLines(row, catalog)
  if (equipment === null && oath === null) {
    return <span className="text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate leading-4">{equipment ?? MISSING_VALUE}</span>
      <span className="truncate text-xs leading-4 text-fg-muted">{oath ?? MISSING_VALUE}</span>
    </span>
  )
}

export function FameRankingList({
  filter,
  setLabel,
  catalog
}: {
  filter: FameRankingFilter
  setLabel: string | null
  catalog: OathCatalog | null
}): React.JSX.Element {
  const result = useFameRanking(filter)
  const name = rankingName(filter, setLabel)
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
              detail={setColumnOf(catalog)}
              affiliations={AFFILIATIONS}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} detail affiliations={AFFILIATIONS} />
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
            key={[
              filter.jobId,
              filter.jobGrowId,
              filter.role,
              filter.equipmentSetId,
              filter.oathSetId,
              filter.oathSetOption
            ].join('/')}
            ranking={result.value}
            catalog={catalog}
          />
        </ListBox>
      )
  }
}

// 받은 행을 20명씩 그리고, 다음 줄 자리의 빈 줄이 화면에 들어오면 20명을 더 그린다.
// 받은 행을 다 그리면 다음 page를 받아 잇는다.
function ScrollingTable({
  ranking,
  catalog
}: {
  ranking: FameRankingPages
  catalog: OathCatalog | null
}): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { characters, hasMore, moreError, loadMore } = ranking
  // 받은 행을 다 그린 뒤에만 다음 page를 받는다. 받는 동안 빈 줄이 화면에 남아도 그릴 행 수를 늘리지 않는다.
  const showMore = useCallback(() => {
    if (visible < characters.length) {
      setVisible(visible + PAGE_SIZE)
    } else {
      loadMore()
    }
  }, [visible, characters.length, loadMore])
  const watchSkeleton = useInfiniteScrollRef<HTMLTableRowElement>(showMore)
  const waiting = visible < characters.length || (hasMore && moreError === null)

  return (
    <>
      <CharacterTable
        rows={characters.slice(0, visible)}
        detail={setColumnOf(catalog)}
        affiliations={AFFILIATIONS}
        trailing={
          waiting ? (
            <SkeletonRow rowRef={watchSkeleton} detail affiliations={AFFILIATIONS} />
          ) : undefined
        }
      />
      {moreError !== null && visible >= characters.length && (
        <div className="state state-error flex-row border-t border-line">
          <p role="alert" className="m-0">
            {moreError}
          </p>
          <Button variant="secondary" size="sm" onClick={loadMore}>
            다시 시도
          </Button>
        </div>
      )}
    </>
  )
}
