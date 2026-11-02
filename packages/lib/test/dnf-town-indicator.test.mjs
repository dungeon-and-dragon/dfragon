import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectDNFTownIndicator } from '@dfragon/lib'

const testTitles = {
  clientFrame: '1067×600 client 오른쪽 위의 지구본 아이콘을 찾는다',
  oddWidthShare: '홀수 폭을 한 열 줄인 1066×600 공유 프레임에서도 찾는다',
  scaled: '1~1.8 배율로 커진 아이콘을 오른쪽 위 기준 위치에서 찾는다',
  outOfScale: '2.4배로 커진 아이콘은 찾지 않는다',
  grayGlobe: '같은 모양의 회색 지구본은 마을로 보지 않는다',
  tintedGrayGlobe: '색이 조금 흔들린 회색 지구본도 마을로 보지 않는다',
  differentLuminance: '노란 부분만 같고 밝기 모양이 다른 그림은 마을로 보지 않는다',
  outsideTopRight: '오른쪽 위 밖에 있는 같은 아이콘은 찾지 않는다',
  emptyFrames: '아이콘이 없는 화면과 템플릿보다 작은 화면은 미검출이다',
  validation: '프레임 크기, RGBA 길이, 16×16 템플릿과 템플릿 대비를 검사한다'
}

const dark = [28, 26, 24, 255]

function frame(width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.set(
        [40 + ((x * 7 + y * 13) % 50), 60 + ((x * 3 + y * 5) % 40), 90, 255],
        (y * width + x) * 4
      )
    }
  }

  return { width, height, rgba }
}

function paint(image, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      image.rgba.set(color, (row * image.width + column) * 4)
    }
  }
}

function iconFixture() {
  const image = { width: 16, height: 16, rgba: new Uint8ClampedArray(16 * 16 * 4) }
  paint(image, 0, 0, 16, 16, dark)
  paint(image, 0, 6, 1, 4, [120, 100, 70, 255])
  paint(image, 15, 6, 1, 4, [120, 100, 70, 255])
  paint(image, 3, 3, 10, 10, [235, 205, 110, 255])
  paint(image, 5, 4, 2, 6, dark)
  paint(image, 8, 9, 4, 2, dark)
  paint(image, 9, 5, 3, 2, dark)

  return image
}

const template = iconFixture()

function grayIcon() {
  const rgba = template.rgba.slice()
  for (let index = 0; index < rgba.length; index += 4) {
    const luminance = Math.round(
      0.299 * rgba[index] + 0.587 * rgba[index + 1] + 0.114 * rgba[index + 2]
    )
    rgba.set([luminance, luminance, luminance], index)
  }

  return { width: 16, height: 16, rgba }
}

function brightBackgroundIcon() {
  const rgba = template.rgba.slice()
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index] === dark[0] && rgba[index + 1] === dark[1] && rgba[index + 2] === dark[2]) {
      rgba.set([200, 200, 210], index)
    }
  }

  return { width: 16, height: 16, rgba }
}

function tintedGrayIcon() {
  const { rgba } = grayIcon()
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = Math.round(rgba[index] * 1.01)
    rgba[index + 1] = Math.round(rgba[index + 1] * 1.01)
  }

  return { width: 16, height: 16, rgba }
}

function place(image, icon, x, y, scale = 1) {
  const size = Math.round(16 * scale)
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const offset =
        (Math.min(15, Math.floor(row / scale)) * 16 + Math.min(15, Math.floor(column / scale))) * 4
      paint(image, x + column, y + row, 1, 1, icon.rgba.subarray(offset, offset + 4))
    }
  }
}

function placeTopRight(image, icon, scale = 1) {
  place(image, icon, image.width - Math.round(23 * scale), Math.round(5 * scale), scale)
}

test(testTitles.clientFrame, () => {
  const image = frame(1067, 600)
  placeTopRight(image, template)
  const result = detectDNFTownIndicator(image, template)

  assert.equal(result.status, 'found')
  assert.equal(result.scale, 1)
  assert.deepEqual(result.region, { x: 1044, y: 5, width: 16, height: 16 })
  assert.ok(result.matchScore > 0.99)
})

test(testTitles.oddWidthShare, () => {
  const client = frame(1067, 600)
  placeTopRight(client, template)
  const share = frame(1066, 600)
  for (let row = 0; row < 600; row += 1) {
    share.rgba.set(client.rgba.subarray(row * 1067 * 4, (row * 1067 + 1066) * 4), row * 1066 * 4)
  }
  const result = detectDNFTownIndicator(share, template)

  assert.equal(result.status, 'found')
  assert.deepEqual(result.region, { x: 1044, y: 5, width: 16, height: 16 })
})

test(testTitles.scaled, () => {
  for (const [scale, placed] of [
    [1.3, { x: 1890, y: 7, width: 21, height: 21 }],
    [1.8, { x: 1879, y: 9, width: 29, height: 29 }]
  ]) {
    const image = frame(1920, 1080)
    placeTopRight(image, template, scale)
    const result = detectDNFTownIndicator(image, template)

    assert.equal(result.status, 'found', String(scale))
    // Nearest-neighbor enlargement makes a box one pixel smaller match as well as the drawn one.
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(result.region[key] - placed[key]) <= 1, `${scale} ${key}`)
    }
    assert.ok(Math.abs(result.scale - scale) <= 1 / 16, String(scale))
  }
})

test(testTitles.outOfScale, () => {
  const image = frame(3840, 2160)
  placeTopRight(image, template, 2.4)

  assert.deepEqual(detectDNFTownIndicator(image, template), { status: 'not-found' })
})

test(testTitles.grayGlobe, () => {
  const image = frame(1067, 600)
  placeTopRight(image, grayIcon())

  assert.deepEqual(detectDNFTownIndicator(image, template), { status: 'not-found' })
})

test(testTitles.tintedGrayGlobe, () => {
  const image = frame(1067, 600)
  placeTopRight(image, tintedGrayIcon())

  assert.deepEqual(detectDNFTownIndicator(image, template), { status: 'not-found' })
})

test(testTitles.differentLuminance, () => {
  const image = frame(1067, 600)
  placeTopRight(image, brightBackgroundIcon())

  assert.deepEqual(detectDNFTownIndicator(image, template), { status: 'not-found' })
})

test(testTitles.outsideTopRight, () => {
  for (const [x, y] of [
    [1044, 60],
    [990, 5],
    [5, 5],
    [520, 290]
  ]) {
    const image = frame(1067, 600)
    place(image, template, x, y)

    assert.deepEqual(detectDNFTownIndicator(image, template), { status: 'not-found' }, `${x},${y}`)
  }
})

test(testTitles.emptyFrames, () => {
  for (const [width, height] of [
    [1066, 600],
    [1920, 1080],
    [10, 10],
    [1, 1]
  ]) {
    assert.deepEqual(detectDNFTownIndicator(frame(width, height), template), {
      status: 'not-found'
    })
  }
})

test(testTitles.validation, () => {
  const valid = frame(1067, 600)
  const uniform = { width: 16, height: 16, rgba: new Uint8Array(16 * 16 * 4).fill(200) }
  for (const [image, icon] of [
    [{ width: 0, height: 600, rgba: new Uint8Array(0) }, template],
    [{ width: 1067.5, height: 600, rgba: valid.rgba }, template],
    [{ width: 8193, height: 1, rgba: new Uint8Array(8193 * 4) }, template],
    [{ width: 1067, height: 600, rgba: valid.rgba.subarray(4) }, template],
    [{ width: 1067, height: 600, rgba: Array.from(valid.rgba) }, template],
    [null, template],
    [valid, frame(17, 16)],
    [valid, { width: 16, height: 16, rgba: template.rgba.subarray(4) }],
    [valid, uniform],
    [valid, grayIcon()]
  ]) {
    assert.throws(() => detectDNFTownIndicator(image, icon), RangeError)
  }
})
