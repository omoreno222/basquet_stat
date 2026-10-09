import type { ShotMark } from '@/lib/stats/shot-chart';

/** Right half of the FIBA court, in centimetres. Same frame as the capture court. */
const COURT_LENGTH = 2800;
const COURT_WIDTH = 1500;
const HALF = COURT_LENGTH / 2;
const RIM_FROM_BASELINE = 157.5;
const RIM_Y = 750;
const THREE_PT_RADIUS = 675;
const CORNER = 90;
const KEY_WIDTH = 490;
const KEY_LENGTH = 580;
const FT_RADIUS = 180;
const RESTRICTED = 125;
const CENTER_RADIUS = 180;
const KEY_TOP = (COURT_WIDTH - KEY_WIDTH) / 2;
const KEY_BOTTOM = (COURT_WIDTH + KEY_WIDTH) / 2;
const RIM_X = COURT_LENGTH - RIM_FROM_BASELINE;
const FT_X = COURT_LENGTH - KEY_LENGTH;
const CORNER_FROM_RIM = RIM_Y - CORNER;
const THREE_MEET = RIM_FROM_BASELINE + Math.sqrt(THREE_PT_RADIUS ** 2 - CORNER_FROM_RIM ** 2);
const ARC_X = COURT_LENGTH - THREE_MEET;
const MAKE = '#16a34a';
const MISS = '#dc2626';
const DOT_R = 10;
const X_ARM = 8;

export function EvalShotChart({
  side,
  marks,
  chartLabel,
  madeLabel,
  missLabel,
  emptyLabel,
}: {
  side: 'home' | 'away';
  marks: readonly ShotMark[];
  chartLabel: string;
  madeLabel: string;
  missLabel: string;
  emptyLabel: string;
}) {
  const prefix = `eval-half-${side}`;
  return (
    <figure aria-label={chartLabel} className="mx-auto mt-4 w-full max-w-[28rem]">
      <svg
        viewBox={`${HALF} 0 ${HALF} ${COURT_WIDTH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <pattern id={`${prefix}-wood`} x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
            <rect width="100" height="20" fill="#d4a574" />
            <rect width="100" height="1" fill="#c89960" opacity="0.35" />
          </pattern>
          <clipPath id={`${prefix}-clip`}>
            <rect x={HALF} y="0" width={HALF} height={COURT_WIDTH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${prefix}-clip)`}>
          <rect x={HALF} y="0" width={HALF} height={COURT_WIDTH} fill={`url(#${prefix}-wood)`} />
          <rect x={FT_X} y={KEY_TOP} width={KEY_LENGTH} height={KEY_WIDTH} fill="#f97316" opacity="0.12" />
          <rect x={HALF} y="0" width={HALF} height={COURT_WIDTH} fill="none" stroke="#ffffff" strokeWidth="5" />
          <circle cx={HALF} cy={RIM_Y} r={CENTER_RADIUS} fill="none" stroke="#ffffff" strokeWidth="3" />
          <rect x={FT_X} y={KEY_TOP} width={KEY_LENGTH} height={KEY_WIDTH} fill="none" stroke="#ffffff" strokeWidth="3" />
          <line x1={FT_X} y1={KEY_TOP} x2={FT_X} y2={KEY_BOTTOM} stroke="#ffffff" strokeWidth="3" />
          <path
            d={`M ${FT_X} ${RIM_Y - FT_RADIUS} A ${FT_RADIUS} ${FT_RADIUS} 0 0 0 ${FT_X} ${RIM_Y + FT_RADIUS}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <path
            d={`M ${FT_X} ${RIM_Y - FT_RADIUS} A ${FT_RADIUS} ${FT_RADIUS} 0 0 1 ${FT_X} ${RIM_Y + FT_RADIUS}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeDasharray="10,5"
          />
          <path
            d={`M ${RIM_X} ${RIM_Y - RESTRICTED} A ${RESTRICTED} ${RESTRICTED} 0 0 0 ${RIM_X} ${RIM_Y + RESTRICTED}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <line x1={COURT_LENGTH} y1={CORNER} x2={ARC_X} y2={CORNER} stroke="#ffffff" strokeWidth="3" />
          <line x1={COURT_LENGTH} y1={COURT_WIDTH - CORNER} x2={ARC_X} y2={COURT_WIDTH - CORNER} stroke="#ffffff" strokeWidth="3" />
          <path
            d={`M ${ARC_X} ${CORNER} A ${THREE_PT_RADIUS} ${THREE_PT_RADIUS} 0 0 0 ${ARC_X} ${COURT_WIDTH - CORNER}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
          />
          <circle cx={RIM_X} cy={RIM_Y} r="22.5" fill="none" stroke="#ff4444" strokeWidth="3" />
          <line x1={COURT_LENGTH - 120} y1={RIM_Y - 90} x2={COURT_LENGTH - 120} y2={RIM_Y + 90} stroke="#ffffff" strokeWidth="6" />
          {marks.map((mark, index) => {
            const cx = mark.x * COURT_LENGTH;
            const cy = mark.y * COURT_WIDTH;
            const key = `${mark.x}-${mark.y}-${mark.made}-${index}`;
            if (mark.made) {
              return <circle key={key} cx={cx} cy={cy} r={DOT_R} fill={MAKE} opacity="0.7" />;
            }
            return (
              <g key={key}>
                <line x1={cx - X_ARM} y1={cy - X_ARM} x2={cx + X_ARM} y2={cy + X_ARM} stroke={MISS} strokeWidth="3" strokeLinecap="round" />
                <line x1={cx - X_ARM} y1={cy + X_ARM} x2={cx + X_ARM} y2={cy - X_ARM} stroke={MISS} strokeWidth="3" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MAKE }} />
          {madeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-black leading-none text-red-600" aria-hidden="true">×</span>
          {missLabel}
        </span>
      </figcaption>
      {marks.length === 0 ? (
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
      ) : null}
    </figure>
  );
}
