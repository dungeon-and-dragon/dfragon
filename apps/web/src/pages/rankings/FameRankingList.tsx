import { Button } from '@dfragon/ui'
import { useState } from 'react'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { OathCatalog } from '#entities/catalog'
import {
  type Affiliation,
  CharacterTable,
  type CharacterTableDetail,
  SkeletonRow
} from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'
import {
  type FameRankingFilter,
  type RankedCharacter,
  type FameRankingPages,
  useFameRanking
} from '#entities/ranking'
import { rankingName, rankingSetLines } from '#widgets/ranking-filter'

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
  const ranked = filter.fameTo === undefined

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
              ranked={ranked}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} ranked={ranked} detail affiliations={AFFILIATIONS} />
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
          <PagedTable
            key={[
              filter.jobId,
              filter.jobGrowId,
              filter.role,
              filter.equipmentSetId,
              filter.oathSetId,
              filter.oathSetOption,
              filter.fameFrom,
              filter.fameTo
            ].join('/')}
            ranking={result.value}
            catalog={catalog}
            ranked={ranked}
          />
        </ListBox>
      )
  }
}

function PagedTable({
  ranking,
  catalog,
  ranked
}: {
  ranking: FameRankingPages
  catalog: OathCatalog | null
  ranked: boolean
}): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { characters, hasMore, loadingMore, moreError, loadMore } = ranking
  const canShowMore = visible < characters.length || (hasMore && moreError === null)

  function showMore(): void {
    const next = visible + PAGE_SIZE

    setVisible(next)

    if (characters.length < next) {
      loadMore()
    }
  }

  return (
    <>
      <CharacterTable
        rows={characters.slice(0, visible)}
        detail={setColumnOf(catalog)}
        affiliations={AFFILIATIONS}
        ranked={ranked}
        trailing={
          loadingMore ? (
            <SkeletonRow ranked={ranked} detail affiliations={AFFILIATIONS} />
          ) : undefined
        }
      />
      {!loadingMore && canShowMore && (
        <div className="flex min-h-12 items-center justify-center border-t border-line">
          <Button variant="secondary" size="sm" onClick={showMore}>
            불러오기
          </Button>
        </div>
      )}
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
