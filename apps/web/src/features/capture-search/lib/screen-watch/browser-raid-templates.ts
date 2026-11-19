import type { DNFParticipantFrame } from '@dfragon/lib'
import raidHeadingUrl from '#features/capture-search/lib/capture/raid/raid-heading.png'
import equipmentScoreHeadingUrl from '#features/capture-search/lib/capture/raid/raid-value-heading-equipment-score.png'
import fameHeadingUrl from '#features/capture-search/lib/capture/raid/raid-value-heading-fame.png'
import valueGlyphsUrl from '#features/capture-search/lib/capture/raid/raid-value-glyphs.png'
import type { RaidWindowTemplates } from '#features/capture-search/lib/capture/raid/raid-window'
import { sliceRaidValueGlyphs } from '#features/capture-search/lib/capture/raid/raid-value-glyphs'
import { decodeBrowserPng } from '#features/capture-search/lib/browser-png'

let templates: Promise<RaidWindowTemplates> | null = null

async function fetchTemplate(url: string): Promise<DNFParticipantFrame> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('RAID_TEMPLATE_UNAVAILABLE')
  }

  return decodeBrowserPng(new Uint8Array(await response.arrayBuffer()))
}

async function loadTemplates(): Promise<RaidWindowTemplates> {
  const [heading, fame, equipmentScore, valueGlyphs] = await Promise.all([
    fetchTemplate(raidHeadingUrl),
    fetchTemplate(fameHeadingUrl),
    fetchTemplate(equipmentScoreHeadingUrl),
    fetchTemplate(valueGlyphsUrl)
  ])

  return {
    heading,
    valueHeadings: { fame, equipmentScore },
    valueGlyphs: sliceRaidValueGlyphs(valueGlyphs)
  }
}

export function readRaidWindowTemplates(): Promise<RaidWindowTemplates> {
  if (templates === null) {
    const loading = loadTemplates()
    templates = loading
    loading.catch(() => {
      templates = null
    })
  }

  return templates
}
