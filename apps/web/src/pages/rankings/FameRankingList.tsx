import { Pagination } from '@dfragon/ui'
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
  useFameRanking
} from '#entities/ranking'
import { RankingSetLines, rankingName } from '#widgets/ranking-filter'

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
  const name = rankingName(filter, setLabel)
  const sortedBy: SortedColumn = filter.sort !== undefined ? 'score' : 'fame'

  return (
    <ListBox name={name}>
      <RankingPages
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
        filter={filter}
        catalog={catalog}
        sortedBy={sortedBy}
      />
    </ListBox>
  )
}

function RankingPages({
  filter,
  catalog,
  sortedBy
}: {
  filter: FameRankingFilter
  catalog: OathCatalog | null
  sortedBy: SortedColumn
}): React.JSX.Element {
  const [page, setPage] = useState(1)
  const result = useFameRanking(filter, page)
  const skeletonRows = Array.from({ length: LOADING_ROWS }, (_, index) => (
    <SkeletonRow
      key={index}
      ranked={false}
      detail
      scorePlacement="column"
      affiliations={AFFILIATIONS}
    />
  ))

  function table(rows: readonly RankedCharacter[], waiting: boolean): React.JSX.Element {
    return (
      <CharacterTable
        rows={rows}
        detail={setColumnOf(catalog)}
        affiliations={AFFILIATIONS}
        ranked={false}
        scorePlacement="column"
        sortedBy={sortedBy}
        trailing={waiting ? skeletonRows : undefined}
      />
    )
  }

  switch (result.status) {
    case 'loading':
      return (
        // 필터를 바꿔 다시 받는 동안 문서가 짧아져 스크롤이 위로 밀리지 않게 화면 높이만큼 자리를 둔다.
        <div aria-busy="true" className="min-h-dvh">
          {table([], true)}
        </div>
      )
    case 'error':
      return (
        <>
          <p role="alert" className="state state-error">
            {FAILURE_MESSAGE}
          </p>
          {page > 1 && <Pagination page={page} pageCount={page} onPageChange={setPage} />}
        </>
      )
    case 'success': {
      const { characters, pageCount } = result.value
      const waiting = result.value.page !== page

      if (pageCount === 0) {
        return <p className="state">조건에 맞는 캐릭터가 없습니다.</p>
      }

      return (
        <>
          <div aria-busy={waiting ? 'true' : undefined}>
            {table(waiting ? [] : characters, waiting)}
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={waiting} />
        </>
      )
    }
  }
}
