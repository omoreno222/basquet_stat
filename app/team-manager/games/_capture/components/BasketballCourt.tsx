'use client';

import { inkOn } from '@/lib/colors';

interface BasketballCourtProps {
  onCourtTap?: (x: number, y: number) => void;
  shotMarkers?: Array<{
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: number;
    label?: string;
    /** Team kit color, already normalized to #rrggbb. */
    color: string;
  }>;
  /** Shown the instant a shot is tapped, until the saved event arrives. */
  pendingShot?: { x: number; y: number; made: boolean; label: string; color: string } | null;
  /** Live tap while recording a turnover. Not drawn from saved events. */
  placement?: { x: number; y: number } | null;
  className?: string;
  attackingRight?: boolean;
  isOffense?: boolean;
  opponentCode?: string;
  opponentColor?: string;
  teamLogoUrl?: string | null;
  tableOnBottom?: boolean;
  tableLabel?: string;
  logoInverted?: boolean;
  /** Pulsing wood strip on the attacking half. Visual only; taps pass through. */
  showAttackBar?: boolean;
  /** Round marks in the bottom corners. Off on the live court; they sit on the hint bar. */
  showAttackMarks?: boolean;
  /** Unique when more than one court is mounted, so the home logo clip does not collide. */
  logoClipId?: string;
}

/**
 * FIBA Basketball Court - Exact Dimensions (in meters):
 * - Court: 28m × 15m (aspect ratio 1.8667:1)
 * - Basket (rim center): 1.575m from baseline, centered at y=7.5m
 * - 3-point line: 6.75m radius arc + corner straights at 0.9m from sidelines
 * - Key: 4.9m wide × 5.8m long, free-throw circle radius 1.8m
 * - Restricted area: 1.25m radius from rim
 * 
 * SVG viewBox: 2800 × 1500 (1 unit = 1cm for precision)
 * The court fills the viewBox. Side columns and the scoreboard live outside this SVG.
 * MUST maintain aspect ratio - no stretching!
 */

const ATTACK_MARK_R = 46;
const ATTACK_MARK_TRI_H = 58;
const ATTACK_MARK_TRI_W = 42;
const ATTACK_MARK_OVERLAP = 14;
const ATTACK_MARK_W = ATTACK_MARK_R * 2 + ATTACK_MARK_TRI_W - ATTACK_MARK_OVERLAP;
const ATTACK_MARK_H = ATTACK_MARK_R * 2;
/** Short of the corner three, which starts 90cm from the sideline. */
const ATTACK_BAR_H = 64;
const ATTACK_BAR_FILL = '#c4894a';

/** Round mark with a triangular pointer tucked into one side. */
function attackMarkLayout(x: number, y: number, pointRight: boolean) {
  const cy = y + ATTACK_MARK_R;
  const cx = pointRight ? x + ATTACK_MARK_R : x + ATTACK_MARK_W - ATTACK_MARK_R;
  const baseX = pointRight ? cx + ATTACK_MARK_R - ATTACK_MARK_OVERLAP : cx - ATTACK_MARK_R + ATTACK_MARK_OVERLAP;
  const tipX = pointRight ? baseX + ATTACK_MARK_TRI_W : baseX - ATTACK_MARK_TRI_W;
  const topY = cy - ATTACK_MARK_TRI_H / 2;
  const bottomY = cy + ATTACK_MARK_TRI_H / 2;
  return {
    cx,
    cy,
    r: ATTACK_MARK_R,
    triangle: `M ${baseX} ${topY} L ${tipX} ${cy} L ${baseX} ${bottomY} Z`,
  };
}

const MISS_INK = '#171717';

function ShotSpot({
  x,
  y,
  made,
  label,
  color,
  courtLength,
  courtWidth,
}: {
  x: number;
  y: number;
  made: boolean;
  label: string;
  color: string;
  courtLength: number;
  courtWidth: number;
}) {
  const markerX = x * courtLength;
  const markerY = y * courtWidth;
  return (
    <g>
      <circle
        cx={markerX}
        cy={markerY}
        r="28"
        fill={made ? color : 'none'}
        stroke={made ? 'none' : color}
        strokeWidth={made ? 0 : 4}
      />
      <text
        x={markerX}
        y={markerY + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={made ? inkOn(color) : MISS_INK}
        fontSize={label.length > 1 ? 22 : 28}
        fontWeight="bold"
        style={made ? { textShadow: '0 0 4px rgba(0,0,0,0.8)' } : undefined}
      >
        {label}
      </text>
    </g>
  );
}

export function BasketballCourt({ 
  onCourtTap, 
  shotMarkers = [],
  pendingShot = null,
  placement = null,
  className = '',
  attackingRight = true,
  isOffense = true,
  opponentCode = '',
  opponentColor = '#737373',
  teamLogoUrl = null,
  tableOnBottom = true,
  tableLabel = "Scorer's table",
  logoInverted = false,
  showAttackBar = false,
  showAttackMarks = true,
  logoClipId = 'capture-home-attack-logo',
}: BasketballCourtProps) {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onCourtTap) return;

    const svg = e.currentTarget;
    const VIEWBOX_WIDTH = 2800;
    const VIEWBOX_HEIGHT = 1500;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const local = point.matrixTransform(ctm.inverse());
      if (local.x >= 0 && local.x <= VIEWBOX_WIDTH && local.y >= 0 && local.y <= VIEWBOX_HEIGHT) {
        onCourtTap(local.x / VIEWBOX_WIDTH, local.y / VIEWBOX_HEIGHT);
      }
      return;
    }

    const rect = svg.getBoundingClientRect();
    
    // Get the actual rendered SVG dimensions (accounting for aspect ratio preservation)
    const svgWidth = rect.width;
    const svgHeight = rect.height;
    
    // Calculate click position relative to SVG
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // The SVG maintains 2800:1500 aspect ratio with "meet", so calculate letterboxing
    const svgAspect = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
    const containerAspect = svgWidth / svgHeight;
    
    let actualWidth, actualHeight, offsetX, offsetY;
    
    if (containerAspect > svgAspect) {
      // Container is wider - letterbox on sides
      actualHeight = svgHeight;
      actualWidth = svgHeight * svgAspect;
      offsetX = (svgWidth - actualWidth) / 2;
      offsetY = 0;
    } else {
      // Container is taller - letterbox on top/bottom
      actualWidth = svgWidth;
      actualHeight = svgWidth / svgAspect;
      offsetX = 0;
      offsetY = (svgHeight - actualHeight) / 2;
    }
    
    // Normalize to 0-1 range accounting for letterboxing
    const worldX = (clickX - offsetX) / actualWidth;
    const worldY = (clickY - offsetY) / actualHeight;
    
    // Map to viewBox coordinates
    const viewBoxX = worldX * VIEWBOX_WIDTH;
    const viewBoxY = worldY * VIEWBOX_HEIGHT;
    
    if (viewBoxX >= 0 && viewBoxX <= VIEWBOX_WIDTH && viewBoxY >= 0 && viewBoxY <= VIEWBOX_HEIGHT) {
      const courtX = viewBoxX / VIEWBOX_WIDTH;
      const courtY = viewBoxY / VIEWBOX_HEIGHT;
      onCourtTap(courtX, courtY);
    }
  };

  const highlightRight = isOffense ? attackingRight : !attackingRight;

  // FIBA dimensions in cm (1 unit = 1cm)
  const COURT_LENGTH = 2800; // 28m
  const COURT_WIDTH = 1500; // 15m
  const VIEWBOX_HEIGHT = COURT_WIDTH;
  const RIM_FROM_BASELINE = 157.5; // 1.575m
  const RIM_Y = 750; // 7.5m (center of court width)
  const THREE_PT_RADIUS = 675; // 6.75m
  const CORNER_THREE_FROM_SIDELINE = 90; // 0.9m
  const KEY_WIDTH = 490; // 4.9m
  const KEY_LENGTH = 580; // 5.8m
  const FT_CIRCLE_RADIUS = 180; // 1.8m
  const RESTRICTED_RADIUS = 125; // 1.25m
  const CENTER_CIRCLE_RADIUS = 180; // 1.8m

  // Calculate 3-point corner meeting point
  const cornerDistFromRim = RIM_Y - CORNER_THREE_FROM_SIDELINE; // 660cm
  const threePtMeetX = RIM_FROM_BASELINE + Math.sqrt(THREE_PT_RADIUS * THREE_PT_RADIUS - cornerDistFromRim * cornerDistFromRim); // ≈299cm

  // Left basket coordinates
  const leftRimX = RIM_FROM_BASELINE;
  const leftRimY = RIM_Y;
  const leftKeyTop = (COURT_WIDTH - KEY_WIDTH) / 2; // 505cm from top edge
  const leftKeyBottom = (COURT_WIDTH + KEY_WIDTH) / 2; // 995cm from top edge
  const leftFreeThrowX = KEY_LENGTH; // 580cm from left baseline

  // Right basket coordinates (mirrored)
  const rightRimX = COURT_LENGTH - RIM_FROM_BASELINE;
  const rightRimY = RIM_Y;
  const rightKeyTop = leftKeyTop;
  const rightKeyBottom = leftKeyBottom;
  const rightFreeThrowX = COURT_LENGTH - KEY_LENGTH;

  return (
    <svg
      viewBox={`0 0 ${COURT_LENGTH} ${VIEWBOX_HEIGHT}`}
      className={`w-full h-full ${className}`}
      onClick={handleClick}
      style={{ cursor: onCourtTap ? 'pointer' : 'default' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Wood plank pattern */}
        <pattern id="woodPlank" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="20" fill="#d4a574"/>
          <rect x="0" y="0" width="100" height="1" fill="#c89960" opacity="0.3"/>
          <rect x="0" y="19" width="100" height="1" fill="#b8925e" opacity="0.4"/>
          <line x1="0" y1="10" x2="100" y2="10" stroke="#c89960" strokeWidth="0.3" opacity="0.2"/>
        </pattern>
        
        {/* Wood grain texture */}
        <pattern id="woodGrain" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="url(#woodPlank)"/>
          <line x1="50" y1="0" x2="50" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          <line x1="100" y1="0" x2="100" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          <line x1="150" y1="0" x2="150" y2="200" stroke="#b8925e" strokeWidth="1" opacity="0.3"/>
          <rect x="0" y="0" width="50" height="200" fill="#c89960" opacity="0.05"/>
          <rect x="100" y="0" width="50" height="200" fill="#b8925e" opacity="0.05"/>
        </pattern>

        {/* Active half highlight */}
        <pattern id="activeHighlight" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="#fff" opacity="0.08"/>
        </pattern>

        {/* Paint tint */}
        <linearGradient id="paintTint" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.15"/>
          <stop offset="50%" stopColor="#f97316" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.15"/>
        </linearGradient>
      </defs>

      {/* Court background - hardwood */}
      <rect x="0" y="0" width={COURT_LENGTH} height={COURT_WIDTH} fill="url(#woodGrain)" />
      
      {/* Active half highlighting */}
      {!highlightRight && (
        <rect x="0" y="0" width={COURT_LENGTH / 2} height={COURT_WIDTH} fill="url(#activeHighlight)" />
      )}
      {highlightRight && (
        <rect x={COURT_LENGTH / 2} y="0" width={COURT_LENGTH / 2} height={COURT_WIDTH} fill="url(#activeHighlight)" />
      )}

      {showAttackBar ? (
        <rect
          x={highlightRight ? COURT_LENGTH / 2 : 0}
          y={tableOnBottom ? 0 : COURT_WIDTH - ATTACK_BAR_H}
          width={COURT_LENGTH / 2}
          height={ATTACK_BAR_H}
          fill={ATTACK_BAR_FILL}
          className="pointer-events-none animate-pulse"
          aria-hidden="true"
        />
      ) : null}
      
      {/* Court outline - white */}
      <rect x="0" y="0" width={COURT_LENGTH} height={COURT_WIDTH} fill="none" stroke="#ffffff" strokeWidth="5" />
      
      {/* Center line */}
      <line x1={COURT_LENGTH / 2} y1="0" x2={COURT_LENGTH / 2} y2={COURT_WIDTH} stroke="#ffffff" strokeWidth="5" />
      
      {/* Center circle */}
      <circle cx={COURT_LENGTH / 2} cy={COURT_WIDTH / 2} r={CENTER_CIRCLE_RADIUS} fill="none" stroke="#ffffff" strokeWidth="3" />
      
      {/* Logo in center circle - painted on parquet, above center line */}
      <image
        href="/images/seasonmath-logo-light.png"
        x={COURT_LENGTH / 2 - 150}
        y={COURT_WIDTH / 2 - 150}
        width="300"
        height="300"
        opacity="0.85"
        preserveAspectRatio="xMidYMid meet"
        transform={logoInverted ? `rotate(180 ${COURT_LENGTH / 2} ${COURT_WIDTH / 2})` : undefined}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* LEFT BASKET HALF */}
      
      {/* Paint/Key - tinted rectangle from baseline */}
      <rect 
        x="0" 
        y={leftKeyTop} 
        width={KEY_LENGTH} 
        height={KEY_WIDTH} 
        fill="url(#paintTint)" 
      />
      <rect 
        x="0" 
        y={leftKeyTop} 
        width={KEY_LENGTH} 
        height={KEY_WIDTH} 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Free-throw line */}
      <line 
        x1={leftFreeThrowX} 
        y1={leftKeyTop} 
        x2={leftFreeThrowX} 
        y2={leftKeyBottom} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Free-throw circle (solid half toward center) */}
      <path
        d={`M ${leftFreeThrowX} ${RIM_Y - FT_CIRCLE_RADIUS} 
            A ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 0 1 ${leftFreeThrowX} ${RIM_Y + FT_CIRCLE_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
      />
      {/* Dashed inner half of FT circle */}
      <path
        d={`M ${leftFreeThrowX} ${RIM_Y - FT_CIRCLE_RADIUS} 
            A ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 0 0 ${leftFreeThrowX} ${RIM_Y + FT_CIRCLE_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeDasharray="10,5"
      />
      
      {/* Restricted area semicircle */}
      <path
        d={`M ${leftRimX} ${leftRimY - RESTRICTED_RADIUS} 
            A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 1 ${leftRimX} ${leftRimY + RESTRICTED_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      
      {/* 3-point line - LEFT */}
      {/* Top corner straight segment */}
      <line 
        x1="0" 
        y1={CORNER_THREE_FROM_SIDELINE} 
        x2={threePtMeetX} 
        y2={CORNER_THREE_FROM_SIDELINE} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Bottom corner straight segment */}
      <line 
        x1="0" 
        y1={COURT_WIDTH - CORNER_THREE_FROM_SIDELINE} 
        x2={threePtMeetX} 
        y2={COURT_WIDTH - CORNER_THREE_FROM_SIDELINE} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* 3-point arc */}
      <path
        d={`M ${threePtMeetX} ${CORNER_THREE_FROM_SIDELINE} 
            A ${THREE_PT_RADIUS} ${THREE_PT_RADIUS} 0 0 1 ${threePtMeetX} ${COURT_WIDTH - CORNER_THREE_FROM_SIDELINE}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
      />
      
      {/* Basket/hoop - left */}
      <circle cx={leftRimX} cy={leftRimY} r="22.5" fill="none" stroke="#ff4444" strokeWidth="3" />
      
      {/* Backboard - left (1.8m = 180cm wide, at 1.2m = 120cm from baseline) */}
      <line 
        x1="120" 
        y1={RIM_Y - 90} 
        x2="120" 
        y2={RIM_Y + 90} 
        stroke="#ffffff" 
        strokeWidth="6" 
      />
      
      {/* RIGHT BASKET HALF */}
      
      {/* Paint/Key - tinted rectangle from baseline */}
      <rect 
        x={rightFreeThrowX} 
        y={rightKeyTop} 
        width={KEY_LENGTH} 
        height={KEY_WIDTH} 
        fill="url(#paintTint)" 
      />
      <rect 
        x={rightFreeThrowX} 
        y={rightKeyTop} 
        width={KEY_LENGTH} 
        height={KEY_WIDTH} 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Free-throw line */}
      <line 
        x1={rightFreeThrowX} 
        y1={rightKeyTop} 
        x2={rightFreeThrowX} 
        y2={rightKeyBottom} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Free-throw circle */}
      <path
        d={`M ${rightFreeThrowX} ${RIM_Y - FT_CIRCLE_RADIUS} 
            A ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 0 0 ${rightFreeThrowX} ${RIM_Y + FT_CIRCLE_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
      />
      {/* Dashed inner half of FT circle */}
      <path
        d={`M ${rightFreeThrowX} ${RIM_Y - FT_CIRCLE_RADIUS} 
            A ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 0 1 ${rightFreeThrowX} ${RIM_Y + FT_CIRCLE_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeDasharray="10,5"
      />
      
      {/* Restricted area semicircle */}
      <path
        d={`M ${rightRimX} ${rightRimY - RESTRICTED_RADIUS} 
            A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 0 ${rightRimX} ${rightRimY + RESTRICTED_RADIUS}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      
      {/* 3-point line - RIGHT */}
      {/* Top corner straight segment */}
      <line 
        x1={COURT_LENGTH} 
        y1={CORNER_THREE_FROM_SIDELINE} 
        x2={COURT_LENGTH - threePtMeetX} 
        y2={CORNER_THREE_FROM_SIDELINE} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* Bottom corner straight segment */}
      <line 
        x1={COURT_LENGTH} 
        y1={COURT_WIDTH - CORNER_THREE_FROM_SIDELINE} 
        x2={COURT_LENGTH - threePtMeetX} 
        y2={COURT_WIDTH - CORNER_THREE_FROM_SIDELINE} 
        stroke="#ffffff" 
        strokeWidth="3" 
      />
      
      {/* 3-point arc */}
      <path
        d={`M ${COURT_LENGTH - threePtMeetX} ${CORNER_THREE_FROM_SIDELINE} 
            A ${THREE_PT_RADIUS} ${THREE_PT_RADIUS} 0 0 0 ${COURT_LENGTH - threePtMeetX} ${COURT_WIDTH - CORNER_THREE_FROM_SIDELINE}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
      />
      
      {/* Basket/hoop - right */}
      <circle cx={rightRimX} cy={rightRimY} r="22.5" fill="none" stroke="#ff4444" strokeWidth="3" />
      
      {/* Backboard - right */}
      <line 
        x1={COURT_LENGTH - 120} 
        y1={RIM_Y - 90} 
        x2={COURT_LENGTH - 120} 
        y2={RIM_Y + 90} 
        stroke="#ffffff" 
        strokeWidth="6" 
      />
      
      {/* Bottom corner of each attacking half: round mark plus a triangle pointing at that basket. */}
      {showAttackMarks ? (() => {
        const pad = 16;
        const leftX = pad;
        const rightX = COURT_LENGTH - ATTACK_MARK_W - pad;
        const markY = COURT_WIDTH - ATTACK_MARK_H - pad;
        const letters = opponentCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
        const awayInk = inkOn(opponentColor);
        const homeX = attackingRight ? rightX : leftX;
        const awayX = attackingRight ? leftX : rightX;
        const homeMark = attackMarkLayout(homeX, markY, attackingRight);
        const awayMark = attackMarkLayout(awayX, markY, !attackingRight);

        return (
          <g style={{ pointerEvents: 'none' }}>
            <defs>
              <clipPath id={logoClipId}>
                <circle cx={homeMark.cx} cy={homeMark.cy} r={homeMark.r} />
              </clipPath>
            </defs>
            {teamLogoUrl ? (
              <g>
                <circle cx={homeMark.cx} cy={homeMark.cy} r={homeMark.r} fill="#ffffff" stroke="#1a1a1a" strokeWidth="3" />
                <image
                  href={teamLogoUrl}
                  x={homeMark.cx - homeMark.r}
                  y={homeMark.cy - homeMark.r}
                  width={homeMark.r * 2}
                  height={homeMark.r * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${logoClipId})`}
                />
                <circle cx={homeMark.cx} cy={homeMark.cy} r={homeMark.r} fill="none" stroke="#1a1a1a" strokeWidth="3" />
                <path d={homeMark.triangle} fill="#1a1a1a" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="miter" />
              </g>
            ) : null}
            <circle cx={awayMark.cx} cy={awayMark.cy} r={awayMark.r} fill={opponentColor} stroke={awayInk} strokeWidth="3" />
            {letters ? (
              <text
                x={awayMark.cx}
                y={awayMark.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={awayInk}
                fontSize={letters.length > 2 ? 18 : 22}
                fontWeight="800"
                fontFamily="system-ui, sans-serif"
              >
                {letters}
              </text>
            ) : null}
            <path d={awayMark.triangle} fill={opponentColor} stroke={awayInk} strokeWidth="2.5" strokeLinejoin="miter" />
          </g>
        );
      })() : null}

      <g
        role="img"
        aria-label={tableLabel}
        style={{ cursor: 'default' }}
        onClick={(event) => event.stopPropagation()}
      >
        <title>{tableLabel}</title>
        {(() => {
          const tableW = 480;
          const tableH = 64;
          const tableX = (COURT_LENGTH - tableW) / 2;
          const tableY = tableOnBottom ? COURT_WIDTH - tableH : 0;
          const lipY = tableOnBottom ? tableY : tableY + tableH - 16;
          return (
            <>
              <rect x={tableX} y={tableY} width={tableW} height={tableH} fill="#1e3a8a" />
              <rect x={tableX} y={lipY} width={tableW} height={16} fill="#93c5fd" />
              <rect x={tableX} y={tableY} width={tableW} height={tableH} fill="none" stroke="#ffffff" strokeWidth={4} />
            </>
          );
        })()}
      </g>

      {placement ? (
        <g aria-label="Turnover location">
          <circle
            cx={placement.x * COURT_LENGTH}
            cy={placement.y * COURT_WIDTH}
            r="36"
            fill="#000"
            opacity="0.35"
          />
          <circle
            cx={placement.x * COURT_LENGTH}
            cy={placement.y * COURT_WIDTH}
            r="22"
            fill="#f97316"
            stroke="#fff"
            strokeWidth="4"
          />
        </g>
      ) : null}

      {shotMarkers.map((marker) => (
        <ShotSpot
          key={marker.id}
          x={marker.x}
          y={marker.y}
          made={marker.made}
          label={marker.label ?? String(marker.points)}
          color={marker.color}
          courtLength={COURT_LENGTH}
          courtWidth={COURT_WIDTH}
        />
      ))}
      {pendingShot ? (
        <ShotSpot
          x={pendingShot.x}
          y={pendingShot.y}
          made={pendingShot.made}
          label={pendingShot.label}
          color={pendingShot.color}
          courtLength={COURT_LENGTH}
          courtWidth={COURT_WIDTH}
        />
      ) : null}
    </svg>
  );
}
