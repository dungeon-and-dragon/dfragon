import {
  validateDFNickname,
  detectDNFRaidParticipantWindow,
  cropDNFRaidParticipantNicknames,
  readDNFRaidParticipantMetadata,
  readDNFRaidParticipantValues,
  classifyDNFRaidValueColumn,
  parseDNFRaidValueNotation,
  parseServerBuildInfo,
  matchesDNFSearchNicknamePolicy,
  DNF_SEARCH_NICKNAME_LIMITS,
  type NicknameValidationResult,
  type DFNicknameValidationOptions,
  type DNFRectangle,
  type DNFParticipantFrame,
  type DNFRaidParticipantPosition,
  type DNFRaidParticipantRow,
  type DNFRaidParticipantDetection,
  type DNFRaidParticipantCropResult,
  type DNFRaidParty,
  type DNFRaidScoreGlyph,
  type DNFRaidParticipantValue,
  type DNFRaidMetadataTemplates,
  type DNFRaidParticipantMetadata,
  type DNFRaidValueColumnKind,
  type DNFRaidValueHeadingTemplates,
  type DNFRaidValueNotation,
  type ServerBuildInfo,
  type ServerService
} from '@dfragon/lib'
import {
  chooseEnchantGrade,
  displayStatusOf,
  enchantOptionsOf,
  findEnchantOption,
  optionNeedsMainStat,
  type EnchantDisplayStatus,
  type EnchantGrade,
  type EnchantGradeOption,
  type EnchantGradeRole,
  type EnchantGradeSlot,
  type EnchantMainStat
} from '@dfragon/lib/enchant-grades'
import {
  equipmentSets,
  equipmentVariantsOf,
  findEquipmentVariant,
  findOathCrystal,
  findOathCrystalVariant,
  findOathVariant,
  moveOathCrystalToSet,
  oathCrystalVariantsOf,
  oathSets,
  oathVariantOf,
  oathVariantsOf,
  PRIMEVAL_OATH_CRYSTAL_LIMIT,
  resolveEquipmentItems,
  switchEquipmentSet,
  weaponMaxTuneLevelOf,
  type EquipmentSet,
  type EquipmentSetSelection,
  type OathCrystalVariant,
  type OathCrystalVariantMatch,
  type OathSet,
  type OathVariant,
  type OathVariantMatch,
  type EquipmentVariant,
  type EquipmentVariantItems,
  type EquipmentVariantMatch,
  type EquipmentVariantSlot,
  type OathCrystal
} from '@dfragon/lib/equipment-variants'
import {
  findSlotItem,
  slotItemsOf,
  type SlotItem,
  type SlotItemCategory
} from '@dfragon/lib/slot-items'
import manifest from '@dfragon/lib/package.json' with { type: 'json' }

export const packageName: string = manifest.name

export function nicknameMessage(
  nickname: string,
  options: DFNicknameValidationOptions
): string | null {
  const result: NicknameValidationResult = validateDFNickname(nickname, options)
  if (result.isValid) {
    return null
  }

  return result.reason
}

export function searchInput(nickname: string) {
  const allowed = matchesDNFSearchNicknamePolicy(nickname)
  const minimum = DNF_SEARCH_NICKNAME_LIMITS.minimumCodePoints
  const maximum = DNF_SEARCH_NICKNAME_LIMITS.maximumCodePoints

  return { nickname, allowed, minimum, maximum }
}

// 값을 쓰지 않고 타입 검사에서 속성 접근만 확인하려고 인자로 받는다.
function readOnlyForTypeCheck(_value: unknown): void {}

export function raidRows(frame: DNFParticipantFrame, heading: DNFParticipantFrame) {
  const detection: DNFRaidParticipantDetection = detectDNFRaidParticipantWindow(frame, heading)
  const result: DNFRaidParticipantCropResult = cropDNFRaidParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    // @ts-expect-error 실패 결과에서 닉네임 크롭 행을 읽을 수 없어야 한다.
    readOnlyForTypeCheck(result.rows)

    return []
  }
  const rows: DNFRaidParticipantRow[] = result.rows
  const samples = result.rows.map((row) => {
    const position: DNFRaidParticipantPosition = row.row
    const crop: DNFParticipantFrame | null = row.nicknameCrop

    return { position, crop }
  })

  return { detection, rows, samples }
}

export function readRaidLabels(
  frame: DNFParticipantFrame,
  rows: readonly DNFRaidParticipantRow[],
  party: DNFRaidParty,
  glyph: DNFRaidScoreGlyph,
  partyImage: DNFParticipantFrame,
  glyphImage: DNFParticipantFrame
) {
  const templates: DNFRaidMetadataTemplates = {
    parties: [{ party, image: partyImage }],
    equipmentScoreGlyphs: [{ character: glyph, image: glyphImage }]
  }
  const labels: DNFRaidParticipantMetadata[] = readDNFRaidParticipantMetadata(
    frame,
    rows,
    templates
  )

  return labels.map((label) => {
    const row: DNFRaidParticipantPosition = label.row
    const party: DNFRaidParty | null = label.party
    const equipmentScoreText: string | null = label.equipmentScoreText

    return { row, party, equipmentScoreText }
  })
}

export function readRaidValues(
  frame: DNFParticipantFrame,
  rows: readonly DNFRaidParticipantRow[],
  glyph: DNFRaidScoreGlyph,
  glyphImage: DNFParticipantFrame
): (string | null)[] {
  const values: DNFRaidParticipantValue[] = readDNFRaidParticipantValues(frame, rows, [
    { character: glyph, image: glyphImage }
  ])

  return values.map((value) => value.valueText)
}

export function readRaidValueColumn(
  frame: DNFParticipantFrame,
  region: DNFRectangle,
  row: DNFRaidParticipantRow,
  templates: DNFRaidValueHeadingTemplates,
  text: string
) {
  const kind: DNFRaidValueColumnKind = classifyDNFRaidValueColumn(frame, region, templates)
  const notation: DNFRaidValueNotation | null = parseDNFRaidValueNotation(text)
  const jobRegion: DNFRectangle = row.jobRegion

  return { kind, notation, jobRegion }
}

export function versionResponse(value: unknown, service: ServerService): ServerBuildInfo | null {
  return parseServerBuildInfo(value, service)
}

export function enchantCards(
  slotId: EnchantGradeSlot,
  role: EnchantGradeRole,
  id: string,
  mainStat: EnchantMainStat | null
) {
  const finals: readonly EnchantGradeOption[] = enchantOptionsOf(slotId, role).종결
  const found: EnchantGradeOption | null = findEnchantOption(slotId, role, id)
  const labels = finals.map((option) => option.display)

  if (found === null) {
    return { labels, needsMainStat: false, display: [] }
  }

  const needsMainStat = optionNeedsMainStat(found)
  const chosen: EnchantGrade = chooseEnchantGrade(found, mainStat)
  const display: readonly EnchantDisplayStatus[] = displayStatusOf(chosen)

  return { labels, needsMainStat, display }
}

export function slotItemNames(category: SlotItemCategory, id: string) {
  const items: readonly SlotItem[] = slotItemsOf(category)
  const names = items.map((slotItem) => slotItem.name)
  const found: SlotItem | null = findSlotItem(category, id)

  if (found === null) {
    return { names, itemId: null }
  }

  return { names, itemId: found.item.itemId }
}

export function equipmentVariantItems(
  setItemId: string,
  slotId: EquipmentVariantSlot,
  itemId: string
) {
  const variants: readonly EquipmentVariant[] = equipmentVariantsOf(setItemId, slotId)
  const match: EquipmentVariantMatch | null = findEquipmentVariant(itemId)
  const items: EquipmentVariantItems = resolveEquipmentItems({ [slotId]: variants[0] })
  const crystal: OathCrystal | null = findOathCrystal('미광의 서약 결정')

  if (match === null || crystal === null) {
    return null
  }

  return { setItemId: match.setItemId, items, tuneSetPoints: crystal.tuneSetPoints }
}

export function equipmentSetOathChoices(setItemId: string, oathItemId: string, setId: number) {
  const sets: readonly EquipmentSet[] = equipmentSets()
  const switched: EquipmentSetSelection = switchEquipmentSet({ JACKET: null }, setItemId)
  const oathSetList: readonly OathSet[] = oathSets()
  const oath: OathVariantMatch | null = findOathVariant(oathItemId)
  const oaths: readonly OathVariant[] = oathVariantsOf(setId)
  const primeval: OathVariant | null = oathVariantOf(null, '태초')
  const crystal: OathCrystalVariantMatch | null = findOathCrystalVariant(oathItemId)
  const crystals: readonly OathCrystalVariant[] = oathCrystalVariantsOf(setId)
  const moved: OathCrystalVariant | null = moveOathCrystalToSet(oathItemId, setId)
  const weaponMaxTuneLevel: number = weaponMaxTuneLevelOf('넨 스텔라')
  const primevalCrystalLimit: number = PRIMEVAL_OATH_CRYSTAL_LIMIT

  return {
    sets,
    switched,
    oathSetList,
    oath,
    oaths,
    primeval,
    crystal,
    crystals,
    moved,
    weaponMaxTuneLevel,
    primevalCrystalLimit
  }
}
