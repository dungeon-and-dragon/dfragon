import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import test from 'node:test'
import { PNG } from 'pngjs'
import { createIconFixture, syntheticPng } from './fixtures/icons/repository.mjs'

const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]
const BLACK = [0, 0, 0, 255]
const WHITE = [255, 255, 255, 255]

function pixelAt(png, x, y) {
  const offset = (y * png.width + x) * 4

  return [...png.data.subarray(offset, offset + 4)]
}

test('원본을 칸마다 평균 내 64px favicon으로 줄여 Web 경로에 쓴다', (t) => {
  // 왼쪽 위 사분면은 빨강, 나머지는 파랑이고, 오른쪽 아래 사분면만 1px 바둑판이다.
  const source = syntheticPng(128, (x, y) => {
    if (x < 64 && y < 64) {
      return RED
    }

    if (x < 64 || y < 64) {
      return BLUE
    }

    if ((x + y) % 2 === 0) {
      return BLACK
    }

    return WHITE
  })
  const { favicon, cwd, run } = createIconFixture(t, source)
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  const output = PNG.sync.read(readFileSync(favicon))
  assert.equal(output.width, 64)
  assert.equal(output.height, 64)
  assert.deepEqual(pixelAt(output, 0, 0), RED)
  assert.deepEqual(pixelAt(output, 63, 0), BLUE)
  assert.deepEqual(pixelAt(output, 63, 63), [128, 128, 128, 255])
  assert.deepEqual(readdirSync(cwd), [])
})

test('favicon 크기의 정수배가 아닌 원본은 거절하고 기존 favicon을 보존한다', (t) => {
  const { favicon, run } = createIconFixture(
    t,
    syntheticPng(100, () => RED)
  )
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /정수배인 정사각형/)
  assert.equal(readFileSync(favicon, 'utf8'), '기존 아이콘')
})

test('favicon 쓰기 실패도 실패 코드로 전파한다', (t) => {
  const { favicon, run } = createIconFixture(
    t,
    syntheticPng(64, () => RED)
  )
  rmSync(favicon)
  mkdirSync(favicon)
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EISDIR/)
  assert.deepEqual(readdirSync(favicon), [])
})
