import { inflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import type { CharacterImage } from '../../preload/common/types/character'

const PNG_CHUNK_OVERHEAD_BYTES = 12
const PNG_MAX_BYTES_PER_PIXEL = 8
const PNG_INTERLACE_PASSES = 7

/** pngjs가 허용하는 중복 IHDR과 상한 없는 인터레이스 압축 해제를 먼저 차단한다. */
function boundPngInflation(bytes: Buffer, width: number, height: number): void {
  const compressed: Buffer[] = []
  let offset = 8
  let headerSeen = false
  let endSeen = false
  while (offset + PNG_CHUNK_OVERHEAD_BYTES <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const end = offset + PNG_CHUNK_OVERHEAD_BYTES + length
    if (end > bytes.length) {
      throw new Error('PNG chunk exceeds the response')
    }
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') {
      if (headerSeen) {
        throw new Error('PNG has a duplicate header')
      }
      headerSeen = true
    } else if (type === 'IDAT') {
      compressed.push(bytes.subarray(offset + 8, end - 4))
    } else if (type === 'IEND') {
      endSeen = true
      if (end !== bytes.length) {
        throw new Error('PNG has data after its end')
      }
    }
    offset = end
  }
  if (offset !== bytes.length || !endSeen || compressed.length === 0) {
    throw new Error('PNG chunks are incomplete')
  }
  // 16비트 RGBA와 Adam7의 일곱 패스를 포함하는 압축 해제 상한이다.
  const maxOutputLength = width * height * PNG_MAX_BYTES_PER_PIXEL + height * PNG_INTERLACE_PASSES
  inflateSync(Buffer.concat(compressed), { maxOutputLength })
}

/** 검색 코어가 크기를 검증한 PNG를 pngjs가 RGBA 이미지를 할당하기 전에 압축 해제 상한으로 다시 막는다. */
export async function decodeCharacterPng(bytes: Uint8Array): Promise<CharacterImage> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  boundPngInflation(buffer, width, height)
  const decoded = PNG.sync.read(buffer)

  return { width: decoded.width, height: decoded.height, rgba: new Uint8Array(decoded.data) }
}
