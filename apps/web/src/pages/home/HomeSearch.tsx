import { CharacterSearchBox } from '#widgets/global-bar'

export function HomeSearch(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-[999_1_520px] items-start">
      <CharacterSearchBox size="large" />
    </div>
  )
}
