const WEB_SOURCE_PATH = '^src/'
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const SLICED_LAYERS = ['pages', 'widgets', 'features', 'entities']
const TESTING_PATH = '^src/testing/'
const MOCK_API_PATH = '/api/[^/]+\\.(fixture|handlers)\\.ts$'
// test, story, fixture와 MSW handler, testing/의 도구는 테스트에서만 실행되는 코드다.
const TEST_CODE_PATHS = ['\\.(test|stories)\\.tsx?$', MOCK_API_PATH, TESTING_PATH]
const LAYER_IMPORT_COMMENT =
  '계층은 자기보다 아래 계층만 import한다. 위에서부터 app, pages, widgets, features, entities, shared다.'
const SLICE_IMPORT_COMMENT =
  '같은 계층의 다른 슬라이스는 import하지 않는다. 두 슬라이스가 쓰는 코드는 아래 계층으로 내린다. entity 사이는 entities/<A>/@x/<B>.ts로만 가져온다.'

function upperLayerRules() {
  return LAYERS.slice(1).map((layer, index) => ({
    name: 'layer-imports',
    comment: LAYER_IMPORT_COMMENT,
    severity: 'error',
    from: { path: `^src/${layer}/` },
    to: { path: `^src/(${LAYERS.slice(0, index + 1).join('|')})/` }
  }))
}

// 테스트 코드는 다른 슬라이스의 fixture와 MSW handler를 가져올 수 있다. 제품 코드는 fixture-imports가 막는다.
function sliceRules() {
  return SLICED_LAYERS.map((layer) => ({
    name: 'slice-imports',
    comment: SLICE_IMPORT_COMMENT,
    severity: 'error',
    from: { path: `^src/${layer}/([^/]+)/` },
    to: {
      path: `^src/${layer}/`,
      pathNot: [
        `^src/${layer}/$1/`,
        MOCK_API_PATH,
        ...(layer === 'entities' ? ['^src/entities/[^/]+/@x/$1\\.ts$'] : [])
      ]
    }
  }))
}

// index.ts로 fixture를 내보내면 제품 코드가 그 슬라이스를 import할 때 MSW가 함께 묶일 수 있어 fixture는 파일로 가져온다.
function slicePublicApiRules() {
  return SLICED_LAYERS.map((layer) => ({
    name: 'slice-index',
    comment: `슬라이스 밖에서는 #${layer}/<슬라이스>처럼 그 슬라이스의 index.ts로 import한다.`,
    severity: 'error',
    from: { path: WEB_SOURCE_PATH, pathNot: `^src/${layer}/` },
    to: {
      path: `^src/${layer}/[^/]+/`,
      pathNot: [`^src/${layer}/[^/]+/index\\.ts$`, MOCK_API_PATH]
    }
  }))
}

export default {
  forbidden: [
    ...upperLayerRules(),
    ...sliceRules(),
    ...slicePublicApiRules(),
    {
      name: 'fixture-imports',
      comment:
        'fixture와 MSW handler(api/*.fixture.ts, api/*.handlers.ts)는 테스트, story와 testing/에서만 import한다.',
      severity: 'error',
      from: { path: WEB_SOURCE_PATH, pathNot: TEST_CODE_PATHS },
      to: { path: MOCK_API_PATH }
    },
    {
      name: 'testing-imports',
      comment:
        'testing/의 테스트 도구는 테스트, story, fixture와 MSW handler에서만 import한다. 제품 코드에서 쓰는 코드는 계층 폴더에 둔다.',
      severity: 'error',
      from: { path: WEB_SOURCE_PATH, pathNot: TEST_CODE_PATHS },
      to: { path: TESTING_PATH }
    },
    {
      name: 'no-circular',
      comment:
        '실행할 때 생기는 순환 import를 두지 않는다. import type만으로 이은 순환은 검사하지 않는다. 슬라이스 안의 파일은 자기 index 대신 파일을 직접 import한다.',
      severity: 'error',
      from: { path: WEB_SOURCE_PATH },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
