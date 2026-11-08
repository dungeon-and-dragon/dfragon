import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from '@dfragon/ui/tokens.stylex'

// 스킬 창은 11열(col 0~10)이다. 아이콘은 직업 sprite에서 28×28씩 잘라 그린다.
const SKILL_WINDOW_COLUMNS = 11
const SKILL_ICON_SIZE = 28
const SKILL_CELL_WIDTH = 44
const SKILL_CELL_HEIGHT = 48
const SKILL_ROW_LABEL_WIDTH = 36
const SIDE_COLUMN_WIDTH = 340
const EVOLUTION_MARK_SIZE = 17
const ENHANCEMENT_MARK_SIZE = 18
const SKILL_WINDOW_BORDER_WIDTH = 1
const SKILL_WINDOW_WIDTH = SKILL_ROW_LABEL_WIDTH + SKILL_WINDOW_COLUMNS * SKILL_CELL_WIDTH
const SKILL_WINDOW_OUTER_WIDTH = SKILL_WINDOW_WIDTH + 2 * SKILL_WINDOW_BORDER_WIDTH

// 스킬 창은 열 폭에 맞춰 커지고 지금 크기보다 작아지지 않는다. sprite의 전체 크기를 모르므로
// background-size 대신 zoom으로 아이콘을 키우는데, zoom은 단위 없는 수만 받아 tan(atan2())로 길이 비율을 수로 바꾼다.
const SKILL_WINDOW_SCALE = `max(1, tan(atan2(100cqi, ${SKILL_WINDOW_OUTER_WIDTH}px)))`
const SKILL_WINDOW_UNIT = `(${SKILL_WINDOW_SCALE} * 1px)`

const scaled = (px: number): string => `calc(${px} * ${SKILL_WINDOW_UNIT})`

export const styles = stylex.create({
  root: {
    display: 'grid',
    gridTemplateColumns: `minmax(max-content, 1fr) minmax(0, ${SIDE_COLUMN_WIDTH}px)`,
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: space.s24,
    padding: space.s16
  },
  windowColumn: { containerType: 'inline-size', minWidth: SKILL_WINDOW_OUTER_WIDTH },
  window: {
    position: 'relative',
    flexShrink: 0,
    borderWidth: scaled(SKILL_WINDOW_BORDER_WIDTH),
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: radius.control,
    backgroundColor: colors.bgInset
  },
  windowSize: (rowCount: number) => ({
    width: scaled(SKILL_WINDOW_WIDTH),
    height: scaled(rowCount * SKILL_CELL_HEIGHT)
  }),
  rowLabel: {
    position: 'absolute',
    left: 0,
    width: scaled(SKILL_ROW_LABEL_WIDTH),
    height: scaled(SKILL_CELL_HEIGHT),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: scaled(11),
    lineHeight: scaled(14),
    color: colors.fgSubtle,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  },
  rowTop: (row: number) => ({ top: scaled(row * SKILL_CELL_HEIGHT) }),
  rowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: scaled(1),
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault
  },
  icon: {
    position: 'absolute',
    width: scaled(SKILL_CELL_WIDTH),
    height: scaled(SKILL_CELL_HEIGHT),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaled(4),
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit'
  },
  iconPosition: (col: number, row: number) => ({
    left: scaled(SKILL_ROW_LABEL_WIDTH + col * SKILL_CELL_WIDTH),
    top: scaled(row * SKILL_CELL_HEIGHT)
  }),
  image: {
    display: 'block',
    width: SKILL_ICON_SIZE,
    height: SKILL_ICON_SIZE,
    backgroundRepeat: 'no-repeat'
  },
  sprite: (url: string, x: number, y: number) => ({
    backgroundImage: `url("${url}")`,
    backgroundPosition: `${-x}px ${-y}px`
  }),
  unlearned: { opacity: 0.3, filter: 'grayscale(1)' },
  // zoom은 아이콘과 함께 개화, 강화 표식과 선택 테두리도 같은 배율로 키운다.
  frame: { position: 'relative', display: 'block', zoom: SKILL_WINDOW_SCALE, userSelect: 'none' },
  scaledMark: { imageRendering: 'auto' },
  picked: { boxShadow: `0 0 0 2px ${colors.signal}` },
  // 개화 마름모는 아이콘 아래 가운데에 걸치고, 강화 표식은 오른쪽 위에 둔다.
  evolutionMark: {
    position: 'absolute',
    left: '50%',
    bottom: -8,
    width: EVOLUTION_MARK_SIZE,
    height: EVOLUTION_MARK_SIZE,
    marginLeft: -8,
    imageRendering: 'pixelated'
  },
  enhancementMark: {
    position: 'absolute',
    right: -7,
    top: -7,
    width: ENHANCEMENT_MARK_SIZE,
    height: ENHANCEMENT_MARK_SIZE,
    imageRendering: 'pixelated'
  },
  level: {
    height: scaled(10),
    fontSize: scaled(10),
    lineHeight: scaled(10),
    fontWeight: 600,
    color: colors.fgMuted,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  },
  tooltip: { fontSize: 12, lineHeight: '16px', whiteSpace: 'nowrap' },
  side: { display: 'flex', flexDirection: 'column', gap: space.s24, minWidth: 0 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s4,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
    lineHeight: '18px'
  },
  listRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.s8
  },
  subtle: { color: colors.fgSubtle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  unselectable: { userSelect: 'none' },
  levelRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: space.s16,
    minWidth: 0,
    justifySelf: 'start'
  },
  state: { display: 'flex', alignItems: 'center', minHeight: SKILL_CELL_HEIGHT }
})
