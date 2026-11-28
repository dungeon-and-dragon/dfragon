import type { Meta, StoryObj } from '@storybook/react-vite'
import { BoxPlotChart } from './BoxPlot'
import { Columns } from './Columns'
import { LineChart } from './LineChart'
import { RowBars } from './RowBars'
import { Sankey } from './Sankey'
import { SplitBar } from './SplitBar'

const meta = {
  title: 'Patterns/차트',
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full border border-line bg-canvas font-sans text-sm text-fg">
        <Story />
      </div>
    )
  ]
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const integer = new Intl.NumberFormat('ko-KR')

function formatCount(value: number): string {
  return integer.format(value)
}

function formatPercent(value: number): string {
  return `${value}%`
}

// 차트 2, 3, 4번 색 위의 이 글자색은 라이트, 다크 모두 4.5:1을 넘는다(가장 낮은 값은 다크 2번 색의 5.10:1).
const SEGMENT_TEXT = '#0a0a0b'

const JOBS = ['웨펀마스터', '버서커', '소울브링어', '아수라', '검귀', '레인저', '런처', '메카닉']

export const 가로막대: Story = {
  render: () => (
    <RowBars
      bars={JOBS.map((name, index) => {
        const value = 4200 - index * 430
        const share = (14 - index * 1.4).toFixed(1)

        return { key: name, name, value, share: `${share}%` }
      })}
      formatValue={formatCount}
    />
  )
}

export const 명성막대: Story = {
  render: () => (
    <RowBars
      tone="fame"
      bars={JOBS.slice(0, 5).map((name, index) => ({
        key: name,
        name,
        value: 128_400 - index * 1_850
      }))}
      formatValue={formatCount}
    />
  )
}

export const 세로막대: Story = {
  render: () => (
    <Columns
      groups={[
        Array.from({ length: 24 }, (_, index) => {
          const from = 100_000 + index * 2_000
          const count = Math.round(900 * Math.exp(-((index - 14) ** 2) / 30))
          const label = index % 4 === 0 ? `${from / 1000}k` : null
          const range = `${integer.format(from)}~${integer.format(from + 1_999)}`
          const ratio = count / 900

          return { key: `fame-${from}`, label, range, count, ratio }
        })
      ]}
      selectedKey="fame-128000"
    />
  )
}

const weeks = Array.from({ length: 8 }, (_, index) => ({
  key: `week-${index}`,
  title: `${index + 1}주차`,
  tick: `${index + 1}주차`
})).map((week, index) => (index % 2 === 0 ? week : { ...week, tick: null }))

export const 꺾은선: Story = {
  render: () => (
    <LineChart
      label="주간 클리어율"
      x={weeks}
      series={[
        {
          key: 'raid',
          name: '레이드',
          color: 'var(--color-chart-1)',
          values: [42, 48, 55, 61, 63, 70, 72, 75]
        },
        {
          key: 'legion',
          name: '레기온',
          color: 'var(--color-chart-2)',
          values: [80, 82, null, 85, 88, 87, 90, 91]
        },
        {
          key: 'base',
          name: '전체',
          color: 'var(--color-chart-base)',
          faded: true,
          values: [60, 62, 64, 66, 68, 70, 71, 73]
        }
      ]}
      formatTick={formatPercent}
      formatValue={formatPercent}
      selectedKey="week-5"
    />
  )
}

export const 나눈막대: Story = {
  render: () => (
    <div className="p-4">
      <SplitBar
        label="14주차"
        formatValue={formatCount}
        segments={[
          {
            key: 'both',
            name: '잔존',
            value: 760,
            color: 'var(--color-chart-3)',
            textColor: SEGMENT_TEXT
          },
          {
            key: 'return',
            name: '복귀',
            value: 120,
            color: 'var(--color-chart-2)',
            textColor: SEGMENT_TEXT
          },
          {
            key: 'first',
            name: '신규',
            value: 110,
            color: 'var(--color-chart-4)',
            textColor: SEGMENT_TEXT
          }
        ]}
      />
    </div>
  )
}

export const 상자그림: Story = {
  render: () => (
    <div className="p-4">
      <BoxPlotChart
        label="직업별 명성 분포"
        formatTick={formatCount}
        formatValue={formatCount}
        head={{ name: '전직', plot: '명성', value: '중앙값' }}
        rows={JOBS.slice(0, 5).map((name, index) => {
          const median = 120_000 - index * 2_400
          const value = formatCount(median)

          return {
            key: name,
            name,
            sub: '하드',
            color: `var(--color-chart-${index + 1})`,
            value,
            stats: {
              p5: median - 14_000,
              p25: median - 5_000,
              median,
              p75: median + 4_000,
              p95: median + 9_000,
              max: median + 15_000
            }
          }
        })}
      />
    </div>
  )
}

const STAGE_COLOR = 'var(--color-chart-base)'
const MOVE_COLOR = 'var(--color-chart-7)'
const RETURNED_COLOR = 'var(--color-chart-3)'
const FIRST_COLOR = 'var(--color-chart-1)'
const LEFT_COLOR = 'var(--color-chart-8)'

const moveFlow = (from: string, to: string, name: string, value: number, color: string) => ({
  key: `${from}-${to}`,
  name,
  from,
  to,
  value,
  color
})

export const 생키: Story = {
  render: () => (
    <Sankey
      label="지난주 대비 이동"
      sourceTitle="15주차"
      targetTitle="16주차"
      formatValue={formatCount}
      sources={[
        { key: 'hard', name: '하드', color: STAGE_COLOR },
        { key: 'normal', name: '일반', color: STAGE_COLOR, faded: true },
        { key: 'returned', name: '복귀', color: RETURNED_COLOR },
        { key: 'first', name: '신규', color: FIRST_COLOR }
      ]}
      targets={[
        { key: 'hard', name: '하드', color: STAGE_COLOR },
        { key: 'normal', name: '일반', color: STAGE_COLOR, faded: true },
        { key: 'left', name: '이탈', color: LEFT_COLOR }
      ]}
      flows={[
        moveFlow('hard', 'hard', '하드 → 하드', 43_696, STAGE_COLOR),
        moveFlow('hard', 'normal', '하드 → 일반', 3_708, MOVE_COLOR),
        moveFlow('hard', 'left', '하드 → 이탈', 7_272, LEFT_COLOR),
        moveFlow('normal', 'hard', '일반 → 하드', 3_627, MOVE_COLOR),
        moveFlow('normal', 'normal', '일반 → 일반', 68_087, STAGE_COLOR),
        moveFlow('normal', 'left', '일반 → 이탈', 22_657, LEFT_COLOR),
        moveFlow('returned', 'hard', '복귀 → 하드', 2_900, RETURNED_COLOR),
        moveFlow('returned', 'normal', '복귀 → 일반', 13_400, RETURNED_COLOR),
        moveFlow('first', 'hard', '신규 → 하드', 1_807, FIRST_COLOR),
        moveFlow('first', 'normal', '신규 → 일반', 2_946, FIRST_COLOR)
      ]}
    />
  )
}
