import { useCallback, useState } from 'react'
import { useInfiniteScrollRef } from '#hooks/useInfiniteScrollRef'
import type { StoredCharacter } from '#core/ranking'
import type { LoadedResult } from '#hooks/useLoadedResult'
import { type Affiliation, CharacterTable, SkeletonRow } from '#components/table/CharacterTable'
import { ListBox } from '#components/table/ListBox'

const PAGE_SIZE = 20
const LOADING_ROWS = 5

export function CharacterListBox({
  name,
  result,
  affiliation,
  scrolling = false
}: {
  name: string
  result: LoadedResult<readonly StoredCharacter[]>
  affiliation: Affiliation
  scrolling?: boolean
}): React.JSX.Element {
  const affiliations = [affiliation]
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={name}>
          <div aria-busy="true">
            <span role="status" className="sr-only">
              목록을 받는 중입니다.
            </span>
            <CharacterTable
              rows={[]}
              affiliations={affiliations}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} affiliations={affiliations} />
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
      if (result.value.length === 0) {
        return (
          <ListBox name={name}>
            <p className="state">저장된 캐릭터가 없습니다.</p>
          </ListBox>
        )
      }

      return (
        <ListBox name={name}>
          {scrolling ? (
            <ScrollingTable characters={result.value} affiliations={affiliations} />
          ) : (
            <CharacterTable rows={ranked(result.value)} affiliations={affiliations} />
          )}
        </ListBox>
      )
  }
}

function ranked(characters: readonly StoredCharacter[]) {
  return characters.map((character, index) => ({ ...character, rank: index + 1 }))
}

function ScrollingTable({
  characters,
  affiliations
}: {
  characters: readonly StoredCharacter[]
  affiliations: readonly Affiliation[]
}): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const showMore = useCallback(() => setVisible(visible + PAGE_SIZE), [visible])
  const watchSkeleton = useInfiniteScrollRef<HTMLTableRowElement>(showMore)

  return (
    <CharacterTable
      rows={ranked(characters.slice(0, visible))}
      affiliations={affiliations}
      trailing={
        visible < characters.length ? (
          <SkeletonRow rowRef={watchSkeleton} affiliations={affiliations} />
        ) : undefined
      }
    />
  )
}
