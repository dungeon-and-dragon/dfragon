import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { RelativeTime } from '../../components/RelativeTime'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useCharacterStats } from '../../hooks/useCharacterStats'
import { type Bar, type ColumnBar, ColumnBars, RowBars } from './BarCharts'
import { styles } from './StatsScreen.style'
import { averageFameBars, fameBars, jobBars, serverBars } from './stats-bars'

const integer = new Intl.NumberFormat('ko-KR')

export function StatsScreen(): React.JSX.Element {
  const result = useCharacterStats()
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(styles.screen)}>
          <span role="status" {...stylex.props(shapes.srOnly)}>
            통계를 받는 중입니다.
          </span>
          <TitleBox title="캐릭터 통계" />
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(styles.screen)}>
          <TitleBox title="캐릭터 통계" />
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const stats = result.value

      return (
        <div {...stylex.props(styles.screen)}>
          <TitleBox title="캐릭터 통계">
            <TitleStat label="캐릭터" value={integer.format(stats.total)} />
            {stats.computedAt !== null && (
              <TitleStat
                label="마지막 업데이트 시간"
                value={<RelativeTime at={stats.computedAt} />}
              />
            )}
          </TitleBox>
          <div {...stylex.props(styles.grid)}>
            <StatBox name="서버 인구" bars={serverBars(stats)} />
            <FameBox bars={fameBars(stats)} />
            <StatBox name="직업 분포" bars={jobBars(stats)} />
            <StatBox name="직업별 평균 명성" bars={averageFameBars(stats)} />
          </div>
        </div>
      )
    }
  }
}

function StatBox({ name, bars }: { name: string; bars: readonly Bar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={name} />
  }

  return (
    <ListBox name={name}>
      <RowBars bars={bars} />
    </ListBox>
  )
}

function FameBox({ bars }: { bars: readonly ColumnBar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name="명성 분포" />
  }

  return (
    <ListBox name="명성 분포">
      <ColumnBars bars={bars} />
    </ListBox>
  )
}
