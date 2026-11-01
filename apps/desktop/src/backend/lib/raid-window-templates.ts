/// <reference types="electron-vite/node" />
// Renderer 통합 테스트가 캡처 IPC를 함께 검사해 web 타입 검사에도 `?asset` 선언이 필요하다.
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import type { DNFParticipantFrame } from '@dfragon/lib'
import raidHeadingPath from '../../shared/raid/raid-heading.png?asset'
import fameHeadingPath from '../../shared/raid/raid-value-heading-fame.png?asset'
import equipmentScoreHeadingPath from '../../shared/raid/raid-value-heading-equipment-score.png?asset'
import valueGlyphsPath from '../../shared/raid/raid-value-glyphs.png?asset'
import { sliceRaidValueGlyphs } from '../../shared/raid/raid-value-glyphs'
import type { RaidWindowTemplates } from '../../shared/raid/raid-window'

let templates: RaidWindowTemplates | null = null

function readReference(path: string): DNFParticipantFrame {
  const { width, height, data } = PNG.sync.read(readFileSync(path))

  return { width, height, rgba: data }
}

export function readRaidWindowTemplates(): RaidWindowTemplates {
  templates ??= {
    heading: readReference(raidHeadingPath),
    valueHeadings: {
      fame: readReference(fameHeadingPath),
      equipmentScore: readReference(equipmentScoreHeadingPath)
    },
    valueGlyphs: sliceRaidValueGlyphs(readReference(valueGlyphsPath))
  }

  return templates
}
