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
const timelineCheckPath = fileURLToPath(new URL('./container-timeline-check.mjs', import.meta.url))
const characterCheckPath = fileURLToPath(
  new URL('./container-character-check.mjs', import.meta.url)
)
const collectionCheckPath = fileURLToPath(
  new URL('./container-collection-check.mjs', import.meta.url)
)
const failingMigrationPath = fileURLToPath(new URL('./failing-migration', import.meta.url))
const pgcryptoPermissionDeniedPattern = /permission denied to create extension "pgcrypto"/

const runId = `apidb${randomUUID().replaceAll('-', '')}`
const networkName = `dfragon-db-test-${runId}`
const postgresName = `dfragon-db-test-${runId}-postgres`
const apiNames = [1, 2].map((index) => `dfragon-db-test-${runId}-api-${index}`)
const failureName = `dfragon-db-test-${runId}-failure`
const collectorName = `dfragon-db-test-${runId}-collector`
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
        '--mount',
        `type=bind,source=${timelineCheckPath},target=/app/container-timeline-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${characterCheckPath},target=/app/container-character-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${collectionCheckPath},target=/app/container-collection-check.mjs,readonly`,
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
  assert.equal(
    (
      await psql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
    ).stdout.trim(),
    '2'
  )
  assert.equal(
    (await psql("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")).stdout.trim(),
    '0'
  )

  stage = 'timeline tables'
  assert.equal(
    (
      await psql(
        "SELECT string_agg(relid::text, ',' ORDER BY relid::text) FROM pg_partition_tree('timeline_items') WHERE isleaf"
      )
    ).stdout.trim(),
    'timeline_items_season_1,timeline_items_season_2'
  )
  assert.equal(
    (await psql("SELECT string_agg(name, ',' ORDER BY starts_at) FROM seasons")).stdout.trim(),
    '중천,천해천'
  )
  // 교체 대상이 아닌 행이다. 다른 캐릭터의 같은 시각 행과 같은 캐릭터의 구간 밖 행이다.
  for (const table of ['timeline_events', 'timeline_items']) {
    await psql(
      `INSERT INTO ${table} (server_id, character_id, code, occurred_at, name, data) VALUES ('cain', 'other-character', 201, '2026-04-01 00:00+09', 'kept', '{}'), ('cain', 'synthetic-character', 201, '2026-04-01 00:01+09', 'kept', '{}')`
    )
  }
  const timelineRowCounts = async () =>
    (
      await psql(
        "SELECT (SELECT count(*) FROM timeline_events WHERE name <> 'kept'), (SELECT count(*) FROM timeline_items WHERE name <> 'kept'), (SELECT count(*) FROM timeline_events WHERE name = 'kept') + (SELECT count(*) FROM timeline_items WHERE name = 'kept')"
      )
    ).stdout.trim()
  const replaceTimeline = (copies) =>
    docker([
      'exec',
      '--env',
      'DB_PASSWORD_FILE=/run/secrets/db_password',
      apiNames[0],
      'node',
      '/app/container-timeline-check.mjs',
      String(copies)
    ])
  // 같은 내용의 두 행은 두 행으로 남고, 같은 구간을 다시 교체해도 늘지 않으며 다른 행은 지우지 않는다.
  for (const copies of [2, 2, 1]) {
    await replaceTimeline(copies)
    assert.equal(await timelineRowCounts(), `${copies}|${copies}|4`)
  }
  assert.equal(
    (
      await psql("SELECT item_rarity, data->>'probe' FROM timeline_items WHERE name <> 'kept'")
    ).stdout.trim(),
    '에픽|1'
  )

  stage = 'timeline replacement waits for the character lock'
  // 교체가 캐릭터 lock을 잡지 않으면 겹친 두 교체가 서로의 행을 지우지 못해 행이 두 번 들어간다.
  await docker([
    'exec',
    '--detach',
    postgresName,
    'psql',
    '--host=127.0.0.1',
    '--username=postgres',
    '--dbname=dfragon',
    '--command',
    "SELECT pg_advisory_lock(1175, hashtext('cain/synthetic-character')); SELECT pg_sleep(600)"
  ])
  await waitFor(async () => (await advisoryLockCount(true)) === 1)
  const overlappingReplacements = Promise.all([replaceTimeline(2), replaceTimeline(2)])
  await waitFor(async () => (await advisoryLockCount(false)) === 2)
  await psql(
    "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND granted"
  )
  await overlappingReplacements
  assert.equal(await timelineRowCounts(), '2|2|4')
  assert.equal(
    (
      await psql("SELECT synced_until = '2026-04-01 00:00+09' FROM timeline_sync_state")
    ).stdout.trim(),
    't'
  )

  stage = 'character and adventure'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-character-check.mjs'
  ])
  // 서버가 달라도 한 모험단이고, 모험단 이름이 바뀌어도 모험단 id는 그대로다.
  assert.equal(
    (
      await psql(
        "SELECT string_agg(c.server_id || ':' || c.character_name || ':' || a.name, ',' ORDER BY c.server_id), count(DISTINCT a.id), (SELECT count(*) FROM adventures) FROM characters c JOIN adventures a ON a.id = c.adventure_id"
      )
    ).stdout.trim(),
    'cain:합성A2:새모험단,siroco:합성B:새모험단|1|1'
  )

  stage = 'character collection queue'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-collection-check.mjs'
  ])
  assert.equal(
    (
      await psql(
        "SELECT string_agg(character_id || ':' || coalesce(failure, '-'), ',' ORDER BY character_id) FROM character_collection"
      )
    ).stdout.trim(),
    'collect-failed:neople-api,collect-no-basic:-'
  )
  assert.equal(
    (
      await psql(
        "SELECT c.level || ':' || c.job_grow_name || ':' || a.name || ':' || (c.basic_fetched_at IS NOT NULL) FROM characters c JOIN adventures a ON a.id = c.adventure_id WHERE c.character_id = 'collect-saved'"
      )
    ).stdout.trim(),
    '115:眞 웨펀마스터:합성수집모험단:true'
  )
  await psql('DELETE FROM character_collection')

  stage = 'character collector waits on the empty queue and stops'
  // 대기열이 비어 있어 Neople을 부르지 않는다.
  const collectorOptions = [
    ...runtimeOptions,
    ...databaseEnvironment,
    '--mount',
    `type=bind,source=${join(directory, 'db_password')},target=/run/secrets/db_password,readonly`
  ]
  await docker([
    'run',
    '--detach',
    '--name',
    collectorName,
    ...collectorOptions,
    '--env',
    'CHARACTER_IMPORT_FILE=/data/characters.jsonl',
    imageId,
    'node',
    'dist/character-collector.js'
  ])
  const collectorAddress = (
    await docker([
      'inspect',
      '--format',
      `{{(index .NetworkSettings.Networks "${networkName}").IPAddress}}`,
      collectorName
    ])
  ).stdout.trim()
  await waitFor(
    async () =>
      Number(
        (
          await psql(
            `SELECT count(*) FROM pg_stat_activity WHERE client_addr = '${collectorAddress}'`
          )
        ).stdout.trim()
      ) > 0
  )
  assert.equal(
    (await docker(['inspect', '--format', '{{.State.Running}}', collectorName])).stdout.trim(),
    'true'
  )
  await docker(['stop', '--time', '15', collectorName])
  assert.equal(
    (await docker(['inspect', '--format', '{{.State.ExitCode}}', collectorName])).stdout.trim(),
    // 종료 처리를 두지 않아 SIGTERM의 기본 동작(128 + 15)으로 끝난다.
    '143'
  )
  await removeOwned(collectorName)
  const missingImportFile = await docker(
    [
      'run',
      '--rm',
      '--name',
      collectorName,
      ...collectorOptions,
      imageId,
      'node',
      'dist/character-collector.js'
    ],
    { allowFailure: true }
  )
  assert.equal(missingImportFile.code, 1)
  assert.equal(missingImportFile.stderr, 'Character collector failed\n')

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
      await psql('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL')
    ).stdout.trim(),
    '20000101000000_failing_migration'
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
    ...[...apiNames, failureName, collectorName, postgresName].map(
      (name) => () => removeOwned(name)
    ),
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
  process.stdout.write(
    'PASS: api image migration on startup, timeline replacement, character records, character collector start and stop, HTTP and database input rejection\n'
  )
}
