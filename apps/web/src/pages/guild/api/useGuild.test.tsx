// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Guild } from '#entities/adventure-guild'
import type { StoredCharacter } from '#entities/ranking'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { GUILD_URL } from './guild.handlers'
import { useGuild } from './useGuild'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<Guild>
let requestedPaths: string[]

function Harness({ guildId }: { guildId: string }): null {
  const value = useGuild(guildId)
  useEffect(() => {
    result = value
  })

  return null
}

beforeEach(() => {
  result = { status: 'loading' }
  requestedPaths = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function respond(body: JsonBodyType, status = 200): void {
  server.use(
    http.get(GUILD_URL, ({ request }) => {
      requestedPaths.push(new URL(request.url).pathname)

      return HttpResponse.json(body, { status })
    })
  )
}

const character: StoredCharacter = {
  serverId: 'cain',
  characterId: 'character-1',
  characterName: '합성 캐릭터',
  adventureName: '합성 모험단',
  level: 115,
  jobId: 'job-1',
  jobGrowId: 'grow-1',
  jobName: '합성 직업',
  jobGrowName: '眞 합성 전직',
  fame: 80123,
  guildId: 'guild-1',
  guildName: '합성 길드',
  role: null,
  score: null
}

const guild: Guild = {
  guildId: 'guild-1',
  guildName: '합성 길드',
  memberCount: 1,
  members: [character]
}

async function settle(guildId: string): Promise<LoadedResult<Guild>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness guildId={guildId} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

it('길드 id를 경로에 encode해 보내고 응답을 그대로 읽는다', async () => {
  respond(guild)

  await expect(settle('길드/1')).resolves.toEqual({ status: 'success', value: guild })
  expect(requestedPaths).toEqual([`/api/guilds/${encodeURIComponent('길드/1')}`])
})

it('길드원이 없는 길드도 읽는다', async () => {
  const empty: Guild = { ...guild, guildName: null, memberCount: 0, members: [] }
  respond(empty)

  await expect(settle('guild-1')).resolves.toEqual({ status: 'success', value: empty })
})

it('모르는 서버의 길드원이 있으면 응답을 확인하지 못했다고 알린다', async () => {
  respond({ ...guild, members: [{ ...character, serverId: 'unknown' }] })

  await expect(settle('guild-1')).resolves.toEqual({
    status: 'error',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  })
})

it('오류 응답은 API가 보낸 문구로 알린다', async () => {
  respond({ error: { code: 'INTERNAL_SERVER_ERROR', message: '길드를 받지 못했습니다.' } }, 500)

  await expect(settle('guild-1')).resolves.toEqual({
    status: 'error',
    message: '길드를 받지 못했습니다.'
  })
})
