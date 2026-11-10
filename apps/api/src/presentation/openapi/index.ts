import type { SchemaObject } from '@nestjs/swagger'
import { commonSchemas } from './common.js'
import { characterSearchSchemas } from './character-search.js'
import { characterDetailsSchemas } from './character-details.js'
import { characterTimelineSchemas } from './character-timeline.js'
import { adventureGuildSchemas } from './adventure-guild.js'
import { rankingStatsSchemas } from './ranking-stats.js'
import { contentClearsSchemas } from './content-clears.js'
import { todayGradeSchemas } from './today-grade.js'

const schemaGroups = [
  commonSchemas,
  characterSearchSchemas,
  characterDetailsSchemas,
  characterTimelineSchemas,
  adventureGuildSchemas,
  rankingStatsSchemas,
  contentClearsSchemas,
  todayGradeSchemas
]

export const apiSchemas: Record<string, SchemaObject> = Object.assign({}, ...schemaGroups)
