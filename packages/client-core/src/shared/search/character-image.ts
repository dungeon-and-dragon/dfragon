import type { CharacterImage } from '../../preload/common/types/character'
import { SearchHttpFailure } from './http'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_HEADER_BYTES = 33
const PNG_IHDR_LENGTH = 13
const PNG_IHDR_TYPE = 'IHDR'
const RGBA_CHANNELS = 4

export const CHARACTER_IMAGE_LIMITS = {
  imageBytes: 4 * 1024 * 1024,
  imageDimension: 2048,
  imagePixels: 1024 * 1024
} as const

/** 코어가 크기를 검증한 PNG만 받는다. 풀 수 없으면 거절한다. */
export type DecodePng = (bytes: Uint8Array) => Promise<CharacterImage>

function hasPngHeader(bytes: Uint8Array, view: DataView): boolean {
  return (
    bytes.length >= PNG_HEADER_BYTES &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value) &&
    view.getUint32(8) === PNG_IHDR_LENGTH &&
    String.fromCharCode(...bytes.subarray(12, 16)) === PNG_IHDR_TYPE
  )
}

/** 디코더가 RGBA 이미지를 할당하기 전에 크기를 검증한다. */
export async function decodeCharacterImage(
  bytes: Uint8Array,
  decodePng: DecodePng
): Promise<CharacterImage> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!hasPngHeader(bytes, view)) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (
    width < 1 ||
    height < 1 ||
    width > CHARACTER_IMAGE_LIMITS.imageDimension ||
    height > CHARACTER_IMAGE_LIMITS.imageDimension ||
    width * height > CHARACTER_IMAGE_LIMITS.imagePixels
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  let decoded: CharacterImage
  try {
    decoded = await decodePng(bytes)
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  if (
    decoded.width !== width ||
    decoded.height !== height ||
    decoded.rgba.length !== width * height * RGBA_CHANNELS
  ) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }

  return { width, height, rgba: decoded.rgba }
}
