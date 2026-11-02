import type { DNFParticipantFrame } from '@dfragon/lib'
import raidHeadingUrl from '@dfragon/client-core/shared/raid/raid-heading.png'
import equipmentScoreHeadingUrl from '@dfragon/client-core/shared/raid/raid-value-heading-equipment-score.png'
import fameHeadingUrl from '@dfragon/client-core/shared/raid/raid-value-heading-fame.png'
import valueGlyphsUrl from '@dfragon/client-core/shared/raid/raid-value-glyphs.png'
import { sliceRaidValueGlyphs } from '@dfragon/client-core/shared/raid/raid-value-glyphs'
import type { RaidWindowTemplates } from '@dfragon/client-core/shared/raid/raid-window'
import { decodeBrowserPng } from './browser-png'

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
