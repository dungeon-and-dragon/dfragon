import type { DNFParticipantFrame, DNFRectangle } from './dnf-party-geometry.js'
import { isValidPartyFrameSize } from './dnf-party-frame-geometry.js'
import {
  headingPattern,
  headingScore,
  participantGrayscale,
  roundParticipantPixel as roundPixel,
  type ParticipantGrayFrame
} from './dnf-party-participant-matching.js'

export type DNFTownIndicatorDetection =
  | { status: 'found'; scale: number; matchScore: number; region: DNFRectangle }
  | { status: 'not-found' }

// Measured on 1067×600 town screenshots: the crop inside the globe ring starts 23px left of the
// right edge and 5px below the top, and both offsets grew with the UI scale up to 1.8.
const templateLayout = { width: 16, height: 16, right: 23, top: 5 }
const searchPolicy = { minScale: 1, maxScale: 1.8, positionRadiusPx: 3, minCorrelation: 0.7 }
// Matched yellow over template yellow (means): town samples 0.954 or more, gray dungeon-result
// globes 0.010 or less and 0.080 or less with R, G raised 5%.
const minYellowRatio = 0.5

function validateFrame(frame: DNFParticipantFrame, template = false): void {
  if (
    frame == null ||
    !isValidPartyFrameSize(frame.width, frame.height) ||
    !(frame.rgba instanceof Uint8Array || frame.rgba instanceof Uint8ClampedArray) ||
    frame.rgba.length !== frame.width * frame.height * 4 ||
    (template && (frame.width !== templateLayout.width || frame.height !== templateLayout.height))
  ) {
    throw new RangeError('DNF town detection requires bounded RGBA frames and a 16x16 template.')
  }
}

function yellowness(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  const yellow = new Uint8Array(rgba.length / 4)
  for (let index = 0; index < yellow.length; index += 1) {
    const offset = index * 4
    yellow[index] = Math.max(0, Math.min(rgba[offset], rgba[offset + 1]) - rgba[offset + 2])
  }

  return yellow
}

function meanPixel(frame: ParticipantGrayFrame, x: number, y: number, size: number): number {
  let sum = 0
  for (let row = y; row < y + size; row += 1) {
    for (let column = x; column < x + size; column += 1) {
      sum += frame.pixels[row * frame.width + column]
    }
  }

  return sum / (size * size)
}

function cropRgba(frame: DNFParticipantFrame, region: DNFRectangle): Uint8Array {
  const rgba = new Uint8Array(region.width * region.height * 4)
  for (let row = 0; row < region.height; row += 1) {
    const start = ((region.y + row) * frame.width + region.x) * 4
    rgba.set(frame.rgba.subarray(start, start + region.width * 4), row * region.width * 4)
  }

  return rgba
}

export function detectDNFTownIndicator(
  frame: DNFParticipantFrame,
  template: DNFParticipantFrame
): DNFTownIndicatorDetection {
  validateFrame(frame)
  validateFrame(template, true)
  const templateGray = participantGrayscale(template.rgba)
  const templateYellow = yellowness(template.rgba)
  if (
    templateGray.every((value) => value === templateGray[0]) ||
    templateYellow.every((value) => value === templateYellow[0])
  ) {
    throw new RangeError('DNF town indicator template must contain contrast.')
  }

  const { minScale, maxScale, positionRadiusPx: radius, minCorrelation } = searchPolicy
  const maxSize = roundPixel(templateLayout.width * maxScale)
  const left = Math.max(0, frame.width - roundPixel(templateLayout.right * maxScale) - radius)
  const bottom = Math.min(
    frame.height,
    roundPixel(templateLayout.top * maxScale) + maxSize + radius
  )
  const region = { x: left, y: 0, width: frame.width - left, height: bottom }
  const rgba = cropRgba(frame, region)
  const gray: ParticipantGrayFrame = { ...region, pixels: participantGrayscale(rgba) }
  // The dungeon result screen shows the same globe in gray at the same place, so luminance
  // correlation alone matches it; the yellow channel has to correlate as well.
  const yellow: ParticipantGrayFrame = { ...region, pixels: yellowness(rgba) }

  let best: { x: number; y: number; size: number; score: number } | null = null
  for (let size = roundPixel(templateLayout.width * minScale); size <= maxSize; size += 1) {
    const scale = size / templateLayout.width
    const grayPattern = headingPattern(
      templateGray,
      templateLayout,
      size,
      size,
      region.width,
      false
    )
    const yellowPattern = headingPattern(
      templateYellow,
      templateLayout,
      size,
      size,
      region.width,
      false
    )
    const expectedX = frame.width - roundPixel(templateLayout.right * scale) - left
    const expectedY = roundPixel(templateLayout.top * scale)
    for (
      let y = Math.max(0, expectedY - radius);
      y <= Math.min(region.height - size, expectedY + radius);
      y += 1
    ) {
      for (
        let x = Math.max(0, expectedX - radius);
        x <= Math.min(region.width - size, expectedX + radius);
        x += 1
      ) {
        const score = Math.min(
          headingScore(gray, grayPattern, x, y),
          headingScore(yellow, yellowPattern, x, y)
        )
        if (best == null || score > best.score) {
          best = { x, y, size, score }
        }
      }
    }
  }

  if (best == null || best.score < minCorrelation) {
    return { status: 'not-found' }
  }

  // Correlation ignores intensity, so a gray globe tinted by a few levels of capture color noise
  // still correlates; the match has to be about as yellow as the template.
  const templateYellowMean =
    templateYellow.reduce((sum, value) => sum + value, 0) / templateYellow.length
  const matchedYellowMean = meanPixel(yellow, best.x, best.y, best.size)
  if (matchedYellowMean < templateYellowMean * minYellowRatio) {
    return { status: 'not-found' }
  }

  const scale = best.size / templateLayout.width
  const iconRegion = { x: left + best.x, y: best.y, width: best.size, height: best.size }

  return { status: 'found', scale, matchScore: best.score, region: iconRegion }
}
