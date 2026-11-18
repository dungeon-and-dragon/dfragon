import { z } from 'zod'
import type {
  ClearContentStats,
  ClearOverview,
  ClearStats
} from '../../../domain/content-clears/index.js'

export const weekQuery = z.object({ week: z.iso.date().optional() })

export type WeekQuery = z.infer<typeof weekQuery>

export type ClearStatsResponse = ClearStats

export type ClearOverviewResponse = ClearOverview

export type ClearContentStatsResponse = ClearContentStats
