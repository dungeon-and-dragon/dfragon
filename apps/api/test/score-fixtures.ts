import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mapCharacterItems } from '../src/characters/catalog/items.js'
import {
  type CatalogDetail,
  isCatalogId,
  unavailableDetail
} from '../src/characters/catalog/types.js'
import { projectCharacterDetails } from '../src/characters/details/project.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'
import { type ScoreEngineInput, toScoreEngineInput } from '../src/score/input.js'

const SCORE_LIBRARY_FILE_NAMES: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  win32: 'dnfscore.dll',
  darwin: 'libdnfscore.dylib',
  linux: 'libdnfscore.so'
}

/**
 * 비공개 엔진 저장소의 golden 벡터 입력(가명 처리한 딜러 1명, 버퍼 1명)이다. Desktop 점수 테스트와 같은 파일이다.
 */
export function readEngineInput(name: 'dealer-blade' | 'buffer-muse'): ScoreEngineInput {
  const url = new URL(`../../test/fixtures/score-${name}.engine-input.json`, import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as ScoreEngineInput
}

/** 엔진 입력의 각 문서는 Neople 섹션 응답 원문이므로 그대로 상세 조회 결과로 되돌린다. */
export function payloadsFromEngineInput(input: ScoreEngineInput): CharacterPayloads {
  const { status: _stats, buff: _buff, ...basic } = input.status

  return {
    basic,
    status: input.status,
    equipment: input.equipment,
    avatar: input.avatar,
    creature: input.creature,
    oath: input.oath,
    mist_assimilation: input.mist_assimilation,
    skill_style: input.skill_style,
    buff_equipment: input.buff_equip_equipment,
    buff_avatar: input.buff_equip_avatar,
    buff_creature: input.buff_equip_creature
  }
}

const FETCHED_AT = '2026-10-19T00:00:00.000Z'

/** 상세 서비스의 공용 아이템 조회처럼 상세 응답의 아이템 칸에서 찾은 ID만 조회하고, 없는 아이템은 unavailable로 둔다. */
export function loadCatalog(
  payloads: CharacterPayloads,
  stored: Readonly<Record<string, Record<string, unknown>>>
): Map<string, CatalogDetail> {
  const { serverId, characterId } = payloads.basic as Record<string, string>
  const details = projectCharacterDetails(
    { serverId: serverId!, characterId: characterId! },
    payloads,
    new Date(FETCHED_AT)
  )
  const catalog = new Map<string, CatalogDetail>()
  mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      const data = stored[item.itemId]
      const detail: CatalogDetail =
        data === undefined ? unavailableDetail : { data, fetchedAt: FETCHED_AT, status: 'fresh' }
      catalog.set(item.itemId, detail)
    }

    return item
  })

  return catalog
}

/** 상세 서비스가 받은 원문과 공용 아이템 조회 결과로 만든 엔진 입력이다. */
export function apiEngineInput(name: 'dealer-blade' | 'buffer-muse'): ScoreEngineInput {
  const original = readEngineInput(name)
  const payloads = payloadsFromEngineInput(original)

  return toScoreEngineInput(payloads, loadCatalog(payloads, original.items))
}

function findScoreLibrary(): string | null {
  const fileName = SCORE_LIBRARY_FILE_NAMES[process.platform]
  if (fileName === undefined) {
    return null
  }
  const path = fileURLToPath(
    new URL(`../../../../packages/models/score-engine/${fileName}`, import.meta.url)
  )

  if (!existsSync(path)) {
    return null
  }

  return path
}

/** 점수 엔진 submodule을 받은 checkout에서만 경로가 있다. */
export const REAL_SCORE_LIBRARY_PATH = findScoreLibrary()
