import { useOathCatalog, oathItemIconOf } from '#entities/catalog'
import type { ItemView } from '#entities/character'

/**
 * 서약 본체 그림은 Neople 아이템 그림에 없어 캐릭터 상세 서약 탭처럼 서약 카탈로그에서 이름과 등급으로 찾는다. 카탈로그를
 * 받는 중이거나 그 본체가 없으면 null이라 빈 칸으로 둔다.
 */
export function useOathIconOf(): (item: ItemView) => string | null {
  const catalog = useOathCatalog()
  const loaded = catalog.status === 'success' ? catalog.value : null

  return (item) => {
    if (loaded === null) {
      return null
    }

    return oathItemIconOf(loaded, item)
  }
}
