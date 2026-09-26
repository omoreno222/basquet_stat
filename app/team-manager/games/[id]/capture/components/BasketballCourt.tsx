'use client';

interface BasketballCourtProps {
  onCourtTap?: (x: number, y: number) => void;
  shotMarkers?: Array<{
    id: string;
    x: number;
    y: number;
    made: boolean;
    points: number;
  }>;
  className?: string;
  attackingRight?: boolean;
  isOffense?: boolean;
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
 * MUST maintain aspect ratio - no stretching!
 */

export function BasketballCourt({ 
  onCourtTap, 
  shotMarkers = [], 
  className = '',
  attackingRight = true,
  isOffense = true,
}: BasketballCourtProps) {
  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    if (!onCourtTap) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Get the actual rendered SVG dimensions (accounting for aspect ratio preservation)
    const svgWidth = rect.width;
    const svgHeight = rect.height;
    
    // Calculate click position relative to SVG
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // The SVG maintains 28:15 aspect ratio with "meet", so calculate letterboxing
    const svgAspect = 2800 / 1500; // 1.8667
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
    
    // Only register clicks within the actual court bounds
    if (worldX >= 0 && worldX <= 1 && worldY >= 0 && worldY <= 1) {
      onCourtTap(worldX, worldY);
    }
  };

  const highlightRight = isOffense ? attackingRight : !attackingRight;

  // FIBA dimensions in cm (1 unit = 1cm)
  const COURT_LENGTH = 2800; // 28m
  const COURT_WIDTH = 1500; // 15m
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
      viewBox={`0 0 ${COURT_LENGTH} ${COURT_WIDTH}`}
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
      
      {/* Court outline - white */}
      <rect x="0" y="0" width={COURT_LENGTH} height={COURT_WIDTH} fill="none" stroke="#ffffff" strokeWidth="5" />
      
      {/* Center line */}
      <line x1={COURT_LENGTH / 2} y1="0" x2={COURT_LENGTH / 2} y2={COURT_WIDTH} stroke="#ffffff" strokeWidth="5" />
      
      {/* Center circle */}
      <circle cx={COURT_LENGTH / 2} cy={COURT_WIDTH / 2} r={CENTER_CIRCLE_RADIUS} fill="none" stroke="#ffffff" strokeWidth="3" />
      
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
      
      {/* Backboard - left (120cm wide, at 1.2m = 120cm from baseline) */}
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
      
      {/* Shot markers - enhanced visibility */}
      {shotMarkers.map((marker) => {
        const markerX = marker.x * COURT_LENGTH;
        const markerY = marker.y * COURT_WIDTH;
        const color = marker.made ? '#10b981' : '#ef4444';
        
        return (
          <g key={marker.id}>
            <circle cx={markerX} cy={markerY} r="35" fill="#000" opacity="0.3" />
            <circle cx={markerX} cy={markerY} r="28" fill={color} opacity="0.95" stroke="#fff" strokeWidth="4" />
            <text
              x={markerX}
              y={markerY + 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="28"
              fontWeight="bold"
              style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
            >
              {marker.points}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Helper function to check if a point is inside the 3-point line
 * Uses exact FIBA geometry for accurate 2P/3P detection
 */
export function isInsideThreePointLine(
  worldX: number,
  worldY: number,
  attackingRight: boolean
): boolean {
  // Convert world coords (0-1) to court coords (cm)
  const COURT_LENGTH = 2800;
  const COURT_WIDTH = 1500;
  const courtX = worldX * COURT_LENGTH;
  const courtY = worldY * COURT_WIDTH;
  
  // Attacking basket rim position
  const rimX = attackingRight ? COURT_LENGTH - 157.5 : 157.5;
  const rimY = 750;
  
  // Distance from rim
  const dx = courtX - rimX;
  const dy = courtY - rimY;
  const distFromRim = Math.sqrt(dx * dx + dy * dy);
  
  // Inside 3pt arc?
  if (distFromRim < 675) {
    // Also check if in corner-3 zone (within straight segments)
    const isInCorner = (courtY < 90 || courtY > 1410) && Math.abs(dx) < Math.sqrt(675 * 675 - 660 * 660);
    return !isInCorner;
  }
  
  return false;
}
