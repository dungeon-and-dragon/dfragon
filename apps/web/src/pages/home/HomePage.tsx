import { FameRankingBox } from './FameRankingBox'
import { HomeSearch } from './HomeSearch'

export function HomePage(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-start gap-x-20 gap-y-12 px-4 pt-18 pb-16 max-sm:pt-10">
      <HomeSearch />
      <FameRankingBox />
    </div>
  )
}
