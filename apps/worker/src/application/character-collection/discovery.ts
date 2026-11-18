import { z } from 'zod'
import { fameWindowBelow, nextMaxFame } from '#domain/character-collection/index.js'
import { defineJob } from '#application/jobs/index.js'
import type { CharacterDiscoveryPorts, FameSearchTarget } from './ports.js'
import type { CollectionRepository } from './repository.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

// 서버 8개와 1차 전직 71개의 조합 568개마다 최고 명성 136,927에서 0까지 구간 69개를 부르면 빈 구간만 약 3.9만 요청이다(2026-11-18 실제 응답).
// key 하나의 기본 속도(초당 5건)로 약 2시간 10분이고, 다른 수집과 Neople 요청을 나눠 보내므로 두 배 넘게 둔다.
const DELAY_MINUTES = 6 * 60

export type CharacterDiscoverySummary = {
  targets: number
  skipped: number
  listed: number
}

type TargetSweep = {
  listed: number
  skipped: boolean
}

export class CharacterDiscoveryService {
  constructor(
    private readonly repository: Pick<CollectionRepository, 'enqueue'>,
    private readonly ports: CharacterDiscoveryPorts
  ) {}

  /** 찾은 캐릭터는 새 캐릭터 대기열에만 넣고, 기본 정보는 대기열을 비우는 쪽이 받는다. */
  async discover(
    reportProgress: (done: number, total: number) => void
  ): Promise<CharacterDiscoverySummary> {
    const { readTargets, readTopFame, readConcurrency } = this.ports
    const targets = await readTargets()
    const topFame = await readTopFame()
    const counts = { skipped: 0, listed: 0 }
    let done = 0

    reportProgress(0, targets.length)

    while (done < targets.length) {
      const group = targets.slice(done, done + readConcurrency())
      const sweeps = await Promise.all(group.map((target) => this.sweepTarget(target, topFame)))

      for (const sweep of sweeps) {
        counts.listed += sweep.listed

        if (sweep.skipped) {
          counts.skipped++
        }
      }

      done += group.length
      reportProgress(done, targets.length)
    }

    return { targets: targets.length, ...counts }
  }

  private async sweepTarget(target: FameSearchTarget, topFame: number): Promise<TargetSweep> {
    const { fetchFamePage, pause, report } = this.ports
    let listed = 0
    let maxFame: number | undefined = topFame

    while (maxFame !== undefined) {
      const window = fameWindowBelow(maxFame)
      const page = await fetchFamePage(target, window)

      // 한도 초과, 점검, timeout은 이 조합의 문제가 아니라 쉬었다가 같은 구간을 다시 부른다.
      if (page.status === 'unavailable') {
        report('CHARACTER_DISCOVERY_NEOPLE_UNAVAILABLE', { ...target, maxFame })
        await pause(UNAVAILABLE_PAUSE_MS)
        continue
      }

      if (page.status === 'failed') {
        report('CHARACTER_DISCOVERY_TARGET_SKIPPED', { ...target, maxFame })

        return { listed, skipped: true }
      }

      const { characters } = page

      if (characters.length > 0) {
        await this.repository.enqueue(
          characters.map(({ characterId }) => ({ serverId: target.serverId, characterId }))
        )
      }

      listed += characters.length
      maxFame = nextMaxFame(
        window,
        characters.map(({ fame }) => fame)
      )
    }

    return { listed, skipped: false }
  }
}

export function createCharacterDiscoveryJob(service: CharacterDiscoveryService) {
  return defineJob({
    name: 'character-discovery',
    displayName: '새 캐릭터 찾기',
    description:
      'Neople 명성 검색으로 최근 90일 안에 접속한 110레벨 이상 캐릭터를 서버와 전직마다 훑어, 기본 정보를 저장하지 않은 캐릭터를 새 캐릭터 대기열에 넣습니다. 다른 수집과 Neople 요청 속도 상한을 나눠 씁니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) => service.discover(reportProgress)
  })
}
