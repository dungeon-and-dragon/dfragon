import { Button } from '@dfragon/ui'
import { useState } from 'react'
import type { StoredCharacter } from '#entities/ranking'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { type Affiliation, CharacterTable, SkeletonRow } from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'

const PAGE_SIZE = 50
const LOADING_ROWS = 5

export function CharacterListBox({
  name,
  result,
  affiliation,
  paged = false
}: {
  name: string
  result: LoadedResult<readonly StoredCharacter[]>
  affiliation: Affiliation
  paged?: boolean
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
              rankOnNarrow={false}
              rows={[]}
              affiliations={affiliations}
              scorePlacement="column"
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow
                  key={index}
                  rankOnNarrow={false}
                  scorePlacement="column"
                  affiliations={affiliations}
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
          {paged ? (
            <PagedTable characters={result.value} affiliations={affiliations} />
          ) : (
            <CharacterTable
              rankOnNarrow={false}
              rows={ranked(result.value)}
              affiliations={affiliations}
              scorePlacement="column"
            />
          )}
        </ListBox>
      )
  }
}

function ranked(characters: readonly StoredCharacter[]) {
  return characters.map((character, index) => ({ ...character, rank: index + 1 }))
}

function PagedTable({
  characters,
  affiliations
}: {
  characters: readonly StoredCharacter[]
  affiliations: readonly Affiliation[]
}): React.JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE)

  function showMore(): void {
    setVisible(visible + PAGE_SIZE)
  }

  return (
    <>
      <CharacterTable
        rankOnNarrow={false}
        rows={ranked(characters.slice(0, visible))}
        affiliations={affiliations}
        scorePlacement="column"
      />
      {visible < characters.length && (
        <div className="flex min-h-12 items-center justify-center border-t border-line">
          <Button variant="secondary" size="sm" onClick={showMore}>
            불러오기
          </Button>
        </div>
      )}
    </>
  )
}
