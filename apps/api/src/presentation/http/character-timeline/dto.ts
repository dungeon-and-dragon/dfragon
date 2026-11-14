import type { TimelineItemCursor } from '@dfragon/database'
import type { Context } from 'hono'
import { z } from 'zod'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import {
  type CharacterIdentity,
  parseCharacterIdentity
} from '../../../domain/character-identity.js'
import {
  type CharacterTimeline,
  type TimelineItemPage,
  parseTimelineCursor
} from '../../../domain/character-timeline/project.js'

export const pageQuery = z.object({ before: z.string() }).strict()

export type PageQuery = z.infer<typeof pageQuery>

export type CharacterContext = Context<object, '/:serverId/:characterId/*'>

export type CharacterTimelineResponse = CharacterTimeline

export type TimelineItemPageResponse = TimelineItemPage

export function readIdentity(c: CharacterContext): CharacterIdentity {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}

export function parsePageCursor(query: unknown): TimelineItemCursor {
  const parsed = pageQuery.safeParse(query)
  const before = parsed.success ? parseTimelineCursor(parsed.data.before) : undefined

  if (before === undefined) {
    throw new CharacterDetailFailure('query')
  }

  return before
}
