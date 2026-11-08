import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCallback, useState } from 'react'
import type { FameRanking, FameRankingFilter } from '#core/ranking/ranking-stats'
import { CharacterTable, SkeletonRow } from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { useFameRanking } from '../../hooks/useFameRanking'
import { rankingName } from './ranking-jobs'
import { styles } from './RankingsScreen.style'

const PAGE_SIZE = 20
const LOADING_ROWS = 5

export function FameRankingList({ filter }: { filter: FameRankingFilter }): React.JSX.Element {
  const result = useFameRanking(filter)
  const name = rankingName(filter)
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={name}>
          <div aria-busy="true">
            <span role="status" {...stylex.props(shapes.srOnly)}>
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
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return <ListBox name={name} />
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
      rows={characters.slice(0, visible)}
      trailing={visible < characters.length ? <SkeletonRow rowRef={watchSkeleton} /> : undefined}
    />
  )
}
