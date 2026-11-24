import { type SkillWindow, type SkillWindowIcon, skillMarkOf, SkillSprite } from '#entities/catalog'
import { type SkillAdoptionSource, SkillAdoptionHover } from './SkillAdoptionTooltip'
import { ENHANCEMENT_MARK, EVOLUTION_MARK } from './skill-classes'

const COMMON_ROW = 0

// 스킬 창은 11열(col 0~10)이다. 아이콘은 직업 sprite에서 28×28씩 잘라 그린다.
const SKILL_WINDOW_COLUMNS = 11
const SKILL_CELL_WIDTH = 44
const SKILL_CELL_HEIGHT = 48
const SKILL_ROW_LABEL_WIDTH = 36
const SKILL_WINDOW_BORDER_WIDTH = 1
const SKILL_WINDOW_WIDTH = SKILL_ROW_LABEL_WIDTH + SKILL_WINDOW_COLUMNS * SKILL_CELL_WIDTH
const SKILL_WINDOW_OUTER_WIDTH = SKILL_WINDOW_WIDTH + 2 * SKILL_WINDOW_BORDER_WIDTH

// 스킬 창은 열 폭에 맞춰 커지고 지금 크기보다 작아지지 않는다. sprite의 전체 크기를 모르므로
// background-size 대신 zoom으로 아이콘을 키우는데, zoom은 단위 없는 수만 받아 tan(atan2())로 길이 비율을 수로 바꾼다.
// 배율이 열 폭에서 정해져 Tailwind CSS class로 적을 수 없어 길이는 style로 준다.
const SKILL_WINDOW_SCALE = `max(1, tan(atan2(100cqi, ${SKILL_WINDOW_OUTER_WIDTH}px)))`
const SKILL_WINDOW_UNIT = `(${SKILL_WINDOW_SCALE} * 1px)`

const scaled = (px: number): string => `calc(${px} * ${SKILL_WINDOW_UNIT})`

const ROW_LABEL_SIZE = {
  width: scaled(SKILL_ROW_LABEL_WIDTH),
  height: scaled(SKILL_CELL_HEIGHT),
  fontSize: scaled(11),
  lineHeight: scaled(14)
}
const ROW_LINE_BORDER = { borderTop: `${scaled(1)} solid var(--color-line)` }
const ICON_SIZE = {
  width: scaled(SKILL_CELL_WIDTH),
  height: scaled(SKILL_CELL_HEIGHT),
  gap: scaled(4)
}
const LEVEL_SIZE = { height: scaled(10), fontSize: scaled(10), lineHeight: scaled(10) }

function SkillIcon({
  icon,
  source
}: {
  icon: SkillWindowIcon
  source: SkillAdoptionSource
}): React.JSX.Element {
  const picked = icon.evolution !== null || icon.enhancement !== null

  return (
    <SkillAdoptionHover
      skill={icon}
      source={source}
      trigger={
        <span
          data-skill-id={icon.skillId}
          className="absolute flex flex-col items-center justify-center border-0 bg-transparent p-0 text-inherit"
          style={{
            ...ICON_SIZE,
            left: scaled(SKILL_ROW_LABEL_WIDTH + icon.col * SKILL_CELL_WIDTH),
            top: scaled(icon.row * SKILL_CELL_HEIGHT)
          }}
        />
      }
    >
      {/* zoom은 아이콘과 함께 개화, 강화 표식과 선택 테두리도 같은 배율로 키운다. */}
      <span
        className={`relative block select-none ${picked ? 'outline-1 -outline-offset-1 outline-solid outline-signal shadow-selected' : ''}`}
        style={{ zoom: SKILL_WINDOW_SCALE }}
      >
        <SkillSprite icon={icon.icon} label={icon.name} dim={!icon.learned} />
        {icon.evolution !== null && (
          <img
            src={skillMarkOf(source.marks, 'evolution', icon.evolution)}
            alt=""
            draggable={false}
            className={EVOLUTION_MARK}
          />
        )}
        {icon.enhancement !== null && (
          <img
            src={skillMarkOf(source.marks, 'enhancement', icon.enhancement)}
            alt=""
            draggable={false}
            className={ENHANCEMENT_MARK}
          />
        )}
      </span>
      <span
        className="num font-semibold whitespace-nowrap text-fg-muted select-none"
        style={LEVEL_SIZE}
      >
        {icon.learned && icon.level !== null ? `${icon.level}` : ''}
      </span>
    </SkillAdoptionHover>
  )
}

export function SkillWindowGrid({
  skillWindow,
  source
}: {
  skillWindow: SkillWindow
  source: SkillAdoptionSource
}): React.JSX.Element {
  // 스킬 창은 최소 폭보다 좁은 칸에서 화면 전체가 아니라 스킬 창만 가로로 스크롤한다.
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="@container" style={{ minWidth: SKILL_WINDOW_OUTER_WIDTH }}>
        <div
          role="group"
          aria-label="스킬 창"
          className="relative shrink-0 rounded-control border-solid border-line bg-inset"
          style={{
            borderWidth: scaled(SKILL_WINDOW_BORDER_WIDTH),
            width: scaled(SKILL_WINDOW_WIDTH),
            height: scaled(skillWindow.rows.length * SKILL_CELL_HEIGHT)
          }}
        >
          {skillWindow.rows.map(({ row, requiredLevel }) => (
            <div key={row}>
              {row > COMMON_ROW && (
                <div
                  className="absolute inset-x-0 h-0"
                  style={{ ...ROW_LINE_BORDER, top: scaled(row * SKILL_CELL_HEIGHT) }}
                />
              )}
              <span
                className={`absolute left-0 flex items-center justify-center whitespace-nowrap text-fg-subtle select-none ${row === COMMON_ROW ? '' : 'num'}`}
                style={{ ...ROW_LABEL_SIZE, top: scaled(row * SKILL_CELL_HEIGHT) }}
              >
                {row === COMMON_ROW ? '공용' : requiredLevel}
              </span>
            </div>
          ))}
          {skillWindow.icons.map((icon) => (
            <SkillIcon key={`${icon.col},${icon.row}`} icon={icon} source={source} />
          ))}
        </div>
      </div>
    </div>
  )
}
