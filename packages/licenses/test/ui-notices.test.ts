import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { uiNotices } from '../src/vite.ts'
import { createPackageFixture } from './fixtures.ts'

function buildNotices(
  moduleIds: string[] = [],
  bundle: Parameters<ReturnType<typeof uiNotices>['generateBundle']>[1] = {}
) {
  const assets = new Map<string, string>()
  uiNotices().generateBundle.call(
    {
      getModuleIds: () => moduleIds.values(),
      emitFile(asset) {
        assets.set(asset.fileName, asset.source)

        return asset.fileName
      }
    },
    {},
    bundle
  )

  return assets
}

test('번들 입력의 고지만 원문 그대로 수집하고 번들하지 않은 production 의존성은 넣지 않는다', (t) => {
  const fixture = createPackageFixture(t)
  fixture.writeManifest('', {
    dependencies: { 'unbundled-production': '1' },
    devDependencies: { tool: '1' }
  })
  fixture.pkg('unbundled-production', { documents: {} })
  const renderer = fixture.pkg('renderer', {
    documents: {
      LICENSE: 'Renderer original\r\n',
      'NOTICE.txt': '  Renderer attribution\n'
    }
  })
  fixture.writeFile('node_modules/renderer/feature.js', '')
  fixture.pkg('tool', { documents: {} })
  const localModule = fixture.writeFile('src/index.ts', '')
  const assets = buildNotices([
    join(renderer, 'index.js?commonjs-proxy'),
    join(renderer, 'feature.js'),
    `\0${join(fixture.root, 'node_modules/tool/index.js')}`,
    localModule
  ])

  assert.equal(
    assets.get('notices/THIRD-PARTY.txt'),
    'renderer@1.0.0 (MIT)\n\n' +
      'LICENSE\nRenderer original\r\n\n\n' +
      'NOTICE.txt\n  Renderer attribution\n'
  )
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-modules.json')!), [
    {
      name: 'renderer',
      version: '1.0.0',
      license: 'MIT',
      modules: ['index.js', 'feature.js']
    }
  ])
  assert.equal(assets.get('notices/THIRD-PARTY.txt')!.includes(fixture.root), false)
})

test('생성 JavaScript chunk 목록만 기록하고 chunk 코드와 다른 asset은 바꾸지 않는다', () => {
  const bundle = {
    'app.js': { type: 'chunk' as const, code: 'export const app = 1\n' },
    'lazy.js': { type: 'chunk' as const, code: 'export const lazy = 2\n' },
    'style.css': { type: 'asset' as const, source: 'body { color: red; }\n' },
    'placeholder.js': { type: 'chunk' as const }
  }

  const assets = buildNotices([], bundle)

  assert.equal(bundle['app.js'].code, 'export const app = 1\n')
  assert.equal(bundle['lazy.js'].code, 'export const lazy = 2\n')
  assert.equal(bundle['style.css'].source, 'body { color: red; }\n')
  assert.deepEqual(bundle['placeholder.js'], { type: 'chunk' })
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-files.json')!), ['app.js', 'lazy.js'])
  assert.equal(assets.get('notices/THIRD-PARTY.txt'), '')
  assert.deepEqual(JSON.parse(assets.get('notices/bundle-modules.json')!), [])
  assert.deepEqual([...assets.keys()].sort(), [
    'notices/THIRD-PARTY.txt',
    'notices/bundle-files.json',
    'notices/bundle-modules.json'
  ])
})

test('알려진 원문 공백은 THIRD-PARTY에서도 확인 필요 표시와 근거를 유지한다', (t) => {
  const fixture = createPackageFixture(t)
  const guid = fixture.pkg('guid-typescript', {
    manifest: { version: '1.0.9', license: 'ISC' },
    documents: {}
  })

  const assets = buildNotices([join(guid, 'index.js')])

  assert.equal(
    assets.get('notices/THIRD-PARTY.txt'),
    'guid-typescript@1.0.9 (ISC · 원문 확인 필요)\n\n' +
      'LICENSE-STATUS.txt\n' +
      '이 패키지는 npm에서 ISC를 선언하지만 배포 패키지와 현재 공식 저장소에 라이선스 원문이 없습니다. 저작권 문구를 추정하지 않았으며 원문 확보가 필요합니다.\n' +
      'https://www.npmjs.com/package/guid-typescript/v/1.0.9\n' +
      'https://github.com/snico-dev/guid-typescript'
  )
})

test('번들 입력의 원문이 누락되면 THIRD-PARTY 산출 성공으로 처리하지 않는다', (t) => {
  const fixture = createPackageFixture(t)
  const unknown = fixture.pkg('unknown', { documents: {} })

  assert.throws(() => buildNotices([join(unknown, 'index.js')]), {
    name: 'Error',
    message: 'Missing license text for unknown@1.0.0'
  })
})
