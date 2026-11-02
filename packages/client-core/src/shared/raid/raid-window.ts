import {
  classifyDNFRaidValueColumn,
  cropDNFRaidParticipantNicknames,
  readDNFRaidParticipantValues,
  type DNFParticipantFrame,
  type DNFRaidMetadataTemplates,
  type DNFRaidParticipantCropResult,
  type DNFRaidParticipantDetection,
  type DNFRaidValueColumnKind,
  type DNFRaidValueHeadingTemplates
} from '@dfragon/lib'

type FoundDetection = Extract<DNFRaidParticipantDetection, { status: 'found' }>

// 판독 기준은 함께 보관한 UI 0% 기준 이미지를 감마와 alpha 변환 없이 읽은 픽셀이다.
export type RaidWindowTemplates = Readonly<{
  heading: DNFParticipantFrame
  valueHeadings: DNFRaidValueHeadingTemplates
  valueGlyphs: DNFRaidMetadataTemplates['equipmentScoreGlyphs']
}>

// 수치 칸 판독은 FHD 이하 프레임에서만 검증했다. 더 큰 프레임은 수치를 읽지 않는다.
const VALUE_FRAME_LIMIT = { width: 1920, height: 1080 }

export function cropRaidWindowNicknames(
  frame: DNFParticipantFrame,
  templates: RaidWindowTemplates
): DNFRaidParticipantCropResult {
  return cropDNFRaidParticipantNicknames(frame, templates.heading)
}

export function readRaidWindowValues(
  frame: DNFParticipantFrame,
  detection: Pick<FoundDetection, 'valueHeadingRegion' | 'rows'>,
  templates: RaidWindowTemplates
): { valueColumn: DNFRaidValueColumnKind; valueTexts: (string | null)[] } {
  const valueColumn = classifyDNFRaidValueColumn(
    frame,
    detection.valueHeadingRegion,
    templates.valueHeadings
  )
  if (frame.width > VALUE_FRAME_LIMIT.width || frame.height > VALUE_FRAME_LIMIT.height) {
    const valueTexts = detection.rows.map(() => null)

    return { valueColumn, valueTexts }
  }
  const values = readDNFRaidParticipantValues(frame, detection.rows, templates.valueGlyphs)
  const valueTexts = values.map((value) => value.valueText)

  return { valueColumn, valueTexts }
}
