import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { PNG } from 'pngjs'

// 게임 클라이언트에서 뽑은 스킬 창 묶음(skilltab.json과 icons/<jobId>/<skillId>.png)을 고치지 않고, 직업마다 아이콘을
// 한 장으로 묶은 sprite와 sprite 안 위치를 적은 웹용 skilltab.json을 따로 만든다.
const ICON_SIZE = 28
const SPRITE_COLUMNS = 16
const PVF_SHA256 = /^[0-9a-f]{64}$/

const { positionals } = parseArgs({ allowPositionals: true })
if (positionals.length !== 2) {
  throw new Error('Usage: build-skilltab.mjs <묶음 폴더> <출력 폴더>')
}
const [bundleDir, outDir] = positionals

const outEntries = await readdir(outDir).catch(() => [])
if (outEntries.length > 0) {
  throw new Error(`출력 폴더가 비어 있지 않습니다: ${outDir}`)
}

const bundle = JSON.parse(await readFile(join(bundleDir, 'skilltab.json'), 'utf8'))
if (!PVF_SHA256.test(bundle.pvfSha256)) {
  throw new Error(`pvfSha256이 64자리 hex가 아닙니다: ${bundle.pvfSha256}`)
}
// 폴더는 PVF 해시 앞 8자리로 판을 구분하고, sprite 이름의 내용 hash로 같은 판을 다시 만들어도 옛 캐시와 섞이지 않게 한다.
const version = bundle.pvfSha256.slice(0, 8)

async function readIcon(path) {
  const icon = PNG.sync.read(await readFile(join(bundleDir, path)))
  if (icon.width !== ICON_SIZE || icon.height !== ICON_SIZE) {
    throw new Error(
      `아이콘이 ${ICON_SIZE}×${ICON_SIZE}이 아닙니다: ${path} (${icon.width}×${icon.height})`
    )
  }

  return icon
}

async function buildJob(job) {
  const skillIds = Object.keys(job.skills).sort((left, right) => Number(left) - Number(right))
  const rows = Math.ceil(skillIds.length / SPRITE_COLUMNS)
  const sprite = new PNG({ width: SPRITE_COLUMNS * ICON_SIZE, height: rows * ICON_SIZE })
  const skills = {}
  for (const [index, skillId] of skillIds.entries()) {
    const { icon, ...skill } = job.skills[skillId]
    const x = (index % SPRITE_COLUMNS) * ICON_SIZE
    const y = Math.floor(index / SPRITE_COLUMNS) * ICON_SIZE
    PNG.bitblt(await readIcon(icon), sprite, 0, 0, ICON_SIZE, ICON_SIZE, x, y)
    skills[skillId] = { ...skill, icon: { x, y } }
  }
  const body = PNG.sync.write(sprite, { deflateLevel: 9 })
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 8)
  const spritePath = `${version}/sprites/${job.jobId}.${hash}.png`
  await writeFile(join(outDir, spritePath), body)

  return { ...job, sprite: spritePath, skills }
}

await mkdir(join(outDir, version, 'sprites'), { recursive: true })
const jobs = []
for (const job of bundle.jobs) {
  jobs.push(await buildJob(job))
}
await writeFile(
  join(outDir, 'skilltab.json'),
  JSON.stringify({ pvfSha256: bundle.pvfSha256, jobs })
)
process.stderr.write(
  `${jobs.length}개 직업의 sprite를 ${join(outDir, version, 'sprites')}에 만들었습니다.\n`
)
