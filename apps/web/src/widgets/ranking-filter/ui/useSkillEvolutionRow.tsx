import { useQueryClient } from '@tanstack/react-query'
import { type SkillWindowCatalog, useSkillWindowCatalog } from '#entities/catalog'
import { RANKING_JOBS } from '#entities/character'
import {
  type FameRankingFilter,
  type SkillEvolutionChoice,
  type SkillEvolutionType,
  skillStatsQueryKey,
  useSkillStats
} from '#entities/ranking'
import type { FilterRow } from './RankingFilterBox'
import {
  type EvolutionSkill,
  SkillEvolutionFailure,
  SkillEvolutionGrid,
  SkillEvolutionSkeleton
} from './SkillEvolutionFilter'

const LABEL = '스킬 개화'
// 스킬 창 데이터를 받지 못하면 개화 이름 대신 쓴다.
const FALLBACK_NAMES: Readonly<Record<SkillEvolutionType, string>> = { 1: '개화 Ⅰ', 2: '개화 Ⅱ' }

function evolutionSkillsOf(
  names: readonly string[],
  catalog: SkillWindowCatalog | null
): EvolutionSkill[] {
  const skills = catalog !== null ? Object.values(catalog.job.skills) : []

  return names.map((name) => {
    const skill = skills.find((candidate) => candidate.name === name)
    const icon =
      catalog !== null && skill !== undefined
        ? { sprite: catalog.job.sprite, x: skill.icon.x, y: skill.icon.y }
        : null
    const branches = skill?.evolution
    const branchNames =
      branches !== undefined ? { 1: branches[0].name, 2: branches[1].name } : FALLBACK_NAMES

    return { name, icon, branchNames }
  })
}

function withEvolution(
  evolutions: readonly SkillEvolutionChoice[],
  name: string,
  type: SkillEvolutionType
): SkillEvolutionChoice[] {
  const others = evolutions.filter((choice) => choice.name !== name)
  const picked = evolutions.some((choice) => choice.name === name && choice.type === type)
  if (picked) {
    return others
  }

  return [...others, { name, type }]
}

export function useSkillEvolutionRow(
  filter: FameRankingFilter,
  onChange: (evolutions: readonly SkillEvolutionChoice[]) => void
): FilterRow | null {
  const { jobId = '', jobGrowId = '', role = null, evolutions = [] } = filter
  const jobName = RANKING_JOBS.find((job) => job.jobId === jobId)?.name ?? null
  const chosen = jobId !== '' && jobGrowId !== ''
  const job = { jobId, jobGrowId, role }
  const stats = useSkillStats(job, chosen)
  const catalogResult = useSkillWindowCatalog(chosen ? jobName : null)
  const queryClient = useQueryClient()

  if (!chosen) {
    return null
  }

  function retry(): void {
    queryClient.refetchQueries({ queryKey: skillStatsQueryKey(job) })
  }

  function pick(name: string, type: SkillEvolutionType): void {
    onChange(withEvolution(evolutions, name, type))
  }

  switch (stats.status) {
    case 'loading':
      return { label: LABEL, content: <SkillEvolutionSkeleton /> }
    case 'error':
      return { label: LABEL, content: <SkillEvolutionFailure onRetry={retry} /> }
    case 'success': {
      const names = stats.value.evolutions.map(({ name }) => name)

      if (names.length === 0) {
        return null
      }

      const catalog = catalogResult.status === 'success' ? catalogResult.value : null
      const skills = evolutionSkillsOf(names, catalog)
      const marks = catalog?.marks ?? null

      return {
        label: LABEL,
        content: (
          <SkillEvolutionGrid skills={skills} marks={marks} evolutions={evolutions} onPick={pick} />
        )
      }
    }
  }
}
