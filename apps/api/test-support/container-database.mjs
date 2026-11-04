import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const imageArguments = process.argv.slice(2)
const [imageReference] = imageArguments
if (imageArguments.length !== 1 || imageReference.trim() === '' || imageReference.startsWith('-')) {
  process.stderr.write('Usage: node container-database.mjs IMAGE_REFERENCE\n')
  process.exit(2)
}
// 운영 dfragon-db와 같은 PostgreSQL 18.6이다.
const postgresImage =
  'docker.io/library/postgres:18.6-trixie@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280'
const runtimeCheckPath = fileURLToPath(new URL('./container-runtime-check.mjs', import.meta.url))
const failingMigrationPath = fileURLToPath(new URL('./failing-migration', import.meta.url))
const pgcryptoPermissionDeniedPattern = /permission denied to create extension "pgcrypto"/

const runId = `apidb${randomUUID().replaceAll('-', '')}`
const networkName = `dfragon-db-test-${runId}`
const postgresName = `dfragon-db-test-${runId}-postgres`
const apiNames = [1, 2].map((index) => `dfragon-db-test-${runId}-api-${index}`)
const failureName = `dfragon-db-test-${runId}-failure`
const labelKey = 'com.dfragon.image-test.run'
const label = `${labelKey}=${runId}`
// Docker CLI가 쓰는 변수만 넘기고 상위 프로세스의 credential은 넘기지 않는다.
const dockerEnvironment = Object.fromEntries(
  ['PATH', 'HOME', 'DOCKER_CONFIG', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY']
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]])
)
let stage = 'image verification'
let directory
let networkCreated = false

function docker(args, { allowFailure = false, timeout = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      args,
      { env: dockerEnvironment, timeout, killSignal: 'SIGKILL' },
      (error, stdout, stderr) => {
        const code = error == null ? 0 : (error.code ?? 1)
        const signal = error?.signal ?? null
        const failed = code !== 0 || signal !== null
        if (failed && (!allowFailure || typeof code !== 'number' || signal !== null)) {
          reject(new Error(`Docker command failed: ${args[0]}`))

          return
        }
        resolve({ code, signal, stdout, stderr })
      }
    )
  })
}

async function removeOwned(name) {
  const names = await docker([
    'container',
    'ls',
    '--all',
    '--filter',
    `name=^/${name}$`,
    '--format',
    '{{.Names}}'
  ])
  if (names.stdout.trim() === '') {
    return
  }
  const owner = await docker([
    'container',
    'inspect',
    name,
    '--format',
    `{{ index .Config.Labels "${labelKey}" }}`
  ])
  assert.equal(owner.stdout.trim(), runId)
  await docker(['rm', '--force', name])
}

function psql(sql) {
  return docker([
    'exec',
    postgresName,
    'psql',
    '--host=127.0.0.1',
    '--username=postgres',
    '--dbname=dfragon',
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--set=ON_ERROR_STOP=1',
    '--command',
    sql
  ])
}

try {
  const [metadata] = JSON.parse((await docker(['image', 'inspect', imageReference])).stdout)
  const imageId = metadata.Id
  process.stdout.write(`Disposable api database test: ${runId}\n`)

  stage = 'PostgreSQL startup'
  await docker(['pull', '--quiet', postgresImage], { timeout: 600_000 })
  await docker(['network', 'create', '--internal', '--label', label, networkName])
  networkCreated = true
  // 합성 비밀번호이며 실제 credential이 아니다.
  const superuserPassword = randomBytes(24).toString('hex')
  const apiPassword = randomBytes(24).toString('hex')
  await docker([
    'run',
    '--detach',
    '--name',
    postgresName,
    '--label',
    label,
    '--network',
    networkName,
    '--tmpfs',
    '/var/lib/postgresql',
    '--env',
    `POSTGRES_PASSWORD=${superuserPassword}`,
    '--env',
    'POSTGRES_DB=dfragon',
    postgresImage
  ])
  // 초기화 중의 임시 서버는 TCP를 열지 않으므로 127.0.0.1 접속이 되면 초기화가 끝난 것이다.
  let ready = false
  for (let attempt = 0; attempt < 120 && !ready; attempt++) {
    ready = (await psql('SELECT 1').catch(() => undefined)) !== undefined
    if (!ready) {
      await setTimeout(500)
    }
  }
  assert(ready)

  stage = 'API role with public schema ownership only'
  await psql(
    [
      `CREATE ROLE dfragon_api LOGIN PASSWORD '${apiPassword}'`,
      'REVOKE CREATE ON DATABASE dfragon FROM PUBLIC',
      'ALTER SCHEMA public OWNER TO dfragon_api'
    ].join('; ')
  )

  directory = await mkdtemp(join(tmpdir(), 'dfragon-db-image-'))
  await writeFile(join(directory, 'neople_api_key'), randomBytes(32).toString('base64url'), {
    mode: 0o444
  })
  // 끝 줄바꿈이 있는 운영 secret 파일도 그대로 읽는지 확인한다.
  await writeFile(join(directory, 'db_password'), `${apiPassword}\n`, { mode: 0o444 })
  await writeFile(join(directory, 'wrong_db_password'), 'wrong-synthetic-password', {
    mode: 0o444
  })
  const runtimeOptions = [
    '--platform',
    `${metadata.Os}/${metadata.Architecture}${metadata.Variant ? `/${metadata.Variant}` : ''}`,
    '--label',
    label,
    '--network',
    networkName,
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--init',
    '--env',
    'PORT=3000',
    '--mount',
    `type=bind,source=${join(directory, 'neople_api_key')},target=/run/secrets/neople_api_key,readonly`
  ]
  const databaseEnvironment = [
    '--env',
    `DB_HOST=${postgresName}`,
    '--env',
    'DB_PORT=5432',
    '--env',
    'DB_NAME=dfragon',
    '--env',
    'DB_USERNAME=dfragon_api'
  ]

  stage = 'migration waits for the advisory lock'
  // Prisma migrate가 PostgreSQL에서 잡는 advisory lock key다. 10초 안에 얻지 못하면 실패한다.
  const migrationLock = 'pg_advisory_lock(72707369)'
  const advisoryLockCount = async (granted) =>
    Number(
      (
        await psql(
          `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted = ${granted}`
        )
      ).stdout.trim()
    )
  const waitFor = async (condition) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await condition()) {
        return
      }
      await setTimeout(500)
    }
    assert.fail('condition not reached')
  }
  // 다른 인스턴스가 migration 중인 상황을 만들려고 테스트 연결이 먼저 lock을 잡아 둔다.
  await docker([
    'exec',
    '--detach',
    postgresName,
    'psql',
    '--host=127.0.0.1',
    '--username=postgres',
    '--dbname=dfragon',
    '--command',
    `SELECT ${migrationLock}; SELECT pg_sleep(600)`
  ])
  await waitFor(async () => (await advisoryLockCount(true)) === 1)
  await Promise.all(
    apiNames.map((name) =>
      docker([
        'run',
        '--detach',
        '--name',
        name,
        ...runtimeOptions,
        ...databaseEnvironment,
        '--mount',
        `type=bind,source=${join(directory, 'db_password')},target=/run/secrets/db_password,readonly`,
        '--mount',
        `type=bind,source=${runtimeCheckPath},target=/app/container-runtime-check.mjs,readonly`,
        imageId
      ])
    )
  )
  await waitFor(async () => (await advisoryLockCount(false)) === apiNames.length)
  assert.equal(
    (await psql("SELECT to_regclass('public._prisma_migrations') IS NULL")).stdout.trim(),
    't'
  )
  await psql(
    "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND granted"
  )
  stage = 'HTTP after migration'
  await Promise.all(
    apiNames.map((name) => docker(['exec', name, 'node', '/app/container-runtime-check.mjs']))
  )
  stage = 'migration history table'
  assert.equal(
    (
      await psql(
        "SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = to_regclass('public._prisma_migrations')"
      )
    ).stdout.trim(),
    'dfragon_api'
  )
  assert.equal((await psql('SELECT count(*) FROM _prisma_migrations')).stdout.trim(), '0')
  assert.equal(
    (await psql("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")).stdout.trim(),
    '0'
  )

  stage = 'graceful stop'
  for (const name of apiNames) {
    await docker(['stop', '--time', '15', name])
    assert.equal(
      (await docker(['inspect', '--format', '{{.State.ExitCode}}', name])).stdout.trim(),
      '0'
    )
    await removeOwned(name)
  }

  stage = 'failed migration fails closed'
  const failedMigration = await docker(
    [
      'run',
      '--rm',
      '--name',
      failureName,
      ...runtimeOptions,
      ...databaseEnvironment,
      '--mount',
      `type=bind,source=${join(directory, 'db_password')},target=/run/secrets/db_password,readonly`,
      '--mount',
      `type=bind,source=${failingMigrationPath},target=/app/node_modules/@dfragon/database/prisma/migrations,readonly`,
      imageId
    ],
    { allowFailure: true }
  )
  assert.equal(failedMigration.code, 1)
  assert.equal(failedMigration.stdout, '')
  assert.equal(failedMigration.stderr, 'API failed to start\n')
  // 연결이나 import 실패와 구분하려고, fixture의 두 번째 문장이 실제로 실패했는지 PostgreSQL 로그로 확인한다.
  assert.match((await docker(['logs', postgresName])).stderr, pgcryptoPermissionDeniedPattern)
  // Prisma는 실패한 migration을 실패로 기록해 해결하기 전까지 다음 적용을 막는다. BEGIN, COMMIT으로 감싼 앞 문장은 되돌려진다.
  assert.equal(
    (
      await psql('SELECT migration_name, finished_at IS NULL FROM _prisma_migrations')
    ).stdout.trim(),
    '20000101000000_failing_migration|t'
  )
  assert.equal(
    (await psql("SELECT to_regclass('public.failing_migration_probe') IS NULL")).stdout.trim(),
    't'
  )
  assert.equal(await advisoryLockCount(true), 0)

  stage = 'invalid database inputs fail closed'
  const wrongPasswordMount = [
    '--mount',
    `type=bind,source=${join(directory, 'wrong_db_password')},target=/run/secrets/db_password,readonly`
  ]
  for (const invalid of [
    [...databaseEnvironment, ...wrongPasswordMount],
    databaseEnvironment,
    ['--env', `DB_HOST=${postgresName}`, ...wrongPasswordMount],
    ['--env', 'DB_PORT=5432', '--env', 'DB_PASSWORD=synthetic']
  ]) {
    const result = await docker(
      ['run', '--rm', '--name', failureName, ...runtimeOptions, ...invalid, imageId],
      { allowFailure: true }
    )
    assert.equal(result.code, 1)
    assert.equal(result.signal, null)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'API failed to start\n')
  }
} catch {
  process.stderr.write(`api database image verification failed at ${stage}\n`)
  process.exitCode = 1
} finally {
  const cleanup = [
    ...[...apiNames, failureName, postgresName].map((name) => () => removeOwned(name)),
    async () => {
      if (networkCreated) {
        await docker(['network', 'rm', networkName])
      }
    },
    async () => {
      if (directory) {
        await rm(directory, { recursive: true, force: true })
      }
    }
  ]
  for (const operation of cleanup) {
    try {
      await operation()
    } catch {
      process.stderr.write('api database image test resource cleanup failed\n')
      process.exitCode = 1
    }
  }
}
if (process.exitCode === undefined) {
  process.stdout.write('PASS: api image migration on startup, HTTP and database input rejection\n')
}
