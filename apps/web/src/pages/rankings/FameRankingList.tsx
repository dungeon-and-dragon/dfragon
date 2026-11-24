import { Button, Pagination } from '@dfragon/ui'
import { useState } from 'react'
import type { OathCatalog } from '#entities/catalog'
import {
  type Affiliation,
  CharacterTable,
  type CharacterTableDetail,
  SkeletonRow,
  type SortedColumn
} from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'
import {
  evolutionsQueryText,
  type FameRankingFilter,
  type RankedCharacter,
  type FameRankingPages,
  useFameRanking
} from '#entities/ranking'
import { RankingSetLines, rankingName } from '#widgets/ranking-filter'

const PAGE_SIZE = 20
const LOADING_ROWS = 5
const FAILURE_MESSAGE = '검색 결과를 받지 못했습니다.'
// 세트 열이 길드 열 자리를 쓴다.
const AFFILIATIONS: readonly Affiliation[] = ['adventure']

function setColumnOf(catalog: OathCatalog | null): CharacterTableDetail<RankedCharacter> {
  return {
    name: '세트',
    render: (row) => <RankingSetLines character={row} catalog={catalog} />
  }
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
  const sortedBy: SortedColumn = filter.sort !== undefined ? 'score' : 'fame'

  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={name}>
          {/* 필터를 바꿔 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다. */}
          <div aria-busy="true" className="min-h-dvh">
            <CharacterTable
              rows={[]}
              detail={setColumnOf(catalog)}
              affiliations={AFFILIATIONS}
              ranked={false}
              scorePlacement="column"
              sortedBy={sortedBy}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow
                  key={index}
                  ranked={false}
                  detail
                  scorePlacement="column"
                  affiliations={AFFILIATIONS}
                />
              ))}
            />
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={name}>
          <p role="alert" className="state state-error">
            {FAILURE_MESSAGE}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return (
          <ListBox name={name}>
            <p className="state">조건에 맞는 캐릭터가 없습니다.</p>
          </ListBox>
        )
      }

      return (
        <ListBox name={name}>
          <PagedTable
            key={[
              filter.jobId,
              filter.jobGrowId,
              filter.role,
              filter.equipmentSetId,
              filter.oathSetId,
              filter.oathSetOption,
              filter.itemIds?.join(','),
              evolutionsQueryText(filter.evolutions ?? []),
              filter.sort,
              filter.fameFrom,
              filter.fameTo,
              filter.scoreFrom,
              filter.scoreTo
            ].join('/')}
            ranking={result.value}
            catalog={catalog}
            sortedBy={sortedBy}
          />
        </ListBox>
      )
  }
}

function PagedTable({
  ranking,
  catalog,
  sortedBy
}: {
  ranking: FameRankingPages
  catalog: OathCatalog | null
  sortedBy: SortedColumn
}): React.JSX.Element {
  const [page, setPage] = useState(0)
  const { characters, hasMore, loadingMore, moreError, loadMore } = ranking
  const start = page * PAGE_SIZE
  const end = start + PAGE_SIZE
  const rows = characters.slice(start, end)
  const failed = rows.length === 0 && moreError !== null && !loadingMore
  const waiting = rows.length === 0 && !failed
  const isLastPage = end >= characters.length && !hasMore
  const skeletonRows = waiting
    ? Array.from({ length: LOADING_ROWS }, (_, index) => (
        <SkeletonRow
          key={index}
          ranked={false}
          detail
          scorePlacement="column"
          affiliations={AFFILIATIONS}
        />
      ))
    : undefined

  function showNext(): void {
    const nextEnd = end + PAGE_SIZE

    setPage(page + 1)

    if (characters.length < nextEnd && hasMore) {
      loadMore()
    }
  }

  function showPrevious(): void {
    setPage(page - 1)
  }

  return (
    <>
      {failed ? (
        <div className="state state-error flex-col border-t border-line">
          <p role="alert" className="m-0">
            {FAILURE_MESSAGE}
          </p>
          <Button variant="secondary" size="sm" onClick={loadMore}>
            다시 시도
          </Button>
        </div>
      ) : (
        <div aria-busy={waiting ? 'true' : undefined}>
          <CharacterTable
            rows={rows}
            detail={setColumnOf(catalog)}
            affiliations={AFFILIATIONS}
            ranked={false}
            scorePlacement="column"
            sortedBy={sortedBy}
            trailing={skeletonRows}
          />
        </div>
      )}
      <Pagination
        page={page + 1}
        onPrevious={showPrevious}
        onNext={showNext}
        previousDisabled={page === 0 || waiting}
        nextDisabled={isLastPage || waiting || failed}
      />
    </>
  )
}
