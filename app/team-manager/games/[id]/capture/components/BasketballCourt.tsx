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
  attackingRight?: boolean; // Which basket we're attacking (true = right, false = left)
  isOffense?: boolean; // Are we on offense? Highlights active half
}

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
    // World coordinates (0-1 range, left to right)
    const worldX = (e.clientX - rect.left) / rect.width;
    const worldY = (e.clientY - rect.top) / rect.height;

    onCourtTap(worldX, worldY);
  };

  // Determine which half to highlight
  const highlightRight = isOffense ? attackingRight : !attackingRight;

  return (
    <svg
      viewBox="0 0 1000 470"
      className={`w-full h-full ${className}`}
      onClick={handleClick}
      style={{ cursor: onCourtTap ? 'pointer' : 'default' }}
    >
      {/* Court background - full court */}
      <rect x="0" y="0" width="1000" height="470" fill="#1f2937" />
      
      {/* Left half background (highlight if active) */}
      <rect 
        x="10" 
        y="10" 
        width="490" 
        height="450" 
        fill={!highlightRight ? '#374151' : '#1f2937'} 
        opacity={!highlightRight ? '0.8' : '1'}
      />
      
      {/* Right half background (highlight if active) */}
      <rect 
        x="500" 
        y="10" 
        width="490" 
        height="450" 
        fill={highlightRight ? '#374151' : '#1f2937'} 
        opacity={highlightRight ? '0.8' : '1'}
      />
      
      {/* Full court outline */}
      <rect x="10" y="10" width="980" height="450" fill="none" stroke="#f97316" strokeWidth="3" />
      
      {/* Center line */}
      <line x1="500" y1="10" x2="500" y2="460" stroke="#f97316" strokeWidth="3" />
      
      {/* Center circle */}
      <circle cx="500" cy="235" r="55" fill="none" stroke="#f97316" strokeWidth="2" />
      
      {/* LEFT BASKET HALF */}
      
      {/* Paint/Key */}
      <rect x="10" y="160" width="178" height="150" fill="none" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw line */}
      <line x1="188" y1="160" x2="188" y2="310" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw circle */}
      <path
        d="M 188 205 A 55 55 0 0 0 188 265"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* Restricted area semicircle */}
      <path
        d="M 35 205 A 30 30 0 0 0 35 265"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* 3-point line - left basket */}
      {/* Corner 3s */}
      <line x1="10" y1="88" x2="88" y2="88" stroke="#f97316" strokeWidth="2.5" />
      <line x1="10" y1="382" x2="88" y2="382" stroke="#f97316" strokeWidth="2.5" />
      
      {/* 3-point arc */}
      <path
        d="M 88 88 Q 10 165 10 235 Q 10 305 88 382"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.5"
      />
      
      {/* Basket/hoop - left */}
      <circle cx="25" cy="235" r="8" fill="none" stroke="#ef4444" strokeWidth="2" />
      <line x1="18" y1="235" x2="10" y2="235" stroke="#fff" strokeWidth="1.5" />
      
      {/* Backboard - left */}
      <line x1="10" y1="205" x2="10" y2="265" stroke="#fff" strokeWidth="3" />
      
      {/* RIGHT BASKET HALF */}
      
      {/* Paint/Key */}
      <rect x="812" y="160" width="178" height="150" fill="none" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw line */}
      <line x1="812" y1="160" x2="812" y2="310" stroke="#f97316" strokeWidth="2" />
      
      {/* Free throw circle */}
      <path
        d="M 812 205 A 55 55 0 0 1 812 265"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* Restricted area semicircle */}
      <path
        d="M 965 205 A 30 30 0 0 1 965 265"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
      />
      
      {/* 3-point line - right basket */}
      {/* Corner 3s */}
      <line x1="912" y1="88" x2="990" y2="88" stroke="#f97316" strokeWidth="2.5" />
      <line x1="912" y1="382" x2="990" y2="382" stroke="#f97316" strokeWidth="2.5" />
      
      {/* 3-point arc */}
      <path
        d="M 912 88 Q 990 165 990 235 Q 990 305 912 382"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.5"
      />
      
      {/* Basket/hoop - right */}
      <circle cx="975" cy="235" r="8" fill="none" stroke="#ef4444" strokeWidth="2" />
      <line x1="982" y1="235" x2="990" y2="235" stroke="#fff" strokeWidth="1.5" />
      
      {/* Backboard - right */}
      <line x1="990" y1="205" x2="990" y2="265" stroke="#fff" strokeWidth="3" />
      
      {/* Shot markers */}
      {shotMarkers.map((marker) => {
        // Markers are stored in world coordinates (0-1 range)
        const markerX = 10 + marker.x * 980;
        const markerY = 10 + marker.y * 450;
        const color = marker.made ? '#10b981' : '#ef4444';
        
        return (
          <g key={marker.id}>
            <circle
              cx={markerX}
              cy={markerY}
              r="8"
              fill={color}
              opacity="0.8"
              stroke="#fff"
              strokeWidth="1.5"
            />
            <text
              x={markerX}
              y={markerY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="10"
              fontWeight="bold"
            >
              {marker.points}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
