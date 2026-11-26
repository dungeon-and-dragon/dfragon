import PQueue from 'p-queue'
import type { WorkerNeople } from './character-collection.js'

const PRIORITY = 1
const NORMAL = 0

export type NeopleDispatch = <Result>(
  request: (neople: WorkerNeople) => Promise<Result>
) => Promise<Result>

// 타임라인 동기화는 priorityNeople로 부르고, 기다리는 수집과 배치 job의 호출보다 먼저 나간다(ADR 0091).
export type PrioritizedNeople = {
  neople: WorkerNeople
  priorityNeople: WorkerNeople
}

export function dispatchNeople(dispatch: NeopleDispatch): WorkerNeople {
  return {
    auction: (query) => dispatch((neople) => neople.auction(query)),
    character: (identity, section, signal) =>
      dispatch((neople) => neople.character(identity, section, signal)),
    characterBasic: (identity) => dispatch((neople) => neople.characterBasic(identity)),
    characterSkillStyle: (identity) => dispatch((neople) => neople.characterSkillStyle(identity)),
    characterTimeline: (identity, query) =>
      dispatch((neople) => neople.characterTimeline(identity, query)),
    charactersFame: (serverId, query) =>
      dispatch((neople) => neople.charactersFame(serverId, query)),
    jobs: () => dispatch((neople) => neople.jobs()),
    multiItems: (itemIds, signal) => dispatch((neople) => neople.multiItems(itemIds, signal)),
    searchItems: (query) => dispatch((neople) => neople.searchItems(query)),
    servers: () => dispatch((neople) => neople.servers())
  }
}

// worker 전체와 key 하나의 요청 속도 상한이다. 같은 우선순위의 호출은 부른 순서대로 나가 한쪽 일이 계속 밀리지 않는다.
// p-throttle은 부를 때 나갈 시각을 정해 두어 늦게 온 호출을 앞으로 보낼 수 없어, 나갈 때 순서를 정하는 p-queue를 쓴다.
export function pacePrioritizedNeopleRequests(
  { neople, priorityNeople }: PrioritizedNeople,
  requestsPerSecond: number
): PrioritizedNeople {
  const queue = new PQueue({ interval: 1000 / requestsPerSecond, intervalCap: 1 })
  const pace = (target: WorkerNeople, priority: number) =>
    dispatchNeople((request) => queue.add(() => request(target), { priority }))

  const pacedNeople = pace(neople, NORMAL)
  const pacedPriorityNeople = pace(priorityNeople, PRIORITY)

  return { neople: pacedNeople, priorityNeople: pacedPriorityNeople }
}
