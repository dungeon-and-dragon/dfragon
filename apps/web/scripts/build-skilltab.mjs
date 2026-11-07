import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { PNG } from 'pngjs'

// 게임 클라이언트에서 뽑은 스킬 창 묶음(skilltab.json과 icons/<jobId>/<skillId>.png)을 고치지 않고, 직업마다 아이콘을
// 한 장으로 묶은 sprite와 sprite 안 위치를 적은 웹용 skilltab.json을 따로 만든다. --extras에 같은 판의 detail-extras
// 묶음(skillstyle.json, oath.json, icons/)을 주면 스킬에 개화와 강화를 붙이고, 서약 탭용 oath.json을 함께 만든다.
// --oath-items에 서약 아이템 아이콘 묶음(index.json과 webp)을 주면 oath.json에 이름과 등급별 아이콘을 싣는다.
const ICON_SIZE = 28
const SPRITE_COLUMNS = 16
const PVF_SHA256 = /^[0-9a-f]{64}$/
const ENHANCEMENT_TYPES = ['1', '2']
const ENHANCEMENT_TAG_TEXT = { '[damage]': '데미지 증가', '[cooltime]': '쿨타임 감소' }
const OATH_RARITY_FILES = ['rare', 'unique', 'legendary', 'epic', 'primitive']

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { extras: { type: 'string' }, 'oath-items': { type: 'string' } }
})
if (positionals.length !== 2) {
  throw new Error(
    'Usage: build-skilltab.mjs [--extras <detail-extras 폴더> [--oath-items <서약 아이콘 폴더>]] <묶음 폴더> <출력 폴더>'
  )
}
const [bundleDir, outDir] = positionals
const extrasDir = values.extras
const oathItemsDir = values['oath-items']
if (oathItemsDir !== undefined && extrasDir === undefined) {
  throw new Error('--oath-items는 서약 데이터를 만드는 --extras와 함께 줘야 합니다.')
}

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

async function readJson(dir, file, format) {
  const json = JSON.parse(await readFile(join(dir, file), 'utf8'))
  if (format !== undefined && json.format !== format) {
    throw new Error(`${file}의 format이 ${format}이 아닙니다: ${json.format}`)
  }

  if (json.pvfSha256 !== bundle.pvfSha256) {
    throw new Error(`${file}의 PVF 판이 스킬 창 묶음과 다릅니다: ${json.pvfSha256}`)
  }

  return json
}

// 아이콘은 이름에 내용 hash를 붙여 복사하므로 같은 판을 다시 만들어도 옛 캐시와 섞이지 않는다.
async function copyIcon(path, folder) {
  const body = await readFile(join(extrasDir, path))
  PNG.sync.read(body)
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 8)
  const name = basename(path, '.png')
  const iconPath = `${version}/${folder}/${name}.${hash}.png`
  await writeFile(join(outDir, iconPath), body)

  return iconPath
}

function isWebp(body) {
  return body.toString('latin1', 0, 4) === 'RIFF' && body.toString('latin1', 8, 12) === 'WEBP'
}

async function copyOathItemIcon(file) {
  const body = await readFile(join(oathItemsDir, file))
  if (!isWebp(body)) {
    throw new Error(`서약 아이콘이 webp가 아닙니다: ${file}`)
  }
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 8)
  const iconPath = `${version}/oath-item/${basename(file, '.webp')}.${hash}.webp`
  await writeFile(join(outDir, iconPath), body)

  return iconPath
}

async function buildOathItems() {
  const { format, items } = JSON.parse(await readFile(join(oathItemsDir, 'index.json'), 'utf8'))
  if (format !== 'oath-items-1') {
    throw new Error(`서약 아이콘 index.json의 format이 oath-items-1이 아닙니다: ${format}`)
  }
  const icons = []
  for (const { name, rarity, file } of items) {
    icons.push({ name, rarity, icon: await copyOathItemIcon(file) })
  }

  return icons
}

// 강화 값의 화면 단위를 확인하지 못해 숫자는 싣지 않고, 바뀌는 값의 종류만 문장으로 둔다.
function enhancementOf(rows) {
  const tags = new Set(rows.map(({ tag }) => tag))
  const explain = Object.entries(ENHANCEMENT_TAG_TEXT)
    .filter(([tag]) => tags.has(tag))
    .map(([, text]) => text)
    .join(', ')

  return { explain }
}

function upgradesOf(style) {
  const upgrades = {}
  if (style.evolution != null) {
    upgrades.evolution = style.evolution.map(({ name, basicExplain, explain }) => ({
      name,
      basicExplain,
      explain
    }))
  }

  if (style.enhancement != null) {
    upgrades.enhancement = Object.fromEntries(
      ENHANCEMENT_TYPES.map((type) => [type, enhancementOf(style.enhancement[type] ?? [])])
    )
  }

  return upgrades
}

async function buildJob(job, skillStyles) {
  const skillIds = Object.keys(job.skills).sort((left, right) => Number(left) - Number(right))
  const rows = Math.ceil(skillIds.length / SPRITE_COLUMNS)
  const sprite = new PNG({ width: SPRITE_COLUMNS * ICON_SIZE, height: rows * ICON_SIZE })
  const skills = {}
  for (const [index, skillId] of skillIds.entries()) {
    const { icon, ...skill } = job.skills[skillId]
    const x = (index % SPRITE_COLUMNS) * ICON_SIZE
    const y = Math.floor(index / SPRITE_COLUMNS) * ICON_SIZE
    PNG.bitblt(await readIcon(icon), sprite, 0, 0, ICON_SIZE, ICON_SIZE, x, y)
    skills[skillId] = { ...skill, icon: { x, y }, ...upgradesOf(skillStyles?.[skillId] ?? {}) }
  }
  const body = PNG.sync.write(sprite, { deflateLevel: 9 })
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 8)
  const spritePath = `${version}/sprites/${job.jobId}.${hash}.png`
  await writeFile(join(outDir, spritePath), body)

  return { ...job, sprite: spritePath, skills }
}

async function buildMarks() {
  const marks = { evolution: [], enhancement: [] }
  for (const kind of Object.keys(marks)) {
    for (const type of ENHANCEMENT_TYPES) {
      marks[kind].push(await copyIcon(`icons/${kind}-${type}.png`, 'marks'))
    }
  }

  return marks
}

// 등급 파일 이름에 _1이 붙은 세트 일치 변형은 화면이 쓰지 않아 뺀다.
async function buildOath() {
  const oath = await readJson(extrasDir, 'oath.json', 'oath-1')
  const sets = []
  for (const set of oath.sets) {
    const options = []
    for (const option of set.options) {
      const effects = Object.fromEntries(
        OATH_RARITY_FILES.map((file) => [file, option.effects[file] ?? null])
      )
      options.push({ name: option.name, icon: await copyIcon(option.icon, 'oath'), effects })
    }
    const icon = set.icon != null ? await copyIcon(set.icon, 'oath-set') : null
    sets.push({ setId: set.setId, name: set.name, icon, options })
  }

  const items = oathItemsDir !== undefined ? await buildOathItems() : []

  return { pvfSha256: oath.pvfSha256, sets, items }
}

await mkdir(join(outDir, version, 'sprites'), { recursive: true })
let skillStyles = null
let marks
if (extrasDir !== undefined) {
  skillStyles = (await readJson(extrasDir, 'skillstyle.json', 'skillstyle-1')).jobs
  for (const folder of ['marks', 'oath', 'oath-set', 'oath-item']) {
    await mkdir(join(outDir, version, folder), { recursive: true })
  }
  marks = await buildMarks()
  await writeFile(join(outDir, 'oath.json'), JSON.stringify(await buildOath()))
}
const jobs = []
for (const job of bundle.jobs) {
  jobs.push(await buildJob(job, skillStyles?.[job.jobId]))
}
await writeFile(
  join(outDir, 'skilltab.json'),
  JSON.stringify({ pvfSha256: bundle.pvfSha256, marks, jobs })
)
process.stderr.write(
  `${jobs.length}개 직업의 sprite를 ${join(outDir, version, 'sprites')}에 만들었습니다.\n`
)
