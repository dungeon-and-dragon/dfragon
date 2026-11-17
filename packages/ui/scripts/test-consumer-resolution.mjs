import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, test } from 'node:test'

const root = fileURLToPath(new URL('../../../', import.meta.url))

// 전용 checkout에서 직렬 실행한다. 이전 case의 output/cache로 cold 실패를 가리지 않는다.
// 보존할 artifact가 있거나 다른 build가 도는 checkout에서는 실행하지 않는다.
beforeEach(() => {
  for (const path of ['packages/ui/dist', 'packages/ui/node_modules/.vite']) {
    rmSync(new URL(`../../../${path}`, import.meta.url), { recursive: true, force: true })
  }
})

for (const [workspace, command] of [
  ['@dfragon/ui', 'test'],
  ['@dfragon/ui', 'typecheck']
]) {
  test(`library 선행 빌드 없이 pnpm --filter ${workspace} ${command}를 실행한다`, () => {
    const result = spawnSync('pnpm', ['--filter', workspace, command], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024
    })

    assert.ifError(result.error)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  })
}
