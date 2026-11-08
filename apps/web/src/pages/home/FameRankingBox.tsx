import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import {
  type Affiliation,
  CharacterTable,
  SkeletonRow
} from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { useFameRanking } from '../../hooks/useFameRanking'
import { styles } from './FameRankingBox.style'

const NAME = '명성 랭킹'
const SHOWN_COUNT = 3
const NO_AFFILIATIONS: readonly Affiliation[] = []
// 랭킹 화면의 직업 전체 조회와 같은 필터라 조회 캐시를 함께 쓴다.
const ALL_JOBS = {}

export function FameRankingBox(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.box)}>
      <FameRankingTop />
    </div>
  )
}

function FameRankingTop(): React.JSX.Element {
  const result = useFameRanking(ALL_JOBS)
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={NAME}>
          <div aria-busy="true">
            <span role="status" {...stylex.props(shapes.srOnly)}>
              랭킹을 받는 중입니다.
            </span>
            <CharacterTable
              rows={[]}
              affiliations={NO_AFFILIATIONS}
              trailing={Array.from({ length: SHOWN_COUNT }, (_, index) => (
                <SkeletonRow key={index} affiliations={NO_AFFILIATIONS} />
              ))}
            />
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={NAME}>
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return <ListBox name={NAME} />
      }

      return (
        <ListBox name={NAME}>
          <CharacterTable
            rows={result.value.characters.slice(0, SHOWN_COUNT)}
            affiliations={NO_AFFILIATIONS}
          />
        </ListBox>
      )
  }
}
