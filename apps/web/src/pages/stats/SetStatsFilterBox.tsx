import {
  SET_SAMPLE_MIN_FAME,
  SET_SAMPLE_TOP_COUNT,
  SET_SAMPLES,
  type SetSample
} from '@dfragon/lib'
import { ChipGroup, type ChipGroupItem } from '@dfragon/ui'
import type { FameRankingFilter, SetStatsFilter } from '#entities/ranking'
import { type FilterRow, RankingFilterBox } from '#widgets/ranking-filter'

const integer = new Intl.NumberFormat('ko-KR')
const SAMPLE_LABEL = '표본'
const SAMPLE_NAMES: Record<SetSample, string> = {
  top: `상위 ${SET_SAMPLE_TOP_COUNT}명`,
  fame: `명성 ${integer.format(SET_SAMPLE_MIN_FAME)} 이상`,
  all: '전체'
}
const SAMPLE_ITEMS: readonly ChipGroupItem<SetSample>[] = SET_SAMPLES.map((sample) => ({
  value: sample,
  label: SAMPLE_NAMES[sample]
}))

export function SetStatsFilterBox({
  filter,
  onFilterChange,
  growRequired = false
}: {
  filter: SetStatsFilter
  onFilterChange: (filter: SetStatsFilter) => void
  growRequired?: boolean
}): React.JSX.Element {
  // 직업, 전직을 바꿔도 고른 표본은 그대로 둔다.
  function changeJob({ jobId, jobGrowId, role }: FameRankingFilter): void {
    onFilterChange({ jobId, jobGrowId, role, sample: filter.sample })
  }

  function changeSample(sample: SetSample): void {
    const selected = sample === 'all' ? undefined : sample

    onFilterChange({ ...filter, sample: selected })
  }

  const rows: readonly FilterRow[] = [
    {
      label: SAMPLE_LABEL,
      content: (
        <ChipGroup
          aria-label={SAMPLE_LABEL}
          items={SAMPLE_ITEMS}
          value={filter.sample ?? 'all'}
          onValueChange={changeSample}
        />
      )
    }
  ]

  return (
    <RankingFilterBox
      filter={filter}
      onChange={changeJob}
      rows={rows}
      growRequired={growRequired}
    />
  )
}
