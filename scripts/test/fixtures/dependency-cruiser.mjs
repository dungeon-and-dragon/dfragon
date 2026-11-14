import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../../', import.meta.url))
// package exports가 bin을 내놓지 않아 진입 파일에서 bin 경로를 찾는다.
const depcruise = fileURLToPath(
  new URL('../../bin/dependency-cruiser.mjs', import.meta.resolve('dependency-cruiser'))
)
const appConfigFiles = [
  '.dependency-cruiser.mjs',
  'tsconfig.json',
  'tsconfig.dependency-cruiser.json'
]
const packageStub = 'export const value = 1\nexport type Value = number\n'

async function cruise(directory, outputType) {
  const args = [
    depcruise,
    '--config',
    '.dependency-cruiser.mjs',
    '--output-type',
    outputType,
    'src'
  ]

  try {
    const { stdout } = await run(process.execPath, args, { cwd: directory })

    return { stdout, exitCode: 0 }
  } catch (error) {
    // 위반이 있으면 dependency-cruiser가 non-zero로 끝나지만 출력은 그대로 결과다.
    if (error.stdout) {
      return { stdout: error.stdout, exitCode: error.code }
    }

    throw error
  }
}

export async function cruiseAppSamples(sources, { withPackages = true, app = 'api' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-depcruise-'))
  const appDirectory = join(directory, 'apps', app)

  try {
    await mkdir(appDirectory, { recursive: true })

    for (const file of appConfigFiles) {
      await cp(join(root, 'apps', app, file), join(appDirectory, file))
    }

    if (withPackages) {
      for (const name of ['database', 'neople']) {
        await mkdir(join(directory, 'packages', name, 'src'), { recursive: true })
        await writeFile(join(directory, 'packages', name, 'src/index.ts'), packageStub)
      }
    }

    for (const [path, source] of Object.entries(sources)) {
      await mkdir(dirname(join(appDirectory, path)), { recursive: true })
      await writeFile(join(appDirectory, path), source)
    }

    const { stdout } = await cruise(appDirectory, 'json')
    const report = JSON.parse(stdout)
    const violations = report.summary.violations.map(({ from, rule }) => ({
      from,
      rule: rule.name
    }))

    const { stdout: text, exitCode } = await cruise(appDirectory, 'err-long')

    return { violations, exitCode, text }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
