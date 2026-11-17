import { RelativeTime } from '../../components/RelativeTime'
import { Columns } from '../../components/chart/Columns'
import { type Bar, type BarTone, RowBars } from '../../components/chart/RowBars'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useCharacterStats } from './hooks/useCharacterStats'
import {
  averageFameBars,
  type FameBar,
  fameBars,
  jobBars,
  serverBars
} from '../../components/chart/stats-bars'

const integer = new Intl.NumberFormat('ko-KR')
const SCREEN = 'flex flex-col gap-4 p-4'

export function StatsPage(): React.JSX.Element {
  const result = useCharacterStats()
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className={SCREEN}>
          <span role="status" className="sr-only">
            통계를 받는 중입니다.
          </span>
          <TitleBox title="캐릭터 통계" />
        </div>
      )
    case 'error':
      return (
        <div className={SCREEN}>
          <TitleBox title="캐릭터 통계" />
          <p role="alert" className="m-0 text-sm text-fg-danger">
            {result.message}
          </p>
        </div>
      )
    case 'success': {
      const stats = result.value

      return (
        <div className={SCREEN}>
          <TitleBox title="캐릭터 통계">
            <TitleStat label="캐릭터" value={integer.format(stats.total)} />
            {stats.computedAt !== null && (
              <TitleStat
                label="마지막 업데이트 시간"
                value={<RelativeTime at={stats.computedAt} />}
                numeric={false}
              />
            )}
          </TitleBox>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <StatBox name="서버 인구" bars={serverBars(stats)} />
            <FameBox bars={fameBars(stats)} />
            <StatBox name="직업 분포" bars={jobBars(stats)} />
            <StatBox name="직업별 평균 명성" bars={averageFameBars(stats)} tone="fame" />
          </div>
        </div>
      )
    }
  }
}

function StatBox({
  name,
  bars,
  tone
}: {
  name: string
  bars: readonly Bar[]
  tone?: BarTone
}): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name={name} />
  }

  return (
    <ListBox name={name}>
      <RowBars bars={bars} tone={tone} />
    </ListBox>
  )
}

function fameGroupsOf(bars: readonly FameBar[]): FameBar[][] {
  const coarse = bars.filter(({ fine }) => !fine)
  const fine = bars.filter(({ fine }) => fine)

  return [coarse, fine].filter((group) => group.length > 0)
}

function FameBox({ bars }: { bars: readonly FameBar[] }): React.JSX.Element {
  if (bars.length === 0) {
    return <ListBox name="명성 분포" />
  }

  return (
    <ListBox name="명성 분포" fillHeight>
      <Columns groups={fameGroupsOf(bars)} />
    </ListBox>
  )
}
