import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCallback, useState } from 'react'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
import type { LoadedResult } from '../../hooks/useLoadedResult'
import { type Affiliation, CharacterTable, SkeletonRow } from './CharacterTable'
import { styles } from './CharacterListBox.style'
import { ListBox } from './ListBox'

const PAGE_SIZE = 20
const LOADING_ROWS = 5
const EMPTY_NAME = '저장된 캐릭터가 없습니다.'

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
            <span role="status" {...stylex.props(shapes.srOnly)}>
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
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.length === 0) {
        return <ListBox name={EMPTY_NAME} />
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
  // visible이 바뀌면 새 callback이라 observer를 다시 만들어, 줄을 더한 뒤에도 빈 줄이 화면 안이면 이어서 더한다.
  const watchSkeleton = useCallback(
    (row: HTMLTableRowElement) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(visible + PAGE_SIZE)
        }
      })
      observer.observe(row)

      return () => observer.disconnect()
    },
    [visible]
  )

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
