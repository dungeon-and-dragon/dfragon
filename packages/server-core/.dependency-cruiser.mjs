// Biome noRestrictedImports는 import type만 따로 허용하지 못해, 두 package의 값 import만 여기서 막는다.
// 계층 폴더 사이의 방향은 root biome.json이 검사한다.
const packageEntry = '^\\.\\./(database|neople)/'
const sourcePath = '^src/'
const allowedSourcePath = '^src/(domain|application|infrastructure)/'

export default {
  forbidden: [
    ...[true, false].map((orphan) => {
      const name = orphan
        ? 'server-core-source-location-orphan'
        : 'server-core-source-location-connected'

      return {
        name,
        comment: 'server-core source는 domain/, application/, infrastructure/에 둔다.',
        severity: 'error',
        from: { path: sourcePath, pathNot: allowedSourcePath, orphan },
        to: {}
      }
    }),
    {
      name: 'domain-application-package-value',
      comment:
        'domain, application은 @dfragon/database, @dfragon/neople을 import type으로만 쓴다. 값이 필요한 코드는 infrastructure/database/, infrastructure/neople/에 두고 application/<기능>/ports.ts의 함수 타입으로 받는다.',
      severity: 'error',
      from: { path: '^src/(domain|application)/' },
      to: { path: packageEntry, dependencyTypesNot: ['type-only'] }
    },
    {
      name: 'unresolved-package',
      comment:
        '@dfragon/database, @dfragon/neople을 package 소스로 찾지 못하면 위 규칙이 import type을 구분하지 못한다. tsconfig.dependency-cruiser.json의 paths를 package 진입 파일에 맞춘다.',
      severity: 'error',
      from: { path: '^src/(domain|application)/' },
      to: { couldNotResolve: true, path: '^@dfragon/(database|neople)$' }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.dependency-cruiser.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./'] }
  }
}
