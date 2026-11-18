import { FameRankingBox } from './FameRankingBox'
import { HomeSearch } from './HomeSearch'

export function HomePage(): React.JSX.Element {
  return (
    <div className="section flex flex-wrap items-start gap-x-16 gap-y-12 px-4 pt-16 pb-16 max-sm:pt-12">
      <HomeSearch />
      <FameRankingBox />
    </div>
  )
}
