// Biome noRestrictedImports는 import type만 따로 허용하지 못해, DB package의 값 import만 여기서 막는다.
// 계층 폴더 사이의 방향은 root biome.json이 검사한다.
const packageEntry = '^\\.\\./\\.\\./packages/database/'
const opsSourcePath = '^src/'
const allowedOpsSourcePath =
  '^src/(?:(domain|application|infrastructure|presentation|runtime)/|main\\.ts$)'

export default {
  forbidden: [
    ...[true, false].map((orphan) => {
      const name = orphan ? 'ops-source-location-orphan' : 'ops-source-location-connected'

      return {
        name,
        comment:
          '운영 app source는 domain/, application/, infrastructure/, presentation/, runtime/에 둔다. 계층 폴더 밖에는 진입 파일 main.ts만 둔다.',
        severity: 'error',
        from: { path: opsSourcePath, pathNot: allowedOpsSourcePath, orphan },
        to: {}
      }
    }),
    {
      name: 'domain-application-package-value',
      comment:
        'domain, application은 @dfragon/database를 import type으로만 쓴다. 값이 필요한 코드는 infrastructure/database/에 두고 application/<기능>/ports.ts의 함수 타입으로 받는다.',
      severity: 'error',
      from: { path: '^src/(domain|application)/' },
      to: { path: packageEntry, dependencyTypesNot: ['type-only'] }
    },
    {
      name: 'presentation-package-value',
      comment:
        'presentation은 @dfragon/database를 import type으로만 쓴다. DB 호출은 infrastructure/에 두고 application의 service를 거친다.',
      severity: 'error',
      from: { path: '^src/presentation/' },
      to: { path: packageEntry, dependencyTypesNot: ['type-only'] }
    },
    {
      name: 'unresolved-package',
      comment:
        '@dfragon/database를 package 소스로 찾지 못하면 위 두 규칙이 import type을 구분하지 못한다. tsconfig.dependency-cruiser.json의 paths를 package 진입 파일에 맞춘다.',
      severity: 'error',
      from: { path: '^src/(domain|application|presentation)/' },
      to: { couldNotResolve: true, path: '^@dfragon/database$' }
    }
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.dependency-cruiser.json' },
    doNotFollow: { path: ['node_modules', '^\\.\\./\\.\\./packages/'] }
  }
}
