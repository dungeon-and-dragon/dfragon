import type { FetchCharacterTimeline } from '../character-timeline/ports.js'

export type CreateClearTimeline = (onRequest: () => void) => FetchCharacterTimeline

export type ClearCollectionPorts = {
  createFetchTimeline: CreateClearTimeline
  readConcurrency: () => number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}
