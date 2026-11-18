import type { Meta, StoryObj } from '@storybook/react-vite'
import { BoxPlotChart } from './BoxPlot'
import { Columns } from './Columns'
import { LineChart } from './LineChart'
import { RowBars } from './RowBars'
import { SplitBar } from './SplitBar'

const meta = {
  title: 'Patterns/차트',
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full rounded-panel border border-line bg-canvas font-sans text-sm text-fg">
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

        return { key: name, name, sub: '귀검사(남)', value, share: `${share}%` }
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
            name: '두 주 모두 클리어',
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
            name: '첫 클리어',
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
            sub: '귀검사(남)',
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
