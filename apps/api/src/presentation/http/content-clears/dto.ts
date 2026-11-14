import { z } from 'zod'
import type { ClearContentStats } from '../../../domain/content-clears/detail.js'
import type { ClearOverview } from '../../../domain/content-clears/overview.js'
import type { ClearStats } from '../../../domain/content-clears/stats.js'

export const weekQuery = z.object({ week: z.iso.date().optional() })

export type WeekQuery = z.infer<typeof weekQuery>

export type ClearStatsResponse = ClearStats

export type ClearOverviewResponse = ClearOverview

export type ClearContentStatsResponse = ClearContentStats
