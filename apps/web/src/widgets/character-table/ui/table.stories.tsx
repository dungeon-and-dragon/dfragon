import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'
import { CharacterTable, SkeletonRow } from './CharacterTable'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'

const meta = {
  title: 'Patterns/표',
  decorators: [
    (Story) => (
      <StoryFrame>
        <StoryScreen>
          <Story />
        </StoryScreen>
      </StoryFrame>
    )
  ]
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const rows = storyRankedCharacters(10)

export const 캐릭터표: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable rows={rows} scorePlacement="column" />
    </ListBox>
  )
}

export const 명성아래점수: Story = {
  render: () => (
    <div className="w-[400px] max-w-full">
      <ListBox name="명성 랭킹">
        <CharacterTable rows={rows.slice(3, 6)} scorePlacement="belowFame" affiliations={[]} />
      </ListBox>
    </div>
  )
}

export const 순위없음: Story = {
  render: () => (
    <ListBox name="길드원">
      <CharacterTable rows={rows.slice(0, 5)} ranked={false} affiliations={['adventure']} />
    </ListBox>
  )
}

export const 받는중: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable
        rows={[]}
        scorePlacement="column"
        trailing={Array.from({ length: 5 }, (_, index) => (
          <SkeletonRow key={index} scorePlacement="column" />
        ))}
      />
    </ListBox>
  )
}

export const 제목상자: Story = {
  render: () => (
    <TitleBox title="길드1">
      <TitleStat label="길드원" value="48" />
      <TitleStat label="평균 명성" value="128,512" />
    </TitleBox>
  )
}

const longNameRows = [
  { ...rows[0]!, characterName: '캐릭터이름이아주길어서칸을넘기는경우'.repeat(3) },
  ...rows.slice(1, 4)
]

export const 말줄임: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable rows={longNameRows} />
    </ListBox>
  )
}

// 이름은 게임의 12바이트 제한에서 가장 넓은 한글 6자와 영문 12자, 순위는 cursor로 끝까지 넘긴 여섯 자리까지 둔다.
const widestRows = [
  { ...rows[0]!, rank: 1 },
  {
    ...rows[1]!,
    rank: 100,
    characterName: '뛟뛟뛟뛟뛟뛟',
    adventureName: '뛟뛟뛟뛟뛟뛟',
    guildName: '뛟뛟뛟뛟뛟뛟'
  },
  {
    ...rows[2]!,
    rank: 123_456,
    characterName: 'WWWWWWWWWWWW',
    adventureName: 'WWWWWWWWWWWW',
    guildName: 'WWWWWWWWWWWW'
  }
]

export const 열폭: Story = {
  render: () => (
    <ListBox name="명성 랭킹">
      <CharacterTable rows={widestRows} />
    </ListBox>
  )
}

export const 좁은폭열폭: Story = {
  render: () => (
    <div className="w-[390px] max-w-full">
      <ListBox name="명성 랭킹">
        <CharacterTable rows={widestRows} affiliations={[]} />
      </ListBox>
    </div>
  )
}

const ITEMS = [
  [
    '머리 아바타',
    '레어 머리 아바타',
    '시전 속도 14% 증가',
    '찬란한 붉은빛 엠블렘[힘], 빛나는 붉은빛 엠블렘[힘]'
  ],
  [
    '상의 아바타',
    '레어 상의 아바타',
    '힘 55 증가',
    '찬란한 푸른빛 엠블렘[이동속도], 화려한 녹색빛 엠블렘[물리크리티컬]'
  ],
  ['무기 아바타', '레어 무기 아바타', '-', '플래티넘 엠블렘[센세이션]']
] as const

function ItemTable({ wrap, selected }: { wrap: boolean; selected?: number }): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className={`table min-w-[800px]${wrap ? ' table-wrap' : ''}`}>
        <thead>
          <tr>
            <th scope="col" className="w-[96px]">
              부위
            </th>
            <th scope="col">아바타</th>
            <th scope="col" className="w-[200px]">
              옵션
            </th>
            <th scope="col" className="w-[240px]">
              엠블렘
            </th>
            <th scope="col" className="table-num w-[96px]">
              포인트
            </th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map(([slot, name, option, emblem], index) => (
            <tr key={slot} aria-selected={index === selected || undefined}>
              <td className="text-xs text-fg-subtle">{slot}</td>
              <td className="font-semibold text-rarity-rare">{name}</td>
              <td className="text-fg-muted">{option}</td>
              <td>{emblem}</td>
              <td className="table-num">{(index + 1) * 120}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// hover한 행과 고른 행은 같은 면 색이라 고른 행으로 둘 다 보인다.
export const hover와선택: Story = {
  render: () => (
    <ListBox name="아바타">
      <ItemTable wrap={false} selected={1} />
    </ListBox>
  )
}

export const 줄바꿈: Story = {
  render: () => (
    <ListBox name="아바타">
      <ItemTable wrap />
    </ListBox>
  )
}

export const 좁은폭가로스크롤: Story = {
  render: () => (
    <div className="w-[390px] max-w-full">
      <ListBox name="명성 랭킹">
        <CharacterTable rows={rows.slice(0, 4)} />
      </ListBox>
    </div>
  )
}
