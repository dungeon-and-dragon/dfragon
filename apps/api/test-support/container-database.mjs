import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
const timelineReadCheckPath = fileURLToPath(
  new URL('./container-timeline-read-check.mjs', import.meta.url)
)
const backfillCheckPath = fileURLToPath(new URL('./container-backfill-check.mjs', import.meta.url))
const seasonBackfillCheckPath = fileURLToPath(
  new URL('./container-season-backfill-check.mjs', import.meta.url)
)
const characterCheckPath = fileURLToPath(
  new URL('./container-character-check.mjs', import.meta.url)
)
const collectionCheckPath = fileURLToPath(
  new URL('./container-collection-check.mjs', import.meta.url)
)
const adventureGuildCheckPath = fileURLToPath(
  new URL('./container-adventure-guild-check.mjs', import.meta.url)
)
const rankingStatsCheckPath = fileURLToPath(
  new URL('./container-ranking-stats-check.mjs', import.meta.url)
)
const skillStyleCheckPath = fileURLToPath(
  new URL('./container-skill-style-check.mjs', import.meta.url)
)
const skillAdoptionCheckPath = fileURLToPath(
  new URL('./container-skill-adoption-check.mjs', import.meta.url)
)
const maleCrusaderRoleCheckPath = fileURLToPath(
  new URL('./container-male-crusader-role-check.mjs', import.meta.url)
)
const statsSnapshotCheckPath = fileURLToPath(
  new URL('./container-stats-snapshot-check.mjs', import.meta.url)
)
const contentClearCheckPath = fileURLToPath(
  new URL('./container-content-clear-check.mjs', import.meta.url)
)
const opsCheckPath = fileURLToPath(new URL('./container-ops-check.mjs', import.meta.url))
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

  stage = 'max fame migration backfill'
  const maxFameMigration = await readFile(
    new URL(
      '../../../packages/database/prisma/migrations/20261111120000_add_character_max_fame/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  assert.equal(
    (
      await psql(
        `CREATE TEMP TABLE characters (fame integer); INSERT INTO characters VALUES (61234), (0), (NULL); ${maxFameMigration} SELECT count(*) FROM characters WHERE max_fame IS DISTINCT FROM fame`
      )
    ).stdout
      .trim()
      .split('\n')
      .at(-1),
    '0'
  )

  stage = 'content clear reopen migration'
  const reopenMigration = await readFile(
    new URL(
      '../../../packages/database/prisma/migrations/20261111180000_reopen_content_clear_weeks/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  assert.equal(
    (
      await psql(
        `CREATE TEMP TABLE content_clear_populations (closed boolean); INSERT INTO content_clear_populations VALUES (true), (false); CREATE TEMP TABLE content_clear_collections (started_at timestamptz); INSERT INTO content_clear_collections VALUES (now()); ${reopenMigration} SELECT (SELECT count(*) FROM content_clear_populations WHERE closed) || '/' || (SELECT count(*) FROM content_clear_populations) || '/' || (SELECT count(*) FROM content_clear_collections)`
      )
    ).stdout
      .trim()
      .split('\n')
      .at(-1),
    '0/2/0'
  )

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
        '--env',
        'OPS_PORT=3001',
        '--mount',
        `type=bind,source=${join(directory, 'db_password')},target=/run/secrets/db_password,readonly`,
        '--mount',
        `type=bind,source=${opsCheckPath},target=/app/container-ops-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${runtimeCheckPath},target=/app/container-runtime-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${timelineCheckPath},target=/app/container-timeline-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${timelineReadCheckPath},target=/app/container-timeline-read-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${backfillCheckPath},target=/app/container-backfill-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${seasonBackfillCheckPath},target=/app/container-season-backfill-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${characterCheckPath},target=/app/container-character-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${collectionCheckPath},target=/app/container-collection-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${adventureGuildCheckPath},target=/app/container-adventure-guild-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${rankingStatsCheckPath},target=/app/container-ranking-stats-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${skillStyleCheckPath},target=/app/container-skill-style-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${skillAdoptionCheckPath},target=/app/container-skill-adoption-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${maleCrusaderRoleCheckPath},target=/app/container-male-crusader-role-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${contentClearCheckPath},target=/app/container-content-clear-check.mjs,readonly`,
        '--mount',
        `type=bind,source=${statsSnapshotCheckPath},target=/app/container-stats-snapshot-check.mjs,readonly`,
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
    '19'
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
    'timeline_items_season_10,timeline_items_season_11,timeline_items_season_5,timeline_items_season_6,timeline_items_season_7,timeline_items_season_8,timeline_items_season_9'
  )
  assert.equal(
    (
      await psql("SELECT string_agg(id || ':' || name, ',' ORDER BY starts_at) FROM seasons")
    ).stdout.trim(),
    '5:마계,6:할렘,7:귀환,8:THE NEXT JOURNEY,9:선계,10:중천,11:천해천'
  )
  // 시즌마다 시작 분과 끝 분의 행이 그 시즌 partition에 들어가야 partition 사이에 빈틈과 경계 어긋남이 없다.
  const probeTimes = [
    '2017-09-21 00:00',
    '2018-08-09 05:59',
    '2018-08-09 06:00',
    '2020-01-09 05:59',
    '2020-01-09 06:00',
    '2022-03-17 05:59',
    '2022-03-17 06:00',
    '2023-09-14 05:59',
    '2023-09-14 06:00',
    '2025-01-09 05:59',
    '2025-01-09 06:00',
    '2026-03-26 05:59',
    '2026-03-26 06:00',
    '2099-01-01 00:00'
  ]
  const probeValues = probeTimes.map((time) => `'${time}+09'`).join(',')
  assert.equal(
    (
      await psql(
        `WITH probe AS (INSERT INTO timeline_items (server_id, character_id, code, occurred_at, name, data) SELECT 'cain', 'partition-probe', 401, time::timestamptz, 'probe', '{}' FROM unnest(ARRAY[${probeValues}]) AS time RETURNING occurred_at, tableoid::regclass AS partition) SELECT string_agg(partition::text, ',' ORDER BY occurred_at) FROM probe`
      )
    ).stdout.trim(),
    [5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
      .map((season) => `timeline_items_season_${season}`)
      .join(',')
  )
  await psql("DELETE FROM timeline_items WHERE character_id = 'partition-probe'")
  // Neople이 주지 않는 2017-09-21 전 행은 들어갈 partition이 없다.
  await assert.rejects(
    psql(
      "INSERT INTO timeline_items (server_id, character_id, code, occurred_at, name, data) VALUES ('cain', 'partition-probe', 401, '2017-09-20 23:59+09', 'probe', '{}')"
    )
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

  stage = 'enhancement backfill'
  // 백필 구간 안의 강화류가 아닌 행과 백필 구간 밖의 증폭 행은 남아야 한다.
  await psql(
    "INSERT INTO timeline_items (server_id, character_id, code, occurred_at, name, data) VALUES ('cain', 'synthetic-character', 505, '2020-01-01 00:00+09', 'kept-backfill', '{}'), ('cain', 'synthetic-character', 402, '2020-02-01 00:01+09', 'kept-backfill', '{}')"
  )
  const backfill = () =>
    docker([
      'exec',
      '--env',
      'DB_PASSWORD_FILE=/run/secrets/db_password',
      apiNames[0],
      'node',
      '/app/container-backfill-check.mjs'
    ])
  // 같은 구간을 다시 받아도 행이 늘지 않고, 정기 동기화 위치는 그대로다.
  for (let run = 0; run < 2; run++) {
    await backfill()
    assert.equal(
      (
        await psql(
          "SELECT tableoid::regclass, code, data->>'after' FROM timeline_items WHERE name = '아이템 증폭'"
        )
      ).stdout.trim(),
      'timeline_items_season_6|402|10'
    )
  }
  assert.equal(
    (await psql("SELECT count(*) FROM timeline_items WHERE name = 'kept-backfill'")).stdout.trim(),
    '2'
  )
  assert.equal(
    (
      await psql(
        "SELECT synced_until = '2026-04-01 00:00+09', enhancement_backfilled_until = '2020-02-01 00:00+09' FROM timeline_sync_state"
      )
    ).stdout.trim(),
    't|t'
  )

  stage = 'old season backfill'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-season-backfill-check.mjs'
  ])

  stage = 'timeline read'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-timeline-read-check.mjs'
  ])

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
    'collect-failed:neople-api,collect-no-basic:-,collect-schema:-'
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

  stage = 'adventure and guild reads'
  assert.equal(
    (
      await psql("SELECT indexdef FROM pg_indexes WHERE indexname = 'characters_guild_id_idx'")
    ).stdout.trim(),
    'CREATE INDEX characters_guild_id_idx ON public.characters USING btree (guild_id)'
  )
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-adventure-guild-check.mjs'
  ])

  stage = 'stats snapshot tables'
  // 통계 저장분은 한 행만 두고, 스킬 채택률의 역할은 전체, 딜러, 버퍼만 받는다.
  await psql(
    "INSERT INTO character_stats (id, computed_at, total, servers, jobs, fame_distribution) VALUES (1, now(), 0, '[]', '[]', '[]')"
  )
  await assert.rejects(
    psql(
      "INSERT INTO character_stats (id, computed_at, total, servers, jobs, fame_distribution) VALUES (2, now(), 0, '[]', '[]', '[]')"
    )
  )
  await assert.rejects(
    psql(
      "INSERT INTO job_skill_adoption (job_id, job_grow_id, role, computed_at, sample_size, skills, evolutions, enhancements) VALUES ('probe-job', 'probe-grow', 'unknown', now(), 0, '[]', '[]', '[]')"
    )
  )
  await psql('DELETE FROM character_stats')

  stage = 'fame ranking and stats reads'
  assert.equal(
    (
      await psql(
        "SELECT string_agg(indexdef, E'\\n' ORDER BY indexname) FROM pg_indexes WHERE indexname LIKE 'characters_%fame_idx'"
      )
    ).stdout.trim(),
    [
      'CREATE INDEX characters_fame_idx ON public.characters USING btree (fame DESC)',
      'CREATE INDEX characters_job_id_fame_idx ON public.characters USING btree (job_id, fame DESC)',
      'CREATE INDEX characters_job_id_job_grow_id_fame_idx ON public.characters USING btree (job_id, job_grow_id, fame DESC)',
      'CREATE INDEX characters_max_fame_idx ON public.characters USING btree (max_fame DESC)'
    ].join('\n')
  )
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-ranking-stats-check.mjs'
  ])

  stage = 'skill style upsert'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-skill-style-check.mjs'
  ])
  // 새로 받은 값은 이전 행을 바꾸고, 그보다 예전에 받은 값과 다른 캐릭터의 저장은 그 행을 바꾸지 않는다.
  assert.equal(
    (
      await psql(
        "SELECT string_agg(character_id || ':' || job_grow_id || ':' || skills::text || ':' || evolutions::text || ':' || enhancements::text || ':' || to_char(fetched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), E'\\n' ORDER BY character_id) FROM character_skill_styles"
      )
    ).stdout.trim(),
    [
      'skill-a:synthetic-skill-grow:[{"name": "합성A2", "level": 13}]:[{"name": "합성A2", "type": 1}]:[{"name": "합성A2", "type": 2}]:2026-11-07',
      'skill-b:synthetic-skill-grow:[{"name": "합성B", "level": 1}]:[{"name": "합성B", "type": 1}]:[{"name": "합성B", "type": 2}]:2026-11-01'
    ].join('\n')
  )
  // 캐릭터 행을 지우면 스킬 스타일 행도 함께 지워진다.
  await psql("DELETE FROM characters WHERE server_id = 'cain' AND character_id = 'skill-b'")
  assert.equal(
    (await psql("SELECT string_agg(character_id, ',') FROM character_skill_styles")).stdout.trim(),
    'skill-a'
  )

  stage = 'skill adoption reads'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-skill-adoption-check.mjs'
  ])

  stage = 'male crusader role reads'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-male-crusader-role-check.mjs'
  ])

  stage = 'stats snapshot jobs'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-stats-snapshot-check.mjs'
  ])

  stage = 'content clear records'
  await docker([
    'exec',
    '--env',
    'DB_PASSWORD_FILE=/run/secrets/db_password',
    apiNames[0],
    'node',
    '/app/container-content-clear-check.mjs'
  ])
  assert.equal(
    (
      await psql("SELECT indexdef FROM pg_indexes WHERE indexname = 'content_clears_challenge_key'")
    ).stdout.trim(),
    "CREATE UNIQUE INDEX content_clears_challenge_key ON public.content_clears USING btree (content_id, server_id, character_id) WHERE (kind = 'challenge'::text)"
  )

  stage = 'job run uniqueness'
  assert.equal(
    (
      await psql("SELECT indexdef FROM pg_indexes WHERE indexname = 'job_runs_active_key'")
    ).stdout.trim(),
    "CREATE UNIQUE INDEX job_runs_active_key ON public.job_runs USING btree (job_name) WHERE (status = ANY (ARRAY['requested'::text, 'running'::text]))"
  )
  const insertProbeRun = (status) =>
    psql(
      `INSERT INTO job_runs (job_name, trigger, status, args) VALUES ('probe-job', 'manual', '${status}', '{}')`
    )
  await insertProbeRun('requested')
  await assert.rejects(insertProbeRun('requested'))
  await assert.rejects(insertProbeRun('running'))
  await insertProbeRun('succeeded')
  await psql(
    "INSERT INTO job_runs (job_name, trigger, status, args) VALUES ('other-probe-job', 'manual', 'requested', '{}')"
  )
  await psql(
    "UPDATE job_runs SET status = 'failed' WHERE job_name = 'probe-job' AND status = 'requested'"
  )
  await insertProbeRun('requested')
  assert.equal(
    (
      await psql("SELECT string_agg(job_name || ':' || status, ',' ORDER BY id) FROM job_runs")
    ).stdout.trim(),
    'probe-job:failed,probe-job:succeeded,other-probe-job:requested,probe-job:requested'
  )
  await assert.rejects(
    psql(
      "INSERT INTO job_runs (job_name, trigger, status, args) VALUES ('probe-job', 'unknown', 'succeeded', '{}')"
    )
  )
  await psql('DELETE FROM job_runs')
  // 시작한 worker가 interrupted로 바꿀 행과, 이력 정리 job이 지울 90일 지난 행과 남길 행이다.
  await psql(
    [
      "INSERT INTO job_runs (job_name, trigger, status, args, started_at) VALUES ('job-run-cleanup', 'schedule', 'running', '{}', now())",
      "INSERT INTO job_runs (job_name, trigger, status, args, finished_at) VALUES ('expired-probe', 'manual', 'succeeded', '{}', now() - interval '91 days'), ('kept-probe', 'manual', 'succeeded', '{}', now() - interval '89 days')"
    ].join('; ')
  )

  // 클리어 수집 job은 정지해 두어 보충 실행으로 Neople을 부르지 않는다. 다시 등록해도 정지 시각은 남는다.
  await psql(
    "INSERT INTO jobs (name, display_name, args_schema, delay_minutes, paused_at, worker_seen_at) VALUES ('content-clear-collection', 'probe', '{}', 0, now(), now())"
  )

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
    'CHARACTER_IMPORT_FILES=/data/1/characters.jsonl,/data/2/characters.jsonl',
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
  stage = 'character collector registers jobs and runs each missed job once'
  await waitFor(
    async () =>
      (
        await psql(
          "SELECT count(*) FROM job_runs WHERE trigger = 'catchup' AND status IN ('succeeded', 'failed')"
        )
      ).stdout.trim() === '3'
  )
  assert.equal(
    (
      await psql(
        "SELECT string_agg(name || ':' || schedule || ':' || (next_run_at > now()) || ':' || (args_schema->>'type') || ':' || (paused_at IS NOT NULL), ',' ORDER BY name) FROM jobs"
      )
    ).stdout.trim(),
    'character-stats:0 0 * * *:true:object:false,content-clear-collection:0 6 * * *:true:object:true,job-run-cleanup:0 4 * * *:true:object:false,skill-adoption:0 0 * * *:true:object:false'
  )
  assert.equal(
    (
      await psql(
        "SELECT string_agg(job_name || ':' || trigger || ':' || status || ':' || coalesce(summary::text, '-'), ',' ORDER BY id) FROM job_runs WHERE job_name NOT IN ('character-stats', 'skill-adoption')"
      )
    ).stdout.trim(),
    'job-run-cleanup:schedule:interrupted:-,kept-probe:manual:succeeded:-,job-run-cleanup:catchup:succeeded:{"deleted": 1}'
  )
  // 통계 저장분은 이번 실행이 시작한 뒤에 계산했고, 스킬 채택률 진행률은 전직 수만큼 끝까지 남는다.
  assert.equal(
    (
      await psql(
        "SELECT r.status || ':' || (s.computed_at >= r.started_at) FROM job_runs r, character_stats s WHERE r.job_name = 'character-stats'"
      )
    ).stdout.trim(),
    'succeeded:true'
  )
  assert.equal(
    (
      await psql(
        "SELECT status || ':' || (progress_done = progress_total) || ':' || (progress_total = (summary->>'jobGrows')::int) || ':' || (progress_total > 0) || ':' || (summary->>'deleted') FROM job_runs WHERE job_name = 'skill-adoption'"
      )
    ).stdout.trim(),
    'succeeded:true:true:true:0'
  )

  stage = 'character collector runs requested jobs'
  const requestCleanup = async (args) => {
    await psql(
      `INSERT INTO job_runs (job_name, trigger, status, args) VALUES ('job-run-cleanup', 'manual', 'requested', '${args}')`
    )
    await waitFor(
      async () =>
        (
          await psql("SELECT count(*) FROM job_runs WHERE status IN ('requested', 'running')")
        ).stdout.trim() === '0'
    )
  }
  await requestCleanup('[]')
  await requestCleanup('{}')
  assert.equal(
    (
      await psql(
        "SELECT string_agg(status || ':' || coalesce(error->0->>'code', '-') || ':' || coalesce(summary::text, '-'), ',' ORDER BY id) FROM job_runs WHERE trigger = 'manual' AND job_name = 'job-run-cleanup'"
      )
    ).stdout.trim(),
    'failed:INVALID_JOB_ARGS:-,succeeded:-:{"deleted": 0}'
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

  stage = 'ops port reads and writes jobs'
  // 멈춘 worker가 요청 행을 집지 않아 요청됨 상태와 중복 거절을 그대로 확인한다.
  await psql(
    "INSERT INTO jobs (name, display_name, schedule, args_schema, delay_minutes, worker_seen_at) VALUES ('ops-probe', 'ops probe', NULL, '{}', 10, now())"
  )
  await psql(
    "INSERT INTO character_collection (server_id, character_id, queued_at, attempted_at, failure) VALUES ('cain', 'ops-waiting', '2026-11-09T00:00:00Z', NULL, NULL), ('cain', 'ops-api', '2026-11-08T00:00:00Z', '2026-11-08T01:00:00Z', 'neople-api'), ('cain', 'ops-internal', '2026-11-08T00:00:00Z', '2026-11-08T02:00:00Z', 'neople-internal')"
  )
  await docker(['exec', apiNames[0], 'node', '/app/container-ops-check.mjs'])
  assert.equal(
    (
      await psql(
        "SELECT string_agg(character_id || ':' || coalesce(failure, '-') || ':' || (attempted_at IS NULL), ',' ORDER BY character_id) FROM character_collection"
      )
    ).stdout.trim(),
    'ops-api:-:true,ops-internal:-:true,ops-waiting:-:true'
  )
  await psql('DELETE FROM character_collection')
  assert.equal(
    (
      await psql(
        "SELECT string_agg(label || ':' || key || ':' || enabled || ':' || (rejected_at IS NULL), ',') FROM batch_neople_keys"
      )
    ).stdout.trim(),
    'stored:synthetic-container-batch-key-4e7d:true:true'
  )
  await psql('DELETE FROM batch_neople_keys')
  assert.equal(
    (
      await psql(
        "SELECT string_agg(job_name || ':' || status || ':' || args::text, ',') FROM job_runs WHERE status = 'requested'"
      )
    ).stdout.trim(),
    'job-run-cleanup:requested:{"probe": true}'
  )
  assert.equal(
    (await psql("SELECT paused_at IS NULL FROM jobs WHERE name = 'job-run-cleanup'")).stdout.trim(),
    't'
  )
  await psql(
    "DELETE FROM job_runs WHERE status = 'requested'; DELETE FROM jobs WHERE name = 'ops-probe'"
  )
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
    'PASS: api image migration on startup, timeline replacement, old season backfill and read, character records, adventure and guild reads, fame ranking and stats reads, stats snapshot tables and jobs, job run uniqueness, character collector job registration, requested runs, start and stop, ops port job, queue, collection and batch Neople key routes, HTTP and database input rejection\n'
  )
}
