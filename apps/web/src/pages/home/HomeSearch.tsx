import { CharacterSearchBox } from '#components/CharacterSearchBox'

export function HomeSearch(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-[999_1_520px] items-start">
      <CharacterSearchBox size="large" />
    </div>
  )
}
