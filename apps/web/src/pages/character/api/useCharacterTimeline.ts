import { useCallback } from 'react'
import {
  type CharacterDetailView,
  type CharacterIdentity,
  type CharacterTimeline,
  characterTimelineSchema,
  type TimelineAcquisition,
  type TimelineEnhancement,
  timelineAcquisitionPageSchema,
  timelineEnhancementPageSchema
} from '#entities/character'
import { requestCharacterJson } from '#entities/character-detail'
import { useLoadedResult } from '#shared/lib/useLoadedResult'
import { type TimelinePages, useTimelinePages } from '#pages/character/hooks/useTimelinePages'

export type CharacterTimelineResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; timeline: CharacterTimeline }>
  | Readonly<{ status: 'error'; message: string }>

export function useCharacterTimeline(detail: CharacterDetailView): CharacterTimelineResult {
  const { serverId, characterId } = detail.character
  const result = useLoadedResult(['character', serverId, characterId, 'timeline'], () =>
    requestCharacterJson({ serverId, characterId }, '/timeline', characterTimelineSchema)
  )
  if (result.status !== 'success') {
    return result
  }

  return { status: 'success', timeline: result.value }
}

export function useTimelineEnhancements(
  { serverId, characterId }: CharacterIdentity,
  timeline: CharacterTimeline
): TimelinePages<TimelineEnhancement> {
  const fetchPage = useCallback(
    (before: string) =>
      requestCharacterJson(
        { serverId, characterId },
        '/timeline/enhancements',
        timelineEnhancementPageSchema,
        { searchParams: { before } }
      ),
    [serverId, characterId]
  )

  return useTimelinePages(timeline.enhancements, timeline.enhancementsCursor, fetchPage)
}

export function useTimelineAcquisitions(
  { serverId, characterId }: CharacterIdentity,
  timeline: CharacterTimeline
): TimelinePages<TimelineAcquisition> {
  const fetchPage = useCallback(
    (before: string) =>
      requestCharacterJson(
        { serverId, characterId },
        '/timeline/acquisitions',
        timelineAcquisitionPageSchema,
        { searchParams: { before } }
      ),
    [serverId, characterId]
  )

  return useTimelinePages(timeline.acquisitions, timeline.acquisitionsCursor, fetchPage)
}
