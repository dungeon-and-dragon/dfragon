import assert from 'node:assert/strict'
import test from 'node:test'
import type { NeopleCharacterBasic } from '@dfragon/neople'
import type { WorkerNeople } from '../src/infrastructure/neople/character-collection.js'
import { pacePrioritizedNeopleRequests } from '../src/infrastructure/neople/request-priority.js'

const identity = { serverId: 'cain', characterId: 'synthetic-character' }

const basic: NeopleCharacterBasic = {
  serverId: 'cain',
  characterId: 'synthetic-character',
  characterName: '합성',
  adventureName: '모험단',
  level: 115,
  jobId: 'job',
  jobGrowId: 'grow',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  fame: 60_000,
  guildId: null,
  guildName: null
}

const unexpected = async (): Promise<never> => {
  throw new Error('이 테스트는 기본 정보만 부른다')
}

// 기본 정보 요청이 나간 순서만 적는 가짜 client다.
function recordingNeople(name: string, sent: string[]): WorkerNeople {
  return {
    character: unexpected,
    characterBasic: async ({ characterId }) => {
      sent.push(`${name}:${characterId}`)

      return basic
    },
    characterSkillStyle: unexpected,
    characterTimeline: unexpected,
    charactersFame: unexpected,
    jobs: unexpected,
    multiItems: unexpected,
    auction: unexpected,
    searchItems: unexpected,
    servers: unexpected
  }
}

test('속도 제한에서 기다리는 수집과 배치 job의 호출보다 나중에 온 동기화 호출이 먼저 나간다', async () => {
  const sent: string[] = []
  const { neople, priorityNeople } = pacePrioritizedNeopleRequests(
    { neople: recordingNeople('batch', sent), priorityNeople: recordingNeople('sync', sent) },
    50
  )
  const call = (target: WorkerNeople, characterId: string) =>
    target.characterBasic({ ...identity, characterId })

  await Promise.all([
    call(neople, 'first'),
    call(neople, 'waiting-a'),
    call(neople, 'waiting-b'),
    call(priorityNeople, 'late'),
    call(neople, 'waiting-c')
  ])

  assert.deepEqual(sent, [
    'batch:first',
    'sync:late',
    'batch:waiting-a',
    'batch:waiting-b',
    'batch:waiting-c'
  ])
})
